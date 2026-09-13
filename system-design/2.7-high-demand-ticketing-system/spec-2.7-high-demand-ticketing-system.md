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
* **Redis Inventory Shards**: Each event is assigned to one authoritative Redis inventory shard by default. One Redis shard can own many events, but one event should not be spread across many Redis shards unless the event is deliberately partitioned by section/zone.
* **Important Redis Cluster constraint**: A Lua script is atomic only for keys in the same Redis hash slot. Multi-seat holds must operate within one event/section shard, or use hash tags such as `{eventId}` / `{eventId:sectionId}` so all relevant keys are co-located.

### Application Server Scaling (Hold Service)
* **Target Load**: 50,000+ users/sec may try to enter the waiting room, but only admitted users can reach Hold Service.
* **Admitted hold rate**: Baseline ~5,000 hold attempts/sec per hot event. This is intentionally below the Redis inventory shard limit.
* **Hardware**: 4-8 vCPU / 16-32 GB RAM nodes.
* **Nodes Needed**: Deploy 6-9 Hold Service pods across 3 AZs. More pods help with TLS, token validation, request parsing, and failover, but they do not increase the single Redis inventory shard's Lua execution capacity.
* **True bottleneck**: For one hot event mapped to one Redis inventory shard, Redis Lua execution is the limiting resource. If one event needs materially more than ~5K-20K hold attempts/sec, split the event by section/zone and accept that cross-zone holds are not atomic.

### Why the On-Sale Surge Is the Hard Problem

Steady-state ticketing is trivial (100 TPS). The entire design exists for the **30-second thundering herd** when sales open:
- 500K users load the seat map simultaneously → CDN must absorb 200K+ req/sec
- 50K users may click "Reserve" within 5 seconds → waiting room must throttle this to ~5K admitted hold attempts/sec
- If the system takes 200ms per hold, only 5,000/sec get through → 90% get "sold out" errors → immediate retry storm

---

## 4. Service Architecture

### Simple Mental Model

There are two separate Redis-backed pieces:

1. **Waiting room**: controls how many users are allowed to hit the inventory system.
2. **Inventory shard**: stores authoritative seat state for an event and performs atomic holds.

Kafka is not in the synchronous hold path. Kafka can be used later for analytics, audit streams, or asynchronous notifications, but a user clicking "Reserve" should not wait for Kafka consumer lag.

```text
Many users
    |
    v
Waiting Room
    |
    | admits only a controlled number of users/sec
    v
Hold Service
    |
    | atomic Lua script
    v
Redis Event Inventory Shard
```

For a normal hot event:

```text
event_123 -> Redis shard 7
event_456 -> Redis shard 7
event_789 -> Redis shard 2
```

A shard can own multiple events. But one event has one authoritative inventory owner unless the event is intentionally split by section/zone:

```text
event_123:floor   -> Redis shard 7
event_123:lower   -> Redis shard 8
event_123:upper   -> Redis shard 9
```

Only split by section/zone if cross-section seat holds are not required, because Redis Lua cannot atomically update keys across different hash slots.

```text
                              [ Client ]
                       100K-500K concurrent users
                                  |
                                  v
                         [ CDN / Edge Cache ]
                         ~200K+ seat-map req/sec
                                  |
                  +---------------+----------------+
                  |                                |
                  v                                v
 [ Catalog / Availability Service ]       [ Virtual Waiting Room Service ]
  6-10 pods, 4 vCPU / 16 GB RAM            6-10 pods, 4 vCPU / 16 GB RAM
  cached metadata/seat-map reads            issues admission tokens
                  |                                |
                  | reads snapshots/counts          | enqueue/poll/admit
                  v                                v
 [ Redis Read Replica / CDN Snapshots ]    [ Waiting-Room Redis Cluster ]
  eventually consistent availability        3+ nodes, 8 vCPU / 32-64 GB RAM
                                           list/stream or bucketed ZSET queues
                                                   |
                                                   | admission token ~5K/sec/event
                                                   v
                                          [ Hold Service ]
                                          6-9 pods, 4-8 vCPU / 16-32 GB RAM
                                          validates token; no Postgres write
                                                   |
                                                   | Redis Lua: AVAILABLE -> HELD
                                                   v
                                     [ Redis Event Inventory Shard ]
                                      1 primary + 1 replica per hot shard
                                      16 vCPU / 64-128 GB RAM
                                      disk: AOF + snapshot, 200-500 GB
                                      bottleneck: single-shard Lua execution
                                                   |
                 +---------------------------------+------------------------------+
                 |                                 |                              |
                 | checkout starts                 | expiry ZSET + release Lua     | availability snapshots
                 v                                 v                              v
        [ Order Service ]                  [ Expiry Worker ]           [ Availability Snapshot Job ]
        8-12 pods, 8 vCPU / 32 GB          3-6 pods, 4 vCPU / 8 GB      2-4 pods, 4 vCPU / 8 GB
                 |                                 |                              |
                 | insert CHECKOUT_STARTED          | check live checkout rows       | read Redis inventory
                 v                                 v                              v
        [ Order DB: PostgreSQL ] <----------+                              [ Redis Read Replica /
        16 vCPU / 64 GB primary + replica                                  CDN Snapshot Store ]
        disk: 1-2 TB NVMe/io2/gp3
                 ^
                 |
                 | update payment/order state
                 |
        [ Payment Reconciliation Worker ]
        2-4 pods, 4 vCPU / 8 GB
        reads Order DB, calls Stripe,
        then runs Redis Lua: PAYMENT_PENDING -> SOLD/AVAILABLE
                 |                         ^
                 v                         |
        [ Stripe / Payment Provider ]      |
        external dependency, ~5K payment req/sec peak
                                           |
                           [ Redis Event Inventory Shard ]
```

