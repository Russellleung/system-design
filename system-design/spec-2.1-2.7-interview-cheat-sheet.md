# Specs 2.1-2.7 Interview Cheat Sheet

Use this right before interview. Keywords, not scripts.

---

## 2.1 Multi-Currency Wallet / Double-Entry Ledger

### Teaches

* double-entry accounting
* immutable ledger
* cached balance
* row locking
* cross-partition transfer
* suspense accounts
* orchestration
* financial invariants

### Core Phrases

* "Every financial event is a balanced journal."
* "Postings are immutable; corrections are reversals."
* "Cached balance is a materialized view, updated atomically with postings."
* "Never compute hot-path balance by summing years of postings."
* "Same-partition transfer is one ACID transaction."
* "Cross-partition transfer uses orchestration plus suspense accounts."
* "Suspense keeps local shard accounting balanced; orchestration tracks distributed progress."

### Key Invariants

```text
sum(debits) = sum(credits)
balance = sum(postings)
cached_balance updated in same transaction as postings
no negative balances unless overdraft facility exists
```

### Concurrency

* `SELECT ... FOR UPDATE`
* lock accounts in sorted ID order
* `READ COMMITTED` + explicit locks
* avoid deadlocks through deterministic lock ordering

### Cross-Shard Transfer

```text
Partition A:
  debit sender
  credit outgoing suspense

Partition B:
  debit incoming suspense
  credit receiver

Orchestrator:
  PENDING -> DEBIT_POSTED -> CREDIT_POSTED -> COMPLETED
```

### Watch-Out Questions

* "Why suspense and orchestrator?"
  * Suspense = accounting correctness.
  * Orchestrator = workflow/progress/retry.
* "Why not two-phase commit?"
  * Avoid distributed transaction dependency in hot path.
* "What if orchestrator crashes after debit?"
  * Durable transfer record + idempotent leg keys.

### Airwallex Relevance

* Wallets
* balances
* payouts
* multi-currency funds
* ledgers
* reconciliation

---

## 2.2 Cross-Border Payment Reconciliation

### Teaches

* batch reconciliation
* S3 data lake
* Parquet
* Spark shuffle
* exact vs fuzzy matching
* canonical model
* idempotent ingestion
* business identity vs content hash

### Core Phrases

* "Use S3/Parquet for large batch datasets, not OLTP row-by-row matching."
* "Exact match first, fuzzy match only for unresolved records."
* "UETR is the best exact key when available."
* "Spark reads files, then shuffles/exchanges by join key."
* "File split is physical read parallelism; hash shuffle is logical grouping."
* "Content hash detects duplicate files, but business identity tracks the statement."

### Matching Stages

```text
1. Ingest external/internal files to S3
2. Normalize to canonical records
3. Exact UETR join
4. Fuzzy candidate generation
5. Deterministic 1:1 resolution
6. Exception queue for ops
```

### Fuzzy Match Keys

Use:

```text
account_number
currency
amount
value_date
counterparty
reference text
```

Phrase:

```text
Fuzzy matching creates candidates; deterministic scoring decides final 1:1 matches.
```

### Spark Mental Model

```text
Read file splits -> parse rows -> shuffle by key -> matching workers receive same-key rows
```

Phrase:

```text
Not every worker reads every partition; Spark's exchange moves rows so matching keys colocate.
```

### Why Not DB Join?

* 50M+ records/day
* batch-oriented
* large scans
* distributed shuffle cheaper than per-record DB RPC

### Airwallex Relevance

* bank statement reconciliation
* payment matching
* settlement files
* operations exception handling

---

## 2.3 Idempotent Payment Ingestion

### Teaches

* idempotency
* Redis fast gate
* Postgres durable truth
* transactional outbox
* Kafka at-least-once
* retry storms
* request hash validation

### Core Phrases

* "Redis is a fast path, Postgres is the durable path."
* "Do not delete the Redis guard blindly when DB outcome is unknown."
* "Retry should consult durable state."
* "Kafka/outbox is at-least-once; consumers dedupe."
* "Idempotency key alone is not enough; compare request hash."

### Flow

```text
Client + Idempotency-Key
  -> Redis SET NX short lock
  -> DB idempotency row + payment row + outbox in one transaction
  -> cache response in Redis
  -> outbox publishes Kafka event
```

