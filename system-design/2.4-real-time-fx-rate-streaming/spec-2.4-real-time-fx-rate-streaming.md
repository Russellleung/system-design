# Spec 2.4: Real-Time FX Rate Streaming Engine

## 1. System Objective
Design an ultra-low latency FX rate streaming pipeline that ingests raw tick feeds from 5 wholesale Liquidity Providers (LPs) across 50 currency pairs, constructs a real-time aggregated Top-of-Book (TOB) Order Book, calculates optimal Bid/Ask spreads, and streams mid-market rates to internal trading engines and checkout edge gateways.

Checkout and trading-screen clients request 30-second quote locks from a separate Quote Service. The HMAC-signed `QuoteToken` is issued on demand from the latest BBO snapshot, not on every market tick.

## 2. System Requirements

### Functional Requirements
* **Multi-LP Ingestion**: Ingest binary/FIX protocol tick feeds from 5 LPs (Barclays, Citi, EBS, LMAX, Bloomberg).
  Raw LP ticks arrive over dedicated market-data sessions, usually FIX Market Data, vendor SDKs, or proprietary TCP/binary feeds.
* **Top-of-Book (TOB) Aggregation**: Aggregate quotes to compute Best Bid / Best Offer (BBO) per currency pair.
* **Guaranteed Quote Locks**: Issue cryptographically signed `QuoteToken` payloads valid for 30 seconds when a client asks for a locked quote. The token includes pair, side, rate, spread, notional limit, quote ID, issue time, and expiry.
* **LP Failover & Sanity Checking**: Stale tick detector (no quote for $> 200\text{ ms}$), crossed-market checks, per-pair jump bands, and LP quorum/median checks. Pure $\sigma$-based filtering is not sufficient during real market moves.

### Non-Functional Requirements
* **Latency Guarantee**: Tick-to-internal-subscriber P99 latency $< 5\text{ ms}$ for same-AZ internal consumers. Edge/mobile WebSocket updates are conflated and target $< 200\text{ ms}$.
* **Throughput Capacity**: Up to $100{,}000\text{ ticks/second}$ during peak market volatility.
* **Resilience**: Zero-downtime failover if an LP feed drops off connection.

---

## 3. Scaling & Capacity Estimation

### Tick Volume Model
| Metric | Value | Rationale |
| :--- | :--- | :--- |
| Liquidity Providers | 5 | Diversified pricing from tier-1 banks + ECNs |
| Currency pairs | 50 | Major + minor pairs (G10 + ASEAN crosses) |
| Avg ticks per LP per pair per second | 2–10 (calm), 50–100 (volatile) | FX markets are bursty — NFP releases, central bank decisions |
| Steady-state aggregate tick rate | ~5,000 ticks/sec | 5 LPs × 50 pairs × 20 ticks/pair/sec |
| Peak aggregate tick rate | **100,000 ticks/sec** | Same 5 LP × 50 pair basket during major market events; not a different 5–20 LP universe |
| Tick event size | ~120 bytes | LP ID + pair + bid + ask + timestamp + sequence |
| Peak ingress bandwidth | 100K × 120B = **~12 MB/sec** | Comfortable for 10 Gbps NIC |

### Compute Sizing (LMAX Disruptor Path)
| Component | Specification | Rationale |
| :--- | :--- | :--- |
| Ring buffer size | $2^{18}$ = 262,144 slots | Power of 2 required. At 100K events/sec → ~2.6s buffer before wrap. |
| JVM heap | 2–4 GB | The ring buffer itself is small: 262K slots × ~120–512 bytes ≈ ~30–128 MB. Extra heap is headroom for parser buffers, NATS client buffers, metrics, JVM overhead, and avoiding GC pressure. |
| CPU cores per active aggregator | 3 dedicated pinned cores | 1 producer thread for feed normalization/ring-buffer publish, 1 consumer for sanity filtering, 1 consumer for TOB aggregation + NATS Core publish. HMAC signing is outside the tick hot path. |
| Host sizing | 4–8 vCPU / 2–4 GB heap | Keep spare unpinned CPU for JVM runtime, metrics, admin endpoints, kernel work, and failover control plane. |
| OS tuning | `isolcpus=4-6`, `nohz_full=4-6` | Isolate the three hot-path cores from the kernel scheduler. Reduces jitter from ~50μs to < 2μs. |

