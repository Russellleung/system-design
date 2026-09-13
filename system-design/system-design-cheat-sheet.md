# System Design Cheat Sheet

## 0. First 2 Minutes

Ask:

* users?
* core workflow?
* read path vs write path?
* strongest correctness requirement?
* what can be eventual?
* target scale?
* global or single-region?
* money/customer data?

Phrase:

```text
I want to separate correctness-critical paths from read/analytics paths first.
```

---

## 1. Requirements

Functional:

* create/update/delete?
* query/search?
* sync vs async?
* admin/internal users?
* external integrations?

Non-functional:

* RPS/TPS
* latency P95/P99
* availability
* consistency
* durability
* retention
* privacy/security
* auditability
* RTO/RPO

---

## 2. Scale

Ask:

* registered users
* DAU/MAU
* peak concurrent users
* reads/user/day
* writes/user/day
* peak multiplier
* payload size
* retention
* regions

Formulas:

```text
avg RPS = daily requests / 86,400
peak RPS = avg RPS × peak multiplier
daily storage = writes/day × object size
monthly storage = daily storage × 30
bandwidth = RPS × payload size
```

Assumptions:

```text
DAU = 10-30% registered users
peak = 3-10× average
small JSON = 1-10 KB
enriched object = 10-100 KB
```

---

## 3. Component Diagram

Every box:

* CPU
* RAM
* disk/storage
* RPS/TPS
* source of truth or projection

Example:

```text
[ API Service ]
  6 pods, 8 vCPU / 32 GB RAM
  5K RPS peak
  stateless
```

---

## 4. Sequence Diagram

Every arrow:

* RPS/TPS
* latency
* sync/async
* retry behavior

Example:

```text
Client -> API              ~5K RPS, ~10ms
API -> Redis               ~5K RPS, ~1ms
API -> Postgres            ~2K TPS, ~10-30ms
Postgres -> Outbox Poller  async, ~100ms poll
Outbox -> Kafka/SQS        at-least-once
```

---

## 5. Correctness

Bring up:

* idempotency
* retries
* deduplication
* race conditions
* partial failure
* ordering
* locking
* source of truth
* reconciliation

Phrase:

```text
At-least-once delivery, idempotent writes, explicit reconciliation.
```

---

## 6. Idempotency

Ask:

* can clients retry?
* timeout after success?
* idempotency key?
* request hash?
* stored response?
* TTL?

Record:

```text
idempotency_key
request_hash
status
response_body
created_at
expires_at
```

---

## 7. Hashing / Partitioning

Ask:

* partition key?
* hot keys?
* single-owner ordering?
* cross-shard operations?
* adding/removing shards?

Options:

* `hash(key) % N`
* consistent hashing
* range partitioning
* tenant partitioning
* time partitioning
* Kafka partition key
* Redis hash slot

Phrase:

```text
Partitioning helps many keys. It does not solve one hot key unless we split that key's workload.
```

---

## 8. Cache

Ask:

* source of truth or projection?
* TTL?
* invalidation?
* stale behavior?
* rebuild path?

Phrase:

```text
Stale cache should degrade UX, not corrupt business state.
```

---

## 9. Queue vs Stream

SQS fits:

* long-running jobs
* visibility timeout
* DLQ
* autoscale by queue depth

Kafka fits:

* event log
* replay
* multiple consumer groups
* ordered partition stream

Phrase:

```text
Kafka is an event log. SQS is a job queue.
```

---

## 10. Database

Ask:

* SQL or NoSQL?
* transaction boundary?
* isolation?
* indexes?
* partitioning?
* read replicas?
* archive/retention?

SQL:

* transactions
* constraints
* money/accounting

NoSQL:

* document state
* key-value access
* denormalized reads

Remember:

* unique constraints
* row locks
* version column
* outbox table

---

## 11. Locking

Options:

* optimistic: version column
* pessimistic: `SELECT FOR UPDATE`
* single-owner partition
* queue per key

Rule:

```text
If locking multiple rows, lock in sorted ID order.
```

---

## 12. Latency

Rough numbers:

```text
Redis same-region: <1-2ms
DB query: 5-30ms
Kafka produce: 1-10ms
SQS publish: 10-50ms
HTTP service call: 5-50ms
external payment API: 100ms-2s
```

---

## 13. Failure / Recovery

Ask:

