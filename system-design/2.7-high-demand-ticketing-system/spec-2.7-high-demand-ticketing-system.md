# Spec 2.7: High-Demand Ticketing System

## 1. System Objective
Design a ticketing platform for high-demand events (concerts, sports) where users discover events, view seat/section availability, temporarily hold inventory, complete payment, and receive confirmed orders — without ever selling the same seat twice. The system must handle the surge when sales open (100K+ users hitting inventory simultaneously), provide fair access, and gracefully handle payment provider timeouts that produce ambiguous charge outcomes.

## 2. System Requirements

### Functional Requirements
* **Event Discovery & Search**: Browse and search events by date, genre, venue, artist. Eventually consistent reads acceptable.
* **Seat Map / Availability View**: Real-time (or near-real-time) seat-level or section-level availability rendering.
* **Temporary Hold (Reserve)**: User selects seat(s) → system creates a time-bound hold (e.g. 10 minutes) → seat(s) become unavailable to other users.
* **Checkout & Payment**: User completes payment within hold window → order confirmed → e-ticket issued.
* **Hold Expiry**: Unconfirmed holds automatically release seats back to available inventory.
* **Best-Available Allocation**: For general-admission or group purchases, system selects the best N adjacent available seats.

### Non-Functional Requirements
* **Throughput**: Handle **100,000+ concurrent users** attempting seat holds when a major event goes on-sale.
* **Zero Oversell**: A confirmed seat must never be assigned to two different orders. This is the #1 invariant.
* **Hold Expiry Accuracy**: Within $\pm 2\text{ seconds}$ of configured timeout.
* **Eventual Consistency for Reads**: Seat map can be ~1–3 seconds stale. Checkout inventory must be strongly consistent.
* **Payment Resilience**: Gracefully handle payment provider timeouts where charge outcome is unknown.

---

## 3. Scaling & Capacity Estimation

### Traffic Model: Major Event On-Sale
| Metric | Value | Rationale |
| :--- | :--- | :--- |
| Event capacity | 80,000 seats (large stadium) | Taylor Swift / FIFA scale |
| Concurrent users at on-sale | 100,000–500,000 | 5–10× seat count for popular events |
| Peak seat-hold TPS | 50,000 | First 30 seconds: everyone clicks simultaneously |
| Steady-state TPS (after initial rush) | 2,000–5,000 | Slower browsers, retry on sold-out sections |
| Avg checkout completion rate | 70% of holds → confirmed | 30% abandon/expire |
| Payment API calls/sec (peak) | ~5,000 | Only users who reach checkout step |
| Seat map refresh requests/sec | 200,000+ (CDN-cached) | Every user polls availability |

### Inventory Data Size
| Entity | Scale | Storage |
| :--- | :--- | :--- |
| Events | 10K active events | ~10 MB metadata |
| Seats per event | 80K (large venue) | ~15 MB per event (seat ID, section, row, status, price) |
| Active holds | Up to 80K concurrent | ~16 MB in Redis (200 bytes per hold) |
| Orders | ~50K per major event | ~25 MB |
| Total hot data | | < 100 MB per event — fits entirely in Redis |

### Database & Redis Scaling
* **Target Load**: 100K–500K active users during a major on-sale, with up to 80K hot seats/holds for one event.
* **Database (PostgreSQL)**: 1x 16-vCPU / 64 GB RAM for durable orders, payment intents, audit, and confirmed seat assignments.
* **Redis Inventory Shards**: Redis Cluster spreads different events across shards. A single hot event must be assigned to one authoritative event shard unless the event is deliberately partitioned by section/zone.
* **Important Redis Cluster constraint**: A Lua script is atomic only for keys in the same Redis hash slot. Multi-seat holds must operate within one event/section shard, or use hash tags such as `{eventId}` / `{eventId:sectionId}` so all relevant keys are co-located.