### Key Record

```text
idempotency_key
request_hash
status
response_body
payment_id
created_at
```

### Failure Phrases

* "If DB commits but API times out, retry reads Postgres and returns stored response."
* "If Redis dies, correctness remains because Postgres catches duplicates."
* "If Kafka publish fails, outbox row remains."
* "If Kafka redelivers, consumer dedupes by event_id/payment_id/idempotency_key."

### Watch-Out Questions

* "Can Postgres handle 100K connections?"
  * No, use connection pools; scale app nodes carefully.
* "Why Redis and Postgres?"
  * Redis protects DB from retry storms; Postgres protects correctness.

### Airwallex Relevance

* payment APIs
* spend sync APIs
* webhook processing
* idempotent API writes

---

## 2.4 Real-Time FX Rate Streaming

### Teaches

* ultra-low-latency hot path
* LP tick feeds
* LMAX Disruptor
* BBO/TOB aggregation
* conflation
* backpressure
* HMAC quote tokens
* active/hot-standby

### Core Phrases

* "Hot path is in-memory and allocation-free."
* "Kafka is not in the pricing hot path."
* "Kafka is for analytics/recording, not sub-5ms aggregation."
* "HMAC token is issued on quote request, not every tick."
* "Edge WebSockets are conflated because humans do not need every tick."

### LP Tick Sources

```text
FIX Market Data
vendor SDKs
proprietary TCP/binary feeds
```

### Flow

```text
LP connectors
  -> Disruptor ring buffer
  -> sanity filter
  -> BBO aggregation
  -> NATS internal fanout
  -> Redis latest BBO / WebSocket / analytics
```

### Capacity

```text
steady: ~5K ticks/sec
peak: ~100K ticks/sec
ring buffer: 2^18 = 262K slots
hot path cores: 3 threads
```

### Conflation

Phrase:

```text
Conflation means keeping the latest value and skipping stale intermediate updates.
```

Use:

* edge/mobile WebSocket
* degraded mode
* not for audit-grade raw tick stream

### Backpressure

* monitor ring buffer occupancy
* protect hot path
* mark pairs degraded if pricing is unsafe
* avoid arbitrary LP dropping

### Airwallex Relevance

* FX conversion
* locked quotes
* pricing infrastructure
* spread management

---

## 2.5 High-Concurrency Balance Reservation

### Teaches

* reservation holds
* row locks
* double-entry style balance movement
* expiration races
* consume to seller wallet
* consistent hashing
* cross-shard orchestration

### Core Phrases

* "Reservation is a transfer from available to reserved."
* "DB is the authority; Redis is not the financial source of truth."
* "Expiry and consume race on the reservation row."
* "Same-shard consume is one local transaction."
* "Cross-shard seller settlement uses orchestration plus suspense."

### Reserve

```text
buyer available -= amount
buyer reserved += amount
reservation = ACTIVE
ledger entries written
```

### Expire

```text
lock reservation
if ACTIVE and expired:
  reserved -= amount
  available += amount
  status = EXPIRED
```

### Consume / Seller Settlement

Same shard:

```text
lock reservation
lock buyer/seller accounts in sorted ID order
buyer reserved -= amount
seller available += amount
reservation = CONSUMED
```

Cross shard:

```text
buyer shard: debit buyer reserved, credit outgoing suspense
seller shard: debit incoming suspense, credit seller available
```

### Consistent Hashing

```text
owner_shard = consistent_hash(account_id)
```

Phrase:

```text
Consistent hashing limits account movement when shards are added or removed.
```

### Anti-Patterns

* Redis decrement as source of truth
* DB commit then Kafka publish
* app-memory idempotency

### Airwallex Relevance

* card authorization holds
* wallet reservations
* balance correctness
* merchant/seller settlement

---

## 2.6 Async File Upload & Analysis

### Teaches

* direct-to-S3 upload
* multipart upload
* presigned URLs
* SQS job queue
* DB lease + SQS visibility
* malware scan
* SHA-256 dedup
* report publication

### Core Phrases

* "App server should not proxy large file bytes."
* "S3 stores bytes; DB stores metadata and workflow state."
* "SQS visibility is queue-level hiding; DB lease is durable ownership."
* "Workers stream from S3; no full-file memory load."
* "Report is visible only after DB marks analysis completed."

