# System Design Cheat Sheet

## 0. First 2 Minutes: Clarify The Problem

Ask:

* Who are the users?
* What is the core workflow?
* What is the write path?
* What is the read path?
* What is the strongest correctness requirement?
* What can be eventually consistent?
* What is the target scale?
* Is this global or single-region?
* Is money/customer data involved?

Phrase:

```text
Before designing components, I want to separate correctness-critical paths from read/analytics paths.
```

---

## 1. Requirements Checklist

### Functional

Ask:

* What can users create/update/delete?
* What must be queried?
* What workflows are synchronous?
* What workflows can be async?
* Are there admin/internal users?
* Are there external integrations?

### Non-Functional

Bring up:

* RPS / TPS
* latency target
* availability target
* consistency requirement
* durability requirement
* data retention
* privacy/security
* auditability
* recovery time objective

---

## 2. Scale Numbers To Ask For

Ask:

* Registered users?
* Daily active users?
* Peak concurrent users?
* Reads per user per day?
* Writes per user per day?
* Peak-to-average multiplier?
* Payload size?
* Retention period?
* Regions?

Quick formulas:

```text
avg RPS = daily requests / 86,400
peak RPS = avg RPS × peak multiplier
daily storage = writes/day × object size
monthly storage = daily storage × 30
bandwidth/sec = RPS × payload size
```

Common assumptions:

```text
DAU = 10-30% of registered users
peak = 3-10× average
small JSON = 1-10 KB
large enriched object = 10-100 KB
```

---

## 3. Component Diagram Must Include

Do not draw boxes only. Add estimates.

For each component:

* CPU
* RAM
* disk/storage
* RPS/TPS
* latency budget
* ownership/source of truth

Example:

```text
[ API Service ]
  6 pods, 8 vCPU / 32 GB RAM
  5K RPS peak
  stateless
```

For databases:

```text
[ PostgreSQL Primary ]
  16-64 vCPU / 64-256 GB RAM
  1-4 TB NVMe/io2/gp3
  source of truth
```

---

## 4. Sequence Diagram Must Include

Every arrow should have:

* RPS or TPS
* latency
* sync vs async
* retry behavior if relevant

Example:

```text
Client -> API              ~5K RPS, ~10ms
API -> Redis               ~5K RPS, ~1ms
API -> Postgres            ~2K TPS, ~10-30ms
Postgres -> Outbox Poller  async, ~100ms poll
Outbox -> Kafka/SQS        at-least-once
```

---

## 5. Correctness Topics To Bring Up

Always consider:

* idempotency
* deduplication
* retries
* partial failure
* ordering
* race conditions
* locking
* optimistic concurrency
* source of truth
* reconciliation
* exactly-once claims

Good phrase:

```text
I would avoid claiming exactly-once across distributed systems. I would use at-least-once delivery plus idempotent writes and reconciliation.
```

---

## 6. Idempotency Checklist

Ask:

* Can clients retry?
* What if client times out after success?
* What is the idempotency key?
* Where is the result stored?
* How long is the key retained?
* What if same key has different payload?

Design:

```text
idempotency_key
request_hash
status
response_body
created_at
expires_at
```

Pattern:

```text
check existing key
if same request -> return stored result
if different request -> reject
else process and store result atomically
```

---

## 7. Hashing / Partitioning Checklist

Ask:

* What is the partition key?
* Does one entity need single-owner ordering?
* Are there hot keys?
* What happens when shards are added?
* Are cross-shard operations needed?

Options:

```text
hash(key) % N
consistent hashing
range partitioning
tenant partitioning
time partitioning
Kafka partition key
Redis hash slot
```

Use consistent hashing when:

```text
nodes/shards may be added or removed
you want limited key movement
one key should have one owner
```

Warning:

```text
Partitioning improves throughput for many keys.
It does not solve one hot key unless you split the key's workload.
```

---

## 8. Caching Checklist

Ask:

* What is cached?
* Is cache source of truth?
* TTL?
* Invalidation?
* What happens if cache is stale?
* What happens if cache is lost?

Phrases:

```text
Cache is a projection, not the source of truth.
Stale cache should degrade UX, not corrupt business state.
```

Patterns:

* cache-aside
* write-through
* write-behind
* CDC projection
* materialized view

---

## 9. Queue / Stream Checklist

Ask:

* Is this job dispatch or event streaming?
* Does a slow message block others?
* Need replay?
* Need multiple consumers?
* Need DLQ?
* Need ordering?
* How are retries handled?

SQS fits:

* background jobs
* long-running work
* visibility timeout
* DLQ
* autoscale by queue depth

Kafka fits:

* event streaming
* replay
* multiple consumer groups
* ordered log per partition
* analytics/event backbone

Phrase:

```text
Kafka is an event log. SQS is a job queue. I would choose based on whether the workload is replayable events or work dispatch.
```

---

## 10. Database Checklist

Ask:

* SQL or NoSQL?
* Transaction boundaries?
* Isolation level?
* Indexes?
* Partitioning?
* Read replicas?
* Retention/archive?
* Migration/backfill?

SQL fits:

* transactions
* constraints
* relational queries
* money/accounting

NoSQL fits:

* document state
* flexible schema
* large-scale key-value access
* denormalized read models

Bring up:

```text
unique constraints
foreign keys
check constraints
row-level locks
optimistic version column
outbox table
```