### Service Boundaries & Responsibilities

| Service | Responsibility | Data Store | Consistency |
| :--- | :--- | :--- | :--- |
| **Catalog Service** | Event metadata, venue, pricing, search | PostgreSQL + Elasticsearch | Eventually consistent (indexed with ~2s lag) |
| **Availability Service** | Seat status reads for UI rendering | CDN snapshots + Redis read replica | Eventually consistent (~1–3s stale via CDN) |
| **Waiting Room** | FIFO admission control before users reach Hold Service | Redis sorted set/list + signed admission token | Fair admission, not inventory authority |
| **Hold Service** | Validate admission token and run atomic seat hold script | Redis event shard primary, Lua script | Strongly consistent for that event/section shard; no Postgres write for temporary holds |
| **Order Service** | Payment orchestration, order persistence | PostgreSQL (ACID) | Strongly consistent |
| **Expiry Worker** | Release expired holds only after checking no live checkout/payment row exists | Redis expiry sorted set + PostgreSQL checkout rows + Lua release script | Idempotent release with ~±2s target |
| **Recon Worker** | Resolve payment timeouts and final payment outcomes | PostgreSQL + Payment API + Redis Lua | Reconcile ambiguous charges and move seats to `SOLD` or `AVAILABLE` |

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

Redis Lua scripts are atomic on a single Redis shard. While the script is running, Redis does not interleave another command on that same shard. That makes this all-or-nothing:

```text
check requested seats are AVAILABLE
mark requested seats HELD
add hold_id to expiry index
```

This guarantee only applies when all keys used by the script are in the same Redis Cluster hash slot. Use hash tags so the seat hash and expiry sorted set for an event/section are co-located:

```text
event:{eventId}:seats
event:{eventId}:hold_expiry
```

The temporary hold path does not write to PostgreSQL. During a high-demand on-sale, writing a durable DB row for every short-lived hold would move the bottleneck from Redis to Postgres and make abandonment expensive. The hot reserve path is:

```text
Client -> Hold Service -> Redis Lua
```

PostgreSQL becomes involved when checkout/payment starts:

```text
Checkout -> Order Service -> PostgreSQL order/payment row
         -> Redis Lua: HELD -> PAYMENT_PENDING
```

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

The waiting room is not the seat inventory store. It is admission control.

It answers:

```text
Who is allowed to try reserving seats right now?
```

The Redis inventory shard answers:

```text
Are these seats still available, and can this hold be created atomically?
```

The waiting room can be implemented with Redis because the operation is small and interactive:

```text
event:{eventId}:queue        sorted set: userId -> joinSequence/joinTime
event:{eventId}:admitted     short TTL set/string: admission token id -> userId
```

For a very hot event, the waiting-room Redis workload can be bucketed because it is not the seat inventory authority:

```text
event:{eventId}:queue:bucket:0
event:{eventId}:queue:bucket:1
event:{eventId}:queue:bucket:2
...
event:{eventId}:queue:bucket:31
```

The admission service drains users fairly from buckets using round-robin or weighted round-robin:

```text
bucket 0 -> admit 150 users
bucket 1 -> admit 150 users
bucket 2 -> admit 150 users
...
repeat until target drain rate is reached
```