### Upload Flow

```text
initiate upload
  -> create multipart upload
  -> return presigned URLs
client PUT parts to S3
client sends part ETags to completeUpload
backend calls CompleteMultipartUpload
outbox/SQS starts scan/analysis
```

### Part Math

```text
100 MB part
200 GB file = 2,000 parts
100 MB = 800 megabits
100 Mbps = 12.5 MB/sec
100 MB / 12.5 = 8 sec
```

### Worker Scaling

```text
concurrent analyses = arrival rate × processing time
20K uploads/day = 0.23/sec
0.23 × 600 sec = 138 concurrent analyses
138 / 5 per worker = ~28 workers
```

### SQS vs Kafka

SQS:

* job dispatch
* visibility timeout
* DLQ
* long-running workers

Kafka:

* event log
* replay
* multiple consumers

Phrase:

```text
Kafka can announce upload.completed; SQS is better for executing long-running analysis jobs.
```

### Lease

```text
SQS visibility = hides message temporarily
DB lease = durable permission to publish final result
```

### Airwallex Relevance

* file imports
* bank statements
* compliance docs
* async reconciliation jobs
* document processing

---

## 2.7 High-Demand Ticketing

### Teaches

* hot key problem
* waiting room
* Redis Lua atomicity
* inventory shard bottleneck
* hold expiry sorted set
* payment pending
* Redis/Postgres reconciliation
* admission tokens

### Core Phrases

* "500K users do not hit inventory Redis directly."
* "Waiting room absorbs the herd; inventory Redis only sees admitted holds."
* "Redis Lua is atomic on one shard."
* "Adding app pods does not increase one Redis shard's Lua throughput."
* "Temporary holds are Redis-only; Postgres starts at checkout/payment."
* "Payment pending protects seats while payment outcome is ambiguous."

### Flow

```text
Client
  -> CDN / seat map
  -> Waiting Room Redis
  -> admission token
  -> Hold Service
  -> Redis inventory Lua AVAILABLE -> HELD
  -> Checkout
  -> Postgres CHECKOUT_STARTED
  -> Redis HELD -> PAYMENT_PENDING
  -> Stripe
  -> Redis PAYMENT_PENDING -> SOLD/AVAILABLE
  -> Postgres CONFIRMED/DECLINED
```

### Waiting Room

Can use:

* Redis list/stream for FIFO
* bucketed ZSET if position/removal/priority needed

Phrase:

```text
Waiting room fairness is approximate; inventory correctness is exact.
```

### Hold Expiry ZSET

Why sorted set:

```text
sorted by expires_at, not arrival time
ZADD hold_expiry expiresAt holdId
ZADD same holdId newExpiresAt updates score
ZRANGEBYSCORE -inf now finds expired holds
```

### Redis Failure

* waiting room Redis failure = bad UX, no oversell
* inventory Redis failure = pause event
* rebuild SOLD/PAYMENT_PENDING from Postgres
* ordinary HELD can be dropped/expired

### DB/Redis Dual Write

Crash window:

```text
DB CHECKOUT_STARTED inserted
service crashes before Redis HELD -> PAYMENT_PENDING
```

Fix:

* checkout reconciler retries transition
* expiry worker checks DB before releasing

### Airwallex Relevance

* high-demand spend/card workflows
* hot account/event protection
* payment ambiguity
* inventory/reservation patterns

---

## Cross-Spec Phrase Bank

* "Source of truth vs projection."
* "At-least-once plus idempotency."
* "Do not overclaim exactly-once."
* "Every external side effect creates a failure window."
* "Reconciliation is not an afterthought."
* "Adding app pods does not fix a single hot shard."
* "Lock multiple rows in sorted ID order."
* "Cache should improve latency, not own correctness."
* "SQS for jobs, Kafka for event logs."
* "S3 for bytes, DB for metadata."
* "Parquet for scans, not OLTP."

---

## Which Spec To Use For Which Interview Prompt

| Prompt | Use |
| :--- | :--- |
| Money movement / wallet | 2.1 |
| Reconciliation / matching | 2.2 |
| Idempotent APIs / retries | 2.3 |
| Low latency / streaming | 2.4 |
| Holds / reservations | 2.5 |
| File uploads / async workers | 2.6 |
| Hot key / surge control | 2.7 |