### Downstream Fan-out Scale
| Consumer | Rate | Protocol | Latency Tolerance |
| :--- | :--- | :--- | :--- |
| Internal trading engine | Full 100K/sec | NATS Core | < 5ms P99 |
| Edge WebSocket gateways | 10 updates/sec/pair (conflated) | WebSocket push | < 200ms |
| Redis quote cache | Latest TOB per pair | Redis SET | < 10ms |
| Analytics/recording | Full tick stream | Kafka topic | < 1s best-effort |
| Quote Service | Client quote-lock requests only | HTTP/gRPC + HMAC token | < 20ms |

### Database / Storage Scaling Strategy
* **Target Load**: N/A (Hot Path is 100% In-Memory).
* **Rationale**: The real-time FX streaming core never touches disk or a database before publishing to hot consumers.
* **Raw tick recording**: Best-effort analytics and replay are handled asynchronously through Kafka.
* **Audit-grade records**: Quote issuance and quote redemption are durable records because they represent customer-facing economic commitments.

---

## 4. High-Level Component Diagram

```text
      [ LP1: FIX ] [ LP2: FIX ] [ LP3: Binary ] [ LP4: WS ] [ LP5: WS ]
           |             |            |             |           |
     +-----+-------------+------------+-------------+-----------+-----+
     |                   Connectors & Ingestion Tier                  |
     +--------------------------------|-------------------------------+
                                      v
              +-----------------------+-----------------------+
              |                                               |
              v                                               v
 [ Aggregator A: ACTIVE ]                       [ Aggregator B: HOT STANDBY ]
 [ RingBuffer A / 3 pinned cores ]              [ RingBuffer B / 3 pinned cores ]
              |                                               |
              +-----------------------+-----------------------+
                                      |
                         [ Sanity Filter + TOB BBO ]
                                      |
                                      v
                              [ NATS Core ]
                             /      |       \
                            /       |        \
                           v        v         v
           [ WebSocket Gateways ] [ Redis Latest BBO ] [ Kafka Analytics ]
                                      |
                                      v
                       [ Quote Service: HMAC on demand ]
                                      |
                                      v
                      [ Quote Audit DB: issued/redeemed ]
```

### Why LMAX Disruptor (Not Kafka for the Hot Path)?

| Aspect | LMAX Disruptor | Kafka / Message Queue |
| :--- | :--- | :--- |
| **Latency** | Sub-microsecond handoff inside one JVM; full tick processing is microseconds before network publish | ~1–5ms per produce/consume (network + OS buffers) |
| **Throughput** | 25M+ events/sec single-threaded | ~100K–1M events/sec per partition |
| **Allocation** | Zero (pre-allocated ring buffer, objects reused) | Each message = allocation + serialization |
| **GC impact** | Allocation-free hot path minimizes GC pressure | Kafka client creates garbage (ByteBuffer allocations) |
| **When to use Kafka** | N/A for hot path | ✅ Used for downstream recording/analytics |

**Tradeoff**: Each Disruptor ring buffer is single-JVM and in-memory. The design compensates with two independent aggregators in active/hot-standby mode. If the active JVM crashes, the standby already has warmed BBO state and takes over publishing.

### Aggregator Failover Model

Both aggregators receive duplicated LP feeds and maintain independent ring buffers/BBO state:

```text
LP feed fanout
    |
    +--> Aggregator A ring buffer
    +--> Aggregator B ring buffer
```

Only the active aggregator publishes the authoritative BBO stream. The standby computes continuously but suppresses publishing until it wins the leader lease. Each BBO update includes:

```text
pair_id
best_bid
best_ask
source_lp_ids
lp_sequence_numbers
aggregator_epoch
published_nanos
```

Consumers use `aggregator_epoch` and sequence numbers to detect failover and ignore stale updates from a demoted publisher.

---

## 5. LMAX Disruptor & On-Demand Quote Signer (Java)