* what fails?
* user impact?
* retry?
* rebuild?
* data loss?
* RTO/RPO?

Common:

* DB down
* cache lost
* queue down
* worker crash
* external API timeout
* duplicate event
* partial commit
* region failure

Phrase:

```text
Handle the failure window between each side effect.
```

---

## 14. Reconciliation

Use for:

* payments
* webhooks
* email
* external APIs
* async workers
* cache projections

Examples:

* `PAYMENT_PENDING` too long
* unpublished outbox rows
* cache lag
* expired worker lease
* stuck `SENDING`

---

## 15. S3

Use for:

* large files
* reports
* raw immutable data
* archives
* data lake

Ask:

* object size?
* presigned URLs?
* multipart?
* lifecycle?
* encryption?
* bucket/key isolation?
* read/write rate?

Multipart:

```text
S3 limit = 10,000 parts
100 MB part -> 200 GB file = 2,000 parts
```

Upload timing:

```text
100 MB = 800 megabits
100 Mbps = 12.5 MB/sec
100 MB / 12.5 MB/sec = 8 sec
```

Pattern:

```text
client -> S3 directly
API signs URLs only
worker streams from S3
DB stores metadata/status
```

Phrase:

```text
The app server should not proxy large file bytes.
```

---

## 16. Parquet

Use for:

* analytics
* reconciliation batches
* data lake
* Spark/Athena/Trino

Why:

* columnar
* compressed
* schema
* predicate pushdown

Ask:

* partition columns?
* file size?
* small files problem?
* schema evolution?
* compaction?

Good size:

```text
128 MB-1 GB per Parquet file
```

Partition examples:

```text
dt=2026-09-13/
tenant_id=abc/
region=sg/
```

Phrase:

```text
Parquet is for analytical scans, not low-latency row-by-row OLTP.
```

Warning:

```text
Do not write tiny Parquet files per event. Buffer/batch and compact.
```

---

## 17. Security

Ask:

* authentication?
* authorization?
* tenant isolation?
* PII?
* encryption?
* audit logs?
* secrets?
* rate limits?

Patterns:

* JWT/OAuth/API key
* RBAC/ABAC
* tenant_id on rows
* presigned URLs
* KMS
* audit log

---

## 18. Observability

Metrics:

* RPS/TPS
* P95/P99
* error rate
* queue depth
* oldest message age
* retry count
* DLQ count
* cache hit rate
* stuck state count

Phrase:

```text
Observability should answer: where is this customer's workflow stuck?
```

---

## 19. Financial Systems

Mention:

* idempotency
* audit trail
* immutable ledger/events
* reconciliation
* no double-spend
* source of truth
* timeout ambiguity
* duplicate webhook handling

Phrase:

```text
For money movement, fail closed rather than create ambiguous financial state.
```

---

## 20. API Design

Ask:

* REST/gRPC?
* pagination?
* filtering?
* idempotency key?
* error model?
* webhooks?
* versioning?

Good fields:

```text
id
request_id
idempotency_key
status
created_at
updated_at
next_page_token
```

---

## 21. Storage Math

```text
rows/day = writes/sec × 86,400
storage/day = rows/day × row_size
monthly = daily × 30
index overhead = 1-3×
replicas multiply storage
```

Remember:

* indexes
* WAL/binlog
* backups
* replication
* retention

---

## 22. Trigger Words

| Keyword | Think |
| :--- | :--- |
| payment | idempotency, timeout, reconciliation |
| upload | multipart, S3, presigned URL, workers |
| ticketing | hot key, waiting room, atomic hold |
| ledger | double-entry, row locks, audit |
| webhook | HMAC, event_id, retries |
| search | index, eventual consistency |
| analytics | Parquet, S3, batch, compaction |
| real-time | WebSocket/SSE, backpressure |
| cache | stale reads, invalidation, rebuild |
| global | replication lag, data residency |

---

## 23. Final Flow

```text
1. Requirements
2. Scale
3. API
4. Data model
5. Component diagram with estimates
6. Sequence diagram with RPS/latency
7. Correctness/idempotency
8. Failure/recovery
9. Observability
10. Tradeoffs
```

---

## 24. Do Not Forget

* estimates in component diagram
* RPS/latency in sequence diagram
* source of truth
* retry behavior
* worker crash behavior
* stuck-state repair
* strong vs eventual consistency
* avoid overclaiming exactly-once