This lets the waiting room scale horizontally while preserving approximate fairness. The exact seat correctness still happens later in the inventory Redis shard, where the Lua hold script atomically checks and reserves seats.

For a pure FIFO waiting room, a Redis list or stream is enough:

```text
RPUSH event:{eventId}:queue userId
LPOP  event:{eventId}:queue
```

A sorted set is only needed for the waiting room if the product wants efficient position lookup, cancellation/removal, or priority scoring.

Why use a sorted set in that case? It gives the system ordered admission plus random access by rank:

```text
ZADD queue joinSequence userId
ZRANGE queue 0 4999
ZREM admitted users from queue
```

That lets the system admit the first N users at a controlled drain rate. A plain unordered set would not preserve queue order.

The hold-expiry index is different from the waiting-room queue. It is sorted by `expires_at`, not by arrival time:

```text
ZADD event:{eventId}:hold_expiry expiresAt holdId
```

FIFO order and expiry order are not always the same. Holds can be extended during payment outages, checkout recovery, or operational protection windows. Updating a hold's expiry is just another `ZADD` with the same `holdId` and a new score:

```text
ZADD event:{eventId}:hold_expiry newExpiresAt hold_123
```

Redis sorted set members are unique, so this updates the score in `O(log N)`; no explicit remove-then-add is required.

When a hold is no longer eligible for normal expiry, such as after it moves to `PAYMENT_PENDING`, `SOLD`, or explicit release, the system removes it:

```text
ZREM event:{eventId}:hold_expiry hold_123
```

The expiry worker then finds only genuinely expired holds without scanning all active holds:

```text
ZRANGEBYSCORE event:{eventId}:hold_expiry -inf now LIMIT 0 1000
```

```text
User                   Waiting Room                  Hold Service
 |                          |                              |
 |-- 1. Join sale --------->|                              | ~50K-100K RPS burst, ~5-20ms enqueue
 |<- 2. 202 Position ------|                              | ~5ms response
 |                          |                              |
 |-- 3. Poll status ------>|                              | client polls every 2s; ~50K-250K RPS
 |<- 4. Admission token ---|                              | issued at ~5K RPS; ~5-10ms
 |                          |                              |
 |-- 5. Reserve + token ---------------------------------->| admitted ~5K RPS; Lua hold ~2-10ms
 |<----------------------- 6. 200 Hold ID / Sold out ------| total admitted reserve path ~20-80ms
```

### Queue Design Decisions

| Decision | Choice | Alternative | Tradeoff |
| :--- | :--- | :--- | :--- |
| **Queue type** | Virtual waiting room using Redis sorted set/list + HMAC admission tokens | Kafka/SQS FIFO for interactive holds | Waiting room controls admission while the actual hold request remains synchronous. Kafka/SQS are better for async work than low-latency seat selection. |
| **Drain rate** | 5,000 admissions/sec (tuned to hold service capacity) | Unlimited | Controlled admission prevents inventory service overload. Rate = f(Redis Lua throughput, target P99) |
| **Fairness** | FIFO (first-come-first-served) | Random / lottery | FIFO is perceived as fair. Lottery is better for extreme ratios (e.g., 100 tickets, 5M users) but users prefer "I was earlier" over random chance. |
| **Position updates** | Client polls every 2s | Server-sent events / WebSocket | Polling is simpler. SSE/WebSocket at 500K connections is possible but more operationally expensive. |
| **Queue activation** | Only for the first 5 minutes of on-sale, or when TPS > 10K | Always on | Queue overhead is unnecessary at steady-state. A circuit-breaker activates the queue when `hold.request_rate > 10,000/sec`. |

### What Is the Admission Token?

The admission token is not a ticket and does not reserve a seat. It is only a short-lived permission slip that says:

```text
This user was admitted from the waiting room for event_123.
They may call Hold Service for this event for the next 30-60 seconds.
```

The token is HMAC-signed so users cannot skip the queue by inventing their own token:

```text
token = HMAC(secret, userId + eventId + admittedAt + expiresAt + nonce)
```

Hold Service verifies the token before running the Redis seat-hold Lua script. If the token is missing, expired, or for a different event/user, the request is rejected before it reaches the inventory shard.

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
| Individual active seat status | Redis primary (via Lua script) | No TTL (always live during sale) | Lua script is the active-sale source of truth | **Strongly consistent** (hold/checkout path) |
| Confirmed orders and sold seat assignments | PostgreSQL | Permanent | Order confirmation transaction | Durable source of truth after sale/confirmation |
| Pricing | CDN | 30s | Low change frequency | Eventually consistent |