### Application Server Scaling (Hold Service)
* **Target Load**: 50,000 hold attempts per second entering the waiting room; admitted hold attempts are rate-limited to inventory capacity.
* **Hardware**: 16-vCPU / 64 GB RAM nodes.
* **Capacity**: Because Redis Lua requires zero row-lock waiting, each API pod handles ~8,000 TPS.
* **Nodes Needed**: Deploy 8 API instances per AZ (24 total) prior to the 30-sec on-sale flash surge.

### Why the On-Sale Surge Is the Hard Problem

Steady-state ticketing is trivial (100 TPS). The entire design exists for the **30-second thundering herd** when sales open:
- 500K users load the seat map simultaneously → CDN must absorb 200K+ req/sec
- 50K users click "Reserve" within 5 seconds → inventory system must serialize 10K seat-lock operations/second
- If the system takes 200ms per hold, only 5,000/sec get through → 90% get "sold out" errors → immediate retry storm

---

## 4. Service Architecture

```text
[ Client ] ---> [ CDN ] ---> [ Catalog / Availability Service ]
                 |
                 v (Join sale / reserve)
        [ Virtual Waiting Room ]
                 |
                 | admission token at controlled drain rate
                 v
           [ Hold Service ] ----------> [ Redis Event Shard (Lua) ]
                 |                             |
                 v (expiry sorted set)         v (Timeout Release)
       [ Redis ZSET Expiry Index ] ---> [ Expiry Worker ]
                 |
                 v (Checkout)
           [ Order Service ]
                 |
        +--------+--------+
        v                 v
   [ Stripe ]        [ Order DB ]
```

### Service Boundaries & Responsibilities

| Service | Responsibility | Data Store | Consistency |
| :--- | :--- | :--- | :--- |
| **Catalog Service** | Event metadata, venue, pricing, search | PostgreSQL + Elasticsearch | Eventually consistent (indexed with ~2s lag) |
| **Availability Service** | Seat status reads for UI rendering | CDN snapshots + Redis read replica | Eventually consistent (~1–3s stale via CDN) |
| **Hold Service** | Atomic seat reservation with expiry | Redis event shard primary, Lua script | Strongly consistent for that event/section shard |
| **Order Service** | Payment orchestration, order persistence | PostgreSQL (ACID) | Strongly consistent |
| **Expiry Worker** | Release expired holds | Redis sorted set + Lua release script | Idempotent release with ~±2s target |
| **Recon Worker** | Resolve payment timeouts | PostgreSQL + Payment API | Reconcile ambiguous charges |

---

## 5. Seat State Machine

```text
[*] ---> [ AVAILABLE ]
               |
               +-- reserveSeats() ---> [ HELD ]
                                         |
                            +------------+------------+
                            |            |            |
                            v            v            v
                     [ AVAILABLE ] [ PAYMENT_PENDING ] [ AVAILABLE ]
                    (Cancel/Expiry)   /          \       (Payment start failed)
                                     /            \
                                    v              v
                                [ SOLD ]      [ AVAILABLE ]
                              (Confirmed)    (Declined / Refunded)
```

### The Critical State: `PAYMENT_PENDING`

This state exists because payment providers (Stripe, Adyen) can **time out without a definitive response**:

```
Scenario:
  1. User clicks "Pay" → Order Service calls Stripe charge API
  2. Stripe processes the charge and actually debits the card
  3. The HTTP response is lost (network timeout, TCP reset)
  4. Order Service receives a timeout exception
  
  Question: Was the card charged? We don't know.
```

**Why not just retry?** If the charge succeeded, retrying would double-charge the user.

**Resolution protocol:**
1. Before calling payment API: save `payment_intent_id` + `idempotency_key` in the order DB and atomically move Redis seats from `HELD` to `PAYMENT_PENDING` for that `holdId`.
2. On timeout: do NOT release seats. Keep seats in `PAYMENT_PENDING`.
3. Reconciliation worker polls Stripe's `GET /payment_intents/{id}` every 30 seconds for up to 10 minutes
4. If confirmed: move to `SOLD`, issue e-ticket
5. If declined/not found after 10 minutes: reverse the hold, release seats to `AVAILABLE`