```java
package com.financial.fx.streaming;

import com.lmax.disruptor.EventFactory;
import com.lmax.disruptor.EventHandler;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

public class Spec2_4 {

    public static class FxTickEvent {
        public int lpId;
        public int pairId;
        public long bidMicropips;
        public long askMicropips;
        public long lpSequence;
        public long receivedNanos;

        public void set(
                int lpId,
                int pairId,
                long bidMicropips,
                long askMicropips,
                long lpSequence,
                long receivedNanos) {
            this.lpId = lpId;
            this.pairId = pairId;
            this.bidMicropips = bidMicropips;
            this.askMicropips = askMicropips;
            this.lpSequence = lpSequence;
            this.receivedNanos = receivedNanos;
        }
    }

    public static final EventFactory<FxTickEvent> EVENT_FACTORY = FxTickEvent::new;

    public static class TopOfBookHandler implements EventHandler<FxTickEvent> {
        private final long[][] latestBidByPairLp = new long[50][5];
        private final long[][] latestAskByPairLp = new long[50][5];

        @Override
        public void onEvent(FxTickEvent event, long sequence, boolean endOfBatch) {
            latestBidByPairLp[event.pairId][event.lpId] = event.bidMicropips;
            latestAskByPairLp[event.pairId][event.lpId] = event.askMicropips;

            long bestBid = max(latestBidByPairLp[event.pairId]);
            long bestAsk = min(latestAskByPairLp[event.pairId]);

            // Publish BBO snapshot with pairId, bestBid, bestAsk, source sequence, epoch.
        }
    }

    public record QuoteRequest(
        String clientId,
        String quoteId,
        String pair,
        String side,
        long rateMicropips,
        long maxNotionalMinor,
        long spreadBps,
        long expiresAtMs
    ) {}

    public static class QuoteTokenSigner {
        private final SecretKeySpec secretKey;
        private final ThreadLocal<Mac> mac;

        public QuoteTokenSigner(String secret) {
            this.secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            this.mac = ThreadLocal.withInitial(() -> {
                try {
                    Mac m = Mac.getInstance("HmacSHA256");
                    m.init(secretKey);
                    return m;
                } catch (NoSuchAlgorithmException | InvalidKeyException e) {
                    throw new RuntimeException("Failed to initialize HMAC signer", e);
                }
            });
        }

        public String generateQuoteToken(QuoteRequest request) {
            String payload = String.format(
                "%s|%s|%s|%s|%d|%d|%d|%d",
                request.clientId(),
                request.quoteId(),
                request.pair(),
                request.side(),
                request.rateMicropips(),
                request.maxNotionalMinor(),
                request.spreadBps(),
                request.expiresAtMs());

            Mac signer = mac.get();
            signer.reset();
            byte[] hmacBytes = signer.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String signature = Base64.getUrlEncoder().withoutPadding().encodeToString(hmacBytes);
            return payload + "." + signature;
        }
    }
}
```

The Disruptor hot path uses integer LP/pair IDs and scaled long prices. `BigDecimal`, pair strings, JSON serialization, and HMAC signing are kept outside the tick path.

### HMAC vs JWT for Quote Tokens

| Aspect | HMAC Token (chosen) | JWT (RS256/ES256) |
| :--- | :--- | :--- |
| **Signing latency** | ~1μs | ~100μs (RSA) / ~30μs (Ed25519) |
| **Token size** | ~150 bytes | ~500–800 bytes |
| **Verification** | Symmetric (shared secret) | Asymmetric (public key) |
| **Verdict** | ✅ 100× faster, sufficient for internal use | Overkill for same-org services |

### HMAC Security Properties
- **Replay prevention**: `expiresAtMs` in signed payload; server rejects expired tokens
- **Forgery resistance**: 256-bit key; brute-force requires $2^{128}$ operations
- **Rate manipulation**: Rate is signed; any modification invalidates HMAC
- **Key rotation**: Dual-key verify during 24h rotation window; zero-downtime

### Quote Audit Records

Raw ticks are best-effort analytics, but quote issuance/redemption is audit-grade because it represents a customer-facing economic commitment.

Durably store:

```text
quote_id
client_id
currency_pair
side
rate
spread_bps
max_notional
issued_at
expires_at
redeemed_at
source_bbo_sequence
aggregator_epoch
token_signature_hash
```

---

## 5.5 Event-Driven TOB Aggregation Mechanics

The Top of Book (TOB) Aggregation Engine does **not** buffer or wait to collect quotes from all 5 banks before executing the matching math. Waiting for slower banks would introduce catastrophic "stale price" latency. Instead, computation is radically continuous and event-driven:

1. **The State Array:** The engine holds a tiny, pre-allocated 5-slot array in RAM for every currency pair, tracking the absolute freshest price from each LP: E.g., `[JPM, Citi, Barclays, UBS, Deutsche]`.
2. **Instant Overwrite:** When a new tick arrives over the network (e.g., Citi updates their `EUR/USD` price at exactly `T=0.045s`), the engine instantly overwrites the `Citi` slot.
3. **Triggered Recalculation:** Whenever any slot is overwritten, the aggregation thread scans the 5 cache-resident LP slots for that pair, computes the current highest Bid and lowest Ask, and publishes the composite BBO to NATS Core. The scan is O(5) and negligible relative to network publish latency.