### Why Seat Map Can Be Eventually Consistent

During a high-demand sale, the seat map changes thousands of times per second. Showing a perfectly consistent map is both impossible (client rendering takes 200ms, already stale) and unnecessary. What matters:

1. **Availability is aspirational**: User sees a seat as available → clicks reserve → if taken, instant feedback ("Seat no longer available, please try another"). Cost: one wasted round-trip (<200ms).
2. **Checkout inventory transition is authoritative**: The Redis Lua script is the active-sale authority for moving seats between `AVAILABLE`, `HELD`, `PAYMENT_PENDING`, and `SOLD`. Confirmed orders are then stored durably in PostgreSQL.
3. **CDN absorbs 99% of read load**: 200K seat-map requests/sec → CDN serves cached snapshots; only snapshot generation reads from Redis.

---

## 9. Payment Integration & Reconciliation

### Payment Flow

```text
User           Order Service             Stripe            Order DB        Redis
 |                   |                      |                  |             |
 |-- 1. Checkout --->|                      |                  |             | ~5K RPS peak, ~5-20ms app routing
 |                   |-- 2. INSERT CHECKOUT_STARTED --------->|             | ~5K RPS, ~5-15ms DB tx
 |                   |-- 3. Lua HELD -> PAYMENT_PENDING -------------------->| ~5K RPS, ~1-5ms Redis Lua
 |                   |-- 4. UPDATE ORDER_PAYMENT_PENDING ---->|             | ~5-15ms DB tx
 |                   |-- 5. POST /payment_intents(confirm) -> |             | ~5K RPS peak, ~100-800ms external
 |                   |                      |                  |             |
 |             +-----+-----+                |                  |             |
 |             | Success   |                |                  |             |
 |             +-----------+                |                  |             |
 |                   |<-- 6. 200 OK --------|                  |             | payment success response
 |                   |-- 7. Lua PAYMENT_PENDING -> SOLD -------------------->| ~1-5ms
 |                   |-- 8. UPDATE CONFIRMED + seat rows ---->|             | ~5-20ms DB commit
 |<- 9. 200 E-Ticket-|                      |                  |             | total checkout usually ~150ms-1s
 |                   |                      |                  |             |
 |             +-----+-----+                |                  |             |
 |             | Ambiguous |                |                  |             |
 |             +-----------+                |                  |             |
 |                   |<-- 6. Timeout -------|                  |             | e.g. >2-5s provider timeout
 |                   |-- 7. KEEP PAYMENT_PENDING ------------>|             | no release
 |<- 8. 202 Pending -|                      |                  |             | user sees pending; recon every 30s
```

Every payment call uses the provider's idempotency key. The Redis confirmation script checks that each seat is still `PAYMENT_PENDING` for the same `holdId` and `orderId` before writing `SOLD`.

### Checkout Start Recovery

There is a possible crash window:

```text
1. Order Service inserts CHECKOUT_STARTED in PostgreSQL
2. Order Service crashes before Redis moves HELD -> PAYMENT_PENDING
```

This is not treated as a completed payment. It is a recoverable checkout-start intent. A reconciliation worker scans `CHECKOUT_STARTED` rows and retries the Redis transition:

```text
if DB order.status == CHECKOUT_STARTED:
    run Redis Lua:
        if seats are HELD for same holdId:
            move HELD -> PAYMENT_PENDING with orderId
            mark DB order = ORDER_PAYMENT_PENDING
            continue payment flow
        else if seats are already PAYMENT_PENDING for same orderId:
            mark DB order = ORDER_PAYMENT_PENDING
        else:
            mark DB order = EXPIRED_BEFORE_PAYMENT
```