**Why keep seats locked during `PAYMENT_PENDING`?** If we release, another user could buy the same seat. Then Stripe confirms the first charge → two orders for the same seat. Catastrophic oversell.

Holds are soft and ephemeral. Confirmed orders and sold seat assignments are durable in PostgreSQL. If Redis loses an unconfirmed hold, the user retries; if payment has started, the order DB and reconciliation worker recover the `PAYMENT_PENDING` path.

---

## 6. Atomic Seat Hold Implementation (Redis Lua)

```lua
-- KEYS[1] = event:{eventId}:seats (hash: seatId → compact state string)
-- KEYS[2] = event:{eventId}:hold_expiry (zset: holdId → expiresAt)
-- ARGV[1] = holdId
-- ARGV[2] = userId  
-- ARGV[3] = expiresAt (epoch ms)
-- ARGV[4..N] = seatIds to reserve

local event_key = KEYS[1]
local hold_id = ARGV[1]
local user_id = ARGV[2]
local expires_at = ARGV[3]
local seats = {}

-- Phase 1: Validate ALL seats are AVAILABLE
for i = 4, #ARGV do
    local seat_id = ARGV[i]
    local current = redis.call('HGET', event_key, seat_id)
    if current == nil or current == false then
        return cjson.encode({ok=false, error="SEAT_NOT_FOUND", seat=seat_id})
    end
    local state = string.sub(current, 1, 1)
    if state ~= "A" then
        return cjson.encode({ok=false, error="SEAT_UNAVAILABLE", seat=seat_id})
    end
    table.insert(seats, seat_id)
end

-- Phase 2: Atomically reserve ALL seats (all-or-nothing)
for _, seat_id in ipairs(seats) do
    -- Compact encoding avoids cjson decode/encode on the hot path:
    -- A = available
    -- H|holdId|userId|expiresAt = held
    -- P|holdId|orderId|paymentIntentId = payment pending
    -- S|orderId = sold
    local hold_data = "H|" .. hold_id .. "|" .. user_id .. "|" .. expires_at
    redis.call('HSET', event_key, seat_id, hold_data)
end

redis.call('ZADD', KEYS[2], expires_at, hold_id)

return cjson.encode({ok=true, holdId=hold_id, seatCount=#seats})
```

`cjson` is only used to format the Lua response. Seat state itself is stored as compact strings to avoid decoding JSON for every checked seat during the surge path.

### Why All-or-Nothing for Multi-Seat Holds?

If a user wants 4 adjacent seats and only 3 are available, reserving 3 is worse than reserving 0:
- The user can't sit together → they'll cancel all 3 → wasted hold capacity during the surge
- Those 3 seats were blocked from other users who might have been happy with any 3
- **Rule**: Either all requested seats are held, or none are. Atomic check + reserve in a single Lua script.

### Adjacent Seat Allocation (Best-Available)

```java
public List<String> findBestAdjacentSeats(String eventId, String section, int count) {
    // 1. Load seat map for section (pre-loaded in Redis as sorted set by row+number)
    // 2. Sliding window: find first contiguous run of 'count' AVAILABLE seats
    //    within the same row, closest to center (lower seat numbers often preferred)
    // 3. Try reserve via Lua. If another user took one of the seats, retry a few times.
    
    List<SeatInfo> sectionSeats = loadSectionSeats(eventId, section);
    // Group by row, scan each row for contiguous AVAILABLE windows
    for (Row row : groupByRow(sectionSeats)) {
        List<String> window = findContiguousAvailable(row, count);
        if (window != null) return window;
    }
    return Collections.emptyList(); // No adjacent block available
}
```