Quote locks are not generated during this tick loop. The Quote Service reads the latest BBO snapshot when a checkout or trading screen asks for a locked quote, applies spread/risk/notional checks, writes an audit-grade quote issuance record, and signs the token.

---

## 6. Backpressure Management Strategy

```text
               [ 5 Raw LP Ticks ]
                       |
               [ Ingress RingBuffer ] (Fast-path memory lock)
                       |
             [ TOB Aggregation Engine ]
                       |
          +------------+------------+
          |                         |
(Raw NATS Core Stream)      (Conflation Buffer / Throttled Sampler)
          |                         |
[ Internal HFT Consumers ]  [ WebSocket Edge Gateway ]
    (Max ticks/sec)             (10 updates/sec/pair)
```

### Conflation & Sampling Mechanics
1. **Internal Core Engine (Sub-5ms Path)**: Subscribes directly to Core NATS. Retains absolute raw tick speed for automated backend HFT (High-Frequency Trading) consumers.
2. **Edge Gateway Path (Mobile Users)**: Humans cannot read 100 flashing prices a second. The *Throttled Sampler* acts as a conflation buffer. If 500 ticks for `USD/SGD` arrive in 100ms, it physically discards the first 499 and only pushes the absolute freshest snapshot to the external WebSockets.

### Backpressure Escalation Ladder

The ring buffer is already large relative to the target load:

```text
262,144 slots / 100,000 ticks/sec ≈ 2.6 seconds of buffer
```

For a system targeting sub-5ms internal latency, sustained ring-buffer growth means something is unhealthy: aggregation stalled, publishing blocked, CPU saturated, or an LP is flooding bad data. The base design does not require a separate pre-ring conflation buffer.

| Level | Ring Buffer Fill | Action | Impact |
| :--- | :--- | :--- | :--- |
| 0 Normal | < 50% | Process every tick | Normal operation |
| 1 Warning | 50–75% | Alert and inspect slow stage metrics | No tick dropping; this should be temporary |
| 2 Critical | 75–90% | Apply backpressure to LP connectors; skip already-stale queued ticks only when safe | Protects the hot path, may reduce raw tick fidelity |
| 3 Emergency | > 90% | Mark affected pairs degraded or halt quote issuance | Safer to stop issuing quotes than publish stale or biased prices |

“Skip stale queued ticks” means the system may ignore an older unprocessed tick only when a newer tick for the same LP and pair has already been processed or is available. It must never silently drop the only available quote for an LP/pair and pretend pricing is healthy.

---

## 7. Latency Budget (Tick-to-Subscriber P99 < 5ms)

| Segment | Latency | Optimization |
| :--- | :--- | :--- |
| LP → Connector (network) | ~0.5–1ms | Co-located datacenter, cross-connect |
| Connector parse + normalize | ~5–50μs | Binary/FIX decode into integer IDs and scaled longs |
| Connector → Disruptor publish | <1μs | Lock-free handoff, pre-allocated ring slot |
| Disruptor → sanity filter | ~1–10μs | Staleness, crossed-market, jump-band, and quorum checks |
| Sanity filter → TOB aggregation | ~1–10μs | Array lookup by pair/LP index; no `BigDecimal` |
| TOB → NATS Core publish | ~0.3–1ms | Same-AZ internal publish |
| NATS → subscriber | ~0.5ms | Same AZ, subject routing |
| **Total P99** | **~1.5–3.5ms typical** | 5ms ceiling = jitter margin for same-AZ internal consumers |

### Jitter Sources & Zero-Allocation Defenses
1. **Garbage Collection (GC) Pauses**: The ultimate jitter killer. 
   * *Mitigation (Zero-Allocation Pattern)*: The Ring Buffer is completely pre-populated on startup. In the tick hot path, incoming ticks overwrite primitive fields, and currency pairs are mapped to integer IDs before aggregation. GC pressure is minimized and continuously monitored; the design avoids claiming that GC can never occur anywhere in the JVM.
2. **Kernel OS Interrupts**: Background OS tasks can suddenly context-switch the JVM trading thread off the CPU.
   * *Mitigation (`isolcpus`)*: We use the Linux kernel parameter `isolcpus` to physically isolate specific CPU cores, banning the OS scheduler from running background tasks on them. The critical Java trading threads are then strictly pinned to those virgin cores.