---

## 11. Locking / Concurrency Checklist

Ask:

* Can two users update same entity?
* What is the conflict behavior?
* Do we need ordering?
* Is contention high?

Options:

```text
optimistic locking: version column
pessimistic locking: SELECT FOR UPDATE
distributed lock: use carefully
single-owner partition
actor model / queue per key
```

Deadlock prevention:

```text
If locking multiple rows, lock in sorted ID order.
```

---

## 12. Latency Budget

Break down:

```text
client -> gateway
gateway -> service
service -> cache
service -> DB
service -> external API
async publish
response
```

Typical rough numbers:

```text
same-region Redis: <1-2ms
same-region DB query: 5-30ms
external payment API: 100ms-2s
Kafka produce: 1-10ms
SQS publish: 10-50ms
HTTP service call: 5-50ms
```

Question:

```text
What is P50/P95/P99 target?
```

---

## 13. Availability / Failure Checklist

Ask:

* What fails?
* What is user impact?
* Can we retry?
* Can we rebuild?
* What data is lost?
* What is RTO/RPO?

Failure modes:

* DB down
* cache down
* queue down
* worker crash
* external API timeout
* duplicate event
* delayed event
* partial commit
* region failure

Phrase:

```text
I want to explicitly handle the failure window between each side effect.
```

---

## 14. Reconciliation Checklist

Bring up when:

* external systems are involved
* payments are involved
* email/webhooks are involved
* cache projections exist
* async workers exist

Ask:

* What states can get stuck?
* What job detects them?
* How often does it run?
* What is safe to retry?
* What is the source of truth?

Examples:

```text
PAYMENT_PENDING too long
SENDING email too long
outbox unpublished rows
cache lag
worker lease expired
```

---

## 15. Security / Privacy Checklist

Ask:

* Authentication?
* Authorization?
* Tenant isolation?
* PII?
* Encryption?
* Audit logs?
* Secrets?
* Rate limiting?

Patterns:

```text
JWT / OAuth
RBAC / ABAC
tenant_id on every row
S3 presigned URLs
KMS encryption
audit log
principle of least privilege
```

---

## 16. Observability Checklist

Metrics:

* RPS/TPS
* latency P50/P95/P99
* error rate
* queue depth
* oldest message age
* retry count
* DLQ count
* cache hit rate
* stuck state count

Tracing:

* trace ID from gateway
* propagate through HTTP/gRPC
* propagate through Kafka/SQS headers
* tag tenant/account/entity IDs carefully

Phrase:

```text
Observability should answer: where is this customer's workflow stuck?
```

---

## 17. API Design Checklist

Ask:

* REST/gRPC?
* Pagination?
* Filtering?
* Idempotency key?
* Error model?
* Webhooks?
* Versioning?

Good API features:

```text
stable IDs
request_id
idempotency_key
created_at / updated_at
status enum
next_page_token
webhook event_id
```

---

## 18. Storage / Data Size Checklist

Calculate:

```text
rows/day = writes/sec × 86,400
storage/day = rows/day × row_size
index overhead = 1-3× data size
replication = multiply by replica count
retention = daily storage × days
```

Remember:

```text
WAL/binlog adds overhead.
Indexes add overhead.
Backups add overhead.
```

---

## 19. Hot Key Checklist

Ask:

* Can one event/account/user dominate traffic?
* Does hashing help?
* Can the hot entity be split?
* What correctness is lost if split?

Examples:

```text
one ticket event
one celebrity livestream
one merchant account
one Redis key
one Kafka partition
```

Phrase:

```text
Adding more app nodes does not fix a single hot shard.
```

---

## 20. Financial Systems Checklist

Always mention:

* idempotency
* audit trail
* immutable ledger/events
* reconciliation
* no double-spend
* source of truth
* external timeout ambiguity
* duplicate webhook handling

Phrase:

```text
For money movement, I would rather fail closed than create ambiguous financial state.
```

---

## 21. Final Answer Structure

When presenting:

```text
1. Requirements
2. Scale estimates
3. API sketch
4. Data model
5. High-level architecture
6. Write path sequence
7. Read path sequence
8. Correctness/idempotency
9. Failure/recovery
10. Observability
11. Tradeoffs and future improvements
```

---

## 22. Quick Trigger Words

If problem mentions:

| Keyword | Immediately Think |
| :--- | :--- |
| payment | idempotency, timeout ambiguity, reconciliation |
| upload | multipart, presigned URL, async workers, virus scan |
| ticketing | hot key, waiting room, atomic holds, expiry |
| chat/feed | fanout, ordering, pagination, read model |
| ledger | double-entry, row locks, immutable postings |
| notification | at-least-once, user preferences, dedup |
| webhook | retries, signature, event_id idempotency |
| search | indexing, eventual consistency |
| analytics | batch vs stream, data lake, aggregation |
| real-time | WebSocket/SSE, backpressure, connection state |
| cache | invalidation, stale reads, rebuild |
| global | region routing, replication lag, data residency |

---

## 23. Do Not Forget

* Put estimates in component diagram.
* Put RPS and latency in sequence diagram.
* State what is source of truth.
* Say what happens on retry.
* Say what happens if worker crashes.
* Say how stuck states are repaired.
* Say what is eventually consistent.
* Say what must be strongly consistent.
* Do not overclaim exactly-once.