**Why not use a database query for best-available?** Under 50K TPS surge, a PostgreSQL `SELECT ... WHERE status = 'AVAILABLE' ORDER BY row, number LIMIT N FOR UPDATE` would create massive lock contention. The Redis Lua approach keeps the hot path lock-free (single-threaded atomicity).

The Java scan is a candidate generator, not the source of truth. Another user may reserve the candidate seats before the Lua script runs. In that case the Lua script returns `SEAT_UNAVAILABLE`, and the service retries candidate generation a small bounded number of times or asks the user to choose another section.

---

## 7. Surge Control: Queue-Based Fairness

### The Problem with No Queue

Without a queue, when 500K users click "Reserve" simultaneously:
- 500K HTTP requests hit the hold service
- Service pods OOM or thread-pool exhaust
- Random subset of requests succeed (unfair)
- Users see `500 Internal Server Error` (bad UX)

### Virtual Waiting Room Pattern

```text
User                   Waiting Room                  Hold Service
 |                          |                              |
 |-- 1. Join sale --------->|                              |
 |<- 2. 202 Position ------|                              |
 |                          |                              |
 |-- 3. Poll status ------>|                              |
 |<- 4. Admission token ---|                              |
 |                          |                              |
 |-- 5. Reserve + token ---------------------------------->|
 |<----------------------- 6. 200 Hold ID / Sold out ------|
```

### Queue Design Decisions

| Decision | Choice | Alternative | Tradeoff |
| :--- | :--- | :--- | :--- |
| **Queue type** | Virtual waiting room using Redis sorted set/list + HMAC admission tokens | SQS FIFO for interactive holds | Waiting room controls admission while the actual hold request remains synchronous. SQS is better for async jobs than visible queue positions. |
| **Drain rate** | 5,000 admissions/sec (tuned to hold service capacity) | Unlimited | Controlled admission prevents inventory service overload. Rate = f(Redis Lua throughput, target P99) |
| **Fairness** | FIFO (first-come-first-served) | Random / lottery | FIFO is perceived as fair. Lottery is better for extreme ratios (e.g., 100 tickets, 5M users) but users prefer "I was earlier" over random chance. |
| **Position updates** | Client polls every 2s | Server-sent events / WebSocket | Polling is simpler. SSE/WebSocket at 500K connections is possible but more operationally expensive. |
| **Queue activation** | Only for the first 5 minutes of on-sale, or when TPS > 10K | Always on | Queue overhead is unnecessary at steady-state. A circuit-breaker activates the queue when `hold.request_rate > 10,000/sec`. |

### Queue anti-gaming:
- **One reservation per user per event**: Enforced by `userId` in the queue. Duplicate submissions return the same queue position.
- **Position token**: HMAC-signed token prevents users from fabricating queue positions.
- **Admission token**: Short-lived HMAC token authorizes a user to call Hold Service for one event within a small time window.
- **Bot detection**: CAPTCHA challenge before entering queue for flagged IPs (abnormal request patterns).

---

## 8. Caching Strategy

| Data | Cache | TTL | Invalidation | Consistency |
| :--- | :--- | :--- | :--- | :--- |
| Event metadata (title, date, venue) | CDN (CloudFront) | 5 min | On admin update: CDN invalidation | Eventually consistent (acceptable) |
| Seat map / availability | CDN-cached snapshots generated from Redis replica | **1–3s** | Snapshot regenerated every 1s during surge | 1–3s stale. User may see seat as available, attempt hold, get "SEAT_UNAVAILABLE" → acceptable. |
| Section-level availability counts | Application cache (Caffeine) | 500ms | Redis keyspace notification on state change | Near-real-time aggregate for UI |
| Individual seat status | Redis primary (via Lua script) | No TTL (always live) | Lua script is the source of truth | **Strongly consistent** (hold/checkout path) |
| Pricing | CDN | 30s | Low change frequency | Eventually consistent |

### Why Seat Map Can Be Eventually Consistent