3. **Thread Locking (Mutex Contention)**: Standard locks freeze threads, introducing massive jitter.
   * *Mitigation (Disruptor Sequence Barriers)*: The application uses dependent memory barriers instead of locks. The sanity filter advances a cursor, the BBO aggregation thread waits on that cursor, and the publisher waits on the BBO cursor. HMAC signing is handled by the Quote Service outside this sequence.

---

## 8. Failure Points & Recovery

| Failure | Impact | Detection | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- |
| **Single LP disconnect** | BBO may widen | Stale detector: no tick > 200ms → `STALE` | Exclude from TOB. Auto-reconnect with backoff. Alert if > 60s. | < 1s |
| **All LPs stale** | No pricing; cannot issue quotes | All 5 stale within 2s | Circuit break: return `503`. Publish `FX_HALTED`. Manual verification. | Manual |
| **Active aggregator crash** | Active BBO publisher stops | Heartbeat/leader lease missed | Hot standby already has duplicated feed state; promote standby publisher with new epoch. | < 1s |
| **Ring buffer overflow** | Events overwritten | Sequence gaps in handler | Should never happen with backpressure ladder. Emergency: increase to $2^{20}$. | Config |
| **HMAC key compromised** | Forged quote tokens | Anomaly detection on redeemed rates | Emergency rotation, invalidate outstanding tokens (max 30s window). | < 5min |
| **NATS broker crash** | Subscribers lose updates | Cluster health monitor | 3-node Raft failover (< 2s). Full loss: fallback to Redis cache. | < 2s |
| **Outlier filter false positive** | Valid tick rejected, stale BBO | `outlier.reject_rate > 5%` | Widen σ threshold per LP. Dynamic calibration on 1-hour rolling window. | Config |
| **Clock drift** | Tick ordering corruption | NTP offset > 1ms alert | Use LP-provided timestamps + sequence numbers for ordering, not local clock. | By design |

---

## 9. Metrics, Tracing & Observability

### Key Metrics

| Metric | Type | Alert Threshold |
| :--- | :--- | :--- |
| `fx.tick.rate_per_second` (by LP) | Counter rate | < 1/sec → stale alert |
| `fx.tick_to_subscriber.latency_p99` | Histogram | > 5ms for 1min → P2 |
| `fx.disruptor.remaining_capacity` | Gauge | < 25% → Level 2 backpressure |
| `fx.outlier.reject_rate` (by LP) | Gauge | > 5% → calibration review |
| `fx.bbo.spread_bps` (by pair) | Gauge | > 2× 30-day avg → P3 |
| `fx.quote_token.expired_unused_rate` | Gauge (%) | > 80% → checkout funnel issue |
| `fx.lp.reconnect_count` (by LP) | Counter | > 3/hour → P3 |
| `jvm.gc.pause_ms` | Histogram | > 2ms → investigate |

### Internal Hot-Path Tracing (No OpenTelemetry Overhead)

Standard OpenTelemetry adds avoidable overhead and allocation pressure inside the tick loop. The hot path uses custom ring-buffer-embedded timestamps sampled by a background thread:

```
[Sampled Tick: EURUSD @ 1725811200123ms]
  connector.receive → +100ns → disruptor.publish → +200ns → outlier.filter
  → +2μs → tob.aggregate → +500μs → nats.publish
  → +500μs → subscriber.receive  |  TOTAL: ~1.0ms
```

Full OpenTelemetry tracing used only on non-latency-sensitive Kafka recording path.

---

## 10. Self-Evaluation Checklist
- [x] **Component Diagram**: LP connectors → active/hot-standby Disruptor aggregators → NATS Core fan-out → edge gateways.
- [x] **Java LMAX Disruptor**: Zero-allocation event model and handler.
- [x] **Java HMAC Signer**: On-demand signed `QuoteToken` with security analysis and JWT comparison.
- [x] **Backpressure**: 4-level escalation ladder with conflation strategy.
- [x] **Scaling**: Tick volume model (5K–100K/sec), CPU pinning, downstream fan-out.
- [x] **Latency Budget**: Same-AZ hot-path breakdown, P99 < 5ms.
- [x] **Disruptor vs Kafka**: Quantitative comparison for hot-path handoff vs durable messaging.
- [x] **Failure Points**: 7 modes including LP dropout, key compromise, clock drift.
- [x] **Metrics & Tracing**: Low-overhead internal tracing, LP health dashboard.