The expiry worker must also check PostgreSQL before releasing an expired `HELD` seat. If there is a live `CHECKOUT_STARTED` or `ORDER_PAYMENT_PENDING` row for the same `holdId`, it does not blindly release the seat. It either retries `HELD -> PAYMENT_PENDING` or extends the hold briefly and lets the checkout reconciler finish.

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
1. Checkout starts → Order Service first inserts `CHECKOUT_STARTED` in PostgreSQL for `holdId = H1`.
2. Payment-start transition → Order Service executes Redis Lua: `IF state == "HELD" AND holdId == H1 THEN state = "PAYMENT_PENDING"`.
3. Hold expiry fires → Expiry worker first checks PostgreSQL for a live `CHECKOUT_STARTED` or `ORDER_PAYMENT_PENDING` row for `holdId = H1`.
4. If no checkout row exists, expiry executes Lua: `IF state == "HELD" AND holdId == H1 THEN state = "AVAILABLE"`.
5. If a checkout row exists, expiry does not release blindly. It retries/protects the checkout transition or briefly extends the hold for the checkout reconciler.
6. Payment confirmation → Order service executes Lua: `IF state == "PAYMENT_PENDING" AND holdId == H1 AND orderId == O1 THEN state = "SOLD"`.
7. Redis is single-threaded per shard, so Lua transitions are still serialized.
8. **Case A**: Expiry runs before checkout starts → state = AVAILABLE. Checkout later sees the hold is gone and no charge is attempted.
9. **Case B**: Checkout DB row exists but Redis was not updated yet → expiry sees the DB row and does not release the seat blindly.
10. **Case C**: Payment succeeds but confirmation cannot set SOLD because state no longer matches `holdId/orderId` → order is not confirmed and payment is refunded.
11. **In all cases**: seat is in exactly one state. No oversell.

The key rule is: never mark the order `CONFIRMED` until the Redis confirmation script successfully changes the matching `PAYMENT_PENDING` seats to `SOLD`.

---

## 10. Failure Points & Recovery

### What Happens If Redis Fails?

There are two Redis failure cases:

```text
Waiting-room Redis fails
Inventory Redis fails
```

If the **waiting-room Redis** fails, seat correctness is not directly at risk because the waiting room does not own seats. The system can pause admission, ask users to retry their queue position, or fail over to a replica. This is bad UX, but it does not oversell seats.

If the **inventory Redis shard** for an event fails, the system must stop accepting holds for that event until the shard is recovered or rebuilt. This is because Redis is the active-sale authority for `AVAILABLE / HELD / PAYMENT_PENDING / SOLD` transitions.

Recovery approach:

```text
1. Pause new holds for affected event.
2. Fail over to Redis replica if replica is healthy and recent.
3. Rebuild SOLD seats from PostgreSQL confirmed orders.
4. Rebuild PAYMENT_PENDING seats from PostgreSQL payment-pending orders.
5. Drop or expire ordinary HELD seats that had not started payment.
6. Resume sale with fresh seat-map snapshots.
```

Why are ordinary `HELD` seats allowed to be lost? Because a hold is only a temporary promise before payment starts. Losing it is painful for the user, but it is safer than inventing seat state after Redis loss.

Why rebuild `PAYMENT_PENDING`? Because payment may already be in flight. Releasing those seats could create an oversell if the payment provider later confirms the charge.

Confirmed orders are durable in PostgreSQL. Redis can be rebuilt from them; PostgreSQL should not be rebuilt from Redis.

| Failure | Impact | Detection | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- |
| **Waiting-room Redis crash** | Queue positions/admission may be temporarily unavailable | Redis failover, queue health checks | Pause admission, fail over to replica, or ask users to rejoin with signed position token where available. Seat correctness is unaffected. | < 15s failover; UX-dependent |
| **Inventory Redis primary crash** | Active holds may be lost; affected event must pause holds | Redis failover; inventory consistency checks | Promote replica if safe. If rebuild is needed, reconstruct `SOLD` and `PAYMENT_PENDING` seats from PostgreSQL. Ordinary unpaid `HELD` seats are dropped/expired and users retry. | < 15s failover; rebuild event-dependent |
| **Hold expiry worker lag** | Seats stuck in HELD past expiry | Redis sorted-set lag metric: expired holds still present | Expiry workers poll `hold_expiry` zset every second. Before releasing, they check PostgreSQL for live checkout/payment rows for the same `holdId`; if none exist, release with Lua. Sweeper repairs holds older than expiry + 2min. | ±2s target, <3min repair |
| **Order Service crash after DB checkout row but before Redis update** | DB says checkout started, Redis still says HELD | `CHECKOUT_STARTED` row older than a few seconds | Checkout reconciler retries Redis `HELD -> PAYMENT_PENDING`. Expiry worker checks DB and does not release the hold blindly while the checkout-start row is live. | < 30s |
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
| `ticketing.hold.tps` | Counter rate | > 5K per hot event → inventory Redis is near its planned admitted rate |
| `ticketing.reserve.click_tps` | Counter rate | > 50K attempted reserve clicks → surge queue should be active |
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