During a high-demand sale, the seat map changes thousands of times per second. Showing a perfectly consistent map is both impossible (client rendering takes 200ms, already stale) and unnecessary. What matters:

1. **Availability is aspirational**: User sees a seat as available → clicks reserve → if taken, instant feedback ("Seat no longer available, please try another"). Cost: one wasted round-trip (<200ms).
2. **Checkout is authoritative**: The Lua script is the single source of truth. It never oversells regardless of what the UI shows.
3. **CDN absorbs 99% of read load**: 200K seat-map requests/sec → CDN serves cached snapshots; only snapshot generation reads from Redis.

---

## 9. Payment Integration & Reconciliation

### Payment Flow

```text
User           Order Service             Stripe            Order DB        Redis
 |                   |                      |                  |             |
 |-- 1. Checkout --->|                      |                  |             |
 |                   |-- 2. INSERT ORDER_PAYMENT_PENDING ----->|             |
 |                   |-- 3. Lua HELD -> PAYMENT_PENDING -------------------->|
 |                   |-- 4. POST /payment_intents(confirm) -> |             |
 |                   |                      |                  |             |
 |             +-----+-----+                |                  |             |
 |             | Success   |                |                  |             |
 |             +-----------+                |                  |             |
 |                   |<-- 5. 200 OK --------|                  |             |
 |                   |-- 6. Lua PAYMENT_PENDING -> SOLD -------------------->|
 |                   |-- 7. UPDATE CONFIRMED + seat rows ---->|             |
 |<- 8. 200 E-Ticket-|                      |                  |             |
 |                   |                      |                  |             |
 |             +-----+-----+                |                  |             |
 |             | Ambiguous |                |                  |             |
 |             +-----------+                |                  |             |
 |                   |<-- 5. Timeout -------|                  |             |
 |                   |-- 6. KEEP PAYMENT_PENDING ------------>|             |
 |<- 7. 202 Pending -|                      |                  |             |
```

Every payment call uses the provider's idempotency key. The Redis confirmation script checks that each seat is still `PAYMENT_PENDING` for the same `holdId` and `orderId` before writing `SOLD`.

### Reconciliation Worker (Resolves Ambiguous Payments)

```java
@Scheduled(fixedDelay = 30_000) // Every 30 seconds
public void reconcileAmbiguousPayments() {
    List<Order> pendingOrders = orderRepo.findByStatus("PAYMENT_PENDING");
    
    for (Order order : pendingOrders) {
        PaymentIntent intent = stripe.paymentIntents().retrieve(order.getPaymentIntentId());
        
        switch (intent.getStatus()) {
            case "succeeded" -> {
                boolean confirmed = inventoryService.confirmSeat(
                    order.getSeatIds(), order.getHoldId(), order.getId());
                if (confirmed) {
                    orderRepo.updateStatus(order.getId(), "CONFIRMED");
                    notificationService.sendETicket(order);
                } else {
                    stripe.refunds().create(order.getPaymentIntentId());
                    orderRepo.updateStatus(order.getId(), "REFUNDED_HOLD_LOST");
                }
            }
            case "canceled", "requires_payment_method" -> {
                inventoryService.releaseSeats(order.getSeatIds(), order.getHoldId(), order.getId());
                orderRepo.updateStatus(order.getId(), "DECLINED");
                notificationService.sendPaymentFailed(order);
            }
            case "processing" -> {
                if (order.getCreatedAt().isBefore(Instant.now().minus(Duration.ofMinutes(10)))) {
                    // Timeout: void the charge attempt, release seats
                    stripe.paymentIntents().cancel(order.getPaymentIntentId());
                    inventoryService.releaseSeats(order.getSeatIds(), order.getHoldId(), order.getId());
                    orderRepo.updateStatus(order.getId(), "TIMED_OUT");
                }
                // Else: still processing, check again next cycle
            }
        }
    }
}
```

### Proving Expired Hold Cannot Race with Late Payment

**Concern**: Hold expires at $t = 10\text{min}$. Payment confirmation arrives at $t = 10\text{min} + 200\text{ms}$. Does the payment succeed for a seat that was just released?

**Proof by state machine**:
1. Hold expires → Expiry worker executes Lua: `IF state == "HELD" AND holdId == H1 THEN state = "AVAILABLE"`
2. Payment starts before hold expiry → Order service executes Lua: `IF state == "HELD" AND holdId == H1 THEN state = "PAYMENT_PENDING"`
3. Payment confirmation → Order service executes Lua: `IF state == "PAYMENT_PENDING" AND holdId == H1 AND orderId == O1 THEN state = "SOLD"`
4. Redis is single-threaded. One script executes first.
5. **Case A**: Expiry runs before payment starts → state = AVAILABLE. Payment-start Lua sees `state != HELD` → no charge is attempted.
6. **Case B**: Payment-start runs first → state = PAYMENT_PENDING. Expiry Lua sees `state != HELD` → no-op.
7. **Case C**: Payment succeeds but confirmation cannot set SOLD because state no longer matches `holdId/orderId` → order is not confirmed and payment is refunded.
8. **In all cases**: seat is in exactly one state. No oversell.

The key rule is: never mark the order `CONFIRMED` until the Redis confirmation script successfully changes the matching `PAYMENT_PENDING` seats to `SOLD`.

---

## 10. Failure Points & Recovery

| Failure | Impact | Detection | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- |
| **Redis primary crash** | Ephemeral holds may be lost; confirmed DB orders remain durable | Redis failover; inventory consistency checks | Promote replica if safe. Rebuild `SOLD` seats from PostgreSQL confirmed orders. Unpaid holds are soft reservations and users retry. `PAYMENT_PENDING` orders are reconciled by payment worker. | < 15s failover; rebuild event-dependent |
| **Hold expiry worker lag** | Seats stuck in HELD past expiry | Redis sorted-set lag metric: expired holds still present | Expiry workers poll `hold_expiry` zset every second and release with Lua. Sweeper repairs holds older than expiry + 2min. | ±2s target, <3min repair |
| **Payment provider outage** | No checkouts can complete | Payment API error rate > 50% for > 30s | Circuit breaker: stop accepting new checkouts, extend hold duration by 5 min (prevent expiry during outage). Display "Payment temporarily unavailable" to users. | Depends on provider |
| **On-sale thundering herd crashes hold service** | Users see 503 errors | Request rate > capacity threshold | Virtual waiting room activates at 10K TPS and issues admission tokens at controlled rate. Hold service remains synchronous for admitted users. | < 5s (queue activation) |
| **Oversell detected** (should be impossible) | Two orders for same seat | Post-order audit: `SELECT seat_id, COUNT(*) FROM order_seats WHERE status='CONFIRMED' GROUP BY seat_id HAVING COUNT(*) > 1` | Immediately cancel the later order + auto-refund. Alert P0 to engineering (indicates a Lua script bug or Redis state corruption). | < 5min (automatic) |
| **Seat map CDN showing stale availability** | Users click "Reserve" on sold-out seats | Metric: `hold.unavailable_rate` > 30% | Regenerate snapshots every 1s during surge and show section-level scarcity warnings. Checkout/hold path remains authoritative. | Config change |
| **Bot scalping** | Bots hold seats to resell at markup | Rate limiting per IP/user + CAPTCHA + device fingerprinting | Block IPs exceeding 10 hold attempts/minute. Require CAPTCHA for flagged sessions. Implement purchase limits (max 4 tickets per user per event). | By design |
| **Adjacent seat algorithm returns suboptimal seats** | User gets seats in different rows | Metric: `adjacent_seat.failure_rate` | Expose "best available" option that scans all sections. Allow user to reject and request new allocation. Progressively relax adjacency constraint (same section > same row > nearby rows). | By design |

---

## 11. Metrics, Tracing & Observability

### Key Metrics

| Metric | Type | Alert Threshold |
| :--- | :--- | :--- |
| `ticketing.hold.tps` | Counter rate | > 50K → surge queue should be active |
| `ticketing.hold.latency_p99` | Histogram | > 100ms → Redis contention or backlog |
| `ticketing.hold.unavailable_rate` | Gauge (%) | > 40% → seat map too stale or event nearly sold out |
| `ticketing.queue.depth` | Gauge | > 100K → queue drain rate too slow |
| `ticketing.queue.wait_time_p99` | Histogram | > 120s → users abandoning |
| `ticketing.checkout.success_rate` | Gauge (%) | < 60% → payment or hold expiry issue |
| `ticketing.payment.timeout_rate` | Gauge (%) | > 5% → payment provider degradation |
| `ticketing.payment.pending_count` | Gauge | > 100 for > 5min → reconciliation worker stalled |
| `ticketing.seats.sold_count` (per event) | Gauge | Informational — demand monitoring |
| `ticketing.seats.held_count` (per event) | Gauge | > 90% of capacity → warn "almost sold out" |
| `ticketing.expiry.release_count` | Counter | Spike → users abandoning checkouts |
| `ticketing.oversell.count` | Counter | > 0 → **P0 incident** |
| `ticketing.bot.blocked_count` | Counter | Informational — anti-scalping effectiveness |

### Distributed Tracing

```
[traceId: tix-abc123]
  [span: queue.enqueue]                   ← 5ms (tag: position=14392)
  [span: queue.wait]                      ← 30-90s (tag: position updates)
  [span: hold.reserve_seats]              ← 2ms
    [span: redis.lua.check_available]     ← 0.5ms
    [span: redis.lua.set_held]            ← 0.5ms
    [span: redis.zadd_hold_expiry]        ← 1ms (tag: ttl=600s)
  
[traceId: tix-abc123]  (user completes checkout)
  [span: order.checkout]                  ← 3s total
    [span: redis.lua.validate_hold]       ← 1ms
    [span: payment.charge]                ← 2.5s (tag: provider=stripe)
    [span: redis.lua.set_sold]            ← 1ms
    [span: db.insert_order]               ← 10ms
    [span: notification.send_eticket]     ← async
```

### On-Sale War Room Dashboard

During major on-sale events, a dedicated real-time dashboard shows:
- **Sold / Held / Available** breakdown (live gauge, updates every 1s)
- **Queue depth and drain rate** (line chart)
- **Payment success/failure/timeout rates** (pie chart, 30s window)
- **Error rate by endpoint** (bar chart)
- **Top blocked IPs** (bot detection table)

---

## 12. Self-Evaluation Checklist
- [x] **Service Boundaries**: Catalog, Availability, Hold, Order, Expiry, and Reconciliation services with clear data ownership.
- [x] **Seat State Machine**: 5-state lifecycle with `PAYMENT_PENDING` for ambiguous payment outcomes.
- [x] **Atomic Hold (Redis Lua)**: All-or-nothing multi-seat reservation with JSON state per seat.
- [x] **Surge Control**: Virtual waiting room with FIFO queue, drain-rate control, and bot detection.
- [x] **Payment Reconciliation**: Idempotent charges, timeout handling, and reconciliation worker for ambiguous outcomes.
- [x] **Expired Hold vs Late Payment Race**: Formal proof that Redis single-thread serialization prevents oversell.
- [x] **Caching Strategy**: CDN (1–3s stale) for reads, Redis primary (strongly consistent) for writes, with tradeoff justification.
- [x] **Adjacent Seat Algorithm**: Sliding-window approach with progressive constraint relaxation.
- [x] **Failure Points & Recovery**: 8 failure modes including oversell detection, bot scalping, and payment outage.
- [x] **Metrics & Tracing**: On-sale war room dashboard, oversell P0 alert, queue health, and payment reconciliation metrics.
