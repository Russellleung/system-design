# Spec 2.2: Cross-Border Payment Reconciliation System

## 1. System Objective

Design an enterprise-grade batch and near-real-time reconciliation engine that ingests external bank clearing statements (e.g. SWIFT MT940, ISO 20022 CAMT.053, ACH/FAST CSV/XML files) from 50+ international partner financial institutions, normalizes disparate statement formats, matches external records against internal ledger entries, and isolates ledger breaks.

The design is optimized for a **50 million statement-line morning batch**, while keeping the matching model extensible to incremental/near-real-time reconciliation.

---

## 2. System Requirements

### Functional Requirements

* **Multi-Format Bank File Ingestion**: Parse EOD clearing reports (MT940 flat text, ISO 20022 CAMT XML, custom CSV/Fixed-Width).

* **Multi-Pass Automated Matching Engine**:

  * **Rule 1 (Exact Match)**: 1:1 match on `end_to_end_id` / `uetr` (Unique End-to-End Transaction Reference).
  * **Rule 2 (Candidate/Fuzzy Match)**: Candidate match on `account_number` + `amount` + `value_date` (±2 days) + `currency`.
  * Matching must be deterministic: one external record may map to at most one internal record, and one internal record may be claimed by at most one external record within a batch.

* **Break Categorization**: Automatically classify un-reconciled entries into 3 break types:

  1. `MISSING_INTERNAL_RECORD`: External bank cleared a debit/credit, but no internal transaction log exists.
  2. `MISSING_EXTERNAL_RECORD`: Internal transaction logged as submitted, but bank statement has no record after N days.
  3. `VALUE_CURRENCY_MISMATCH`: Identical transaction IDs but discrepancy in amount, currency, or deducted lifting fees.

* **Duplicate / Data Integrity Detection**:

  * Duplicate delivery of the same statement file or statement line must be idempotently absorbed.
  * Same business line identity with different content must be flagged as a data-integrity anomaly rather than treated as a new transaction.
  * Duplicate UETRs in the internal or external dataset must be detected explicitly and routed to an ambiguity/integrity break rather than silently overwritten.

### Non-Functional Requirements

* **Throughput & Window**: Process **50 million statement lines within a 2-hour window** every morning (> 7,000 records/second sustained).
* **Fault-Tolerance & Idempotency**: File ingestion workers must be crash-resilient; resuming failed parse jobs must produce zero duplicate business records.
* **Deterministic Reconciliation**: Re-running the same batch against the same source snapshots must produce the same matching decisions.
* **Auditability**: Raw source files are immutable; normalized records, matching decisions, and break resolutions are retained for audit.

---

## 3. Scaling & Capacity Estimation

### Data Volume Model

| Metric | Value | Rationale |
| :--- | :--- | :--- |
| Partner banks | 50+ | Multi-corridor cross-border fintech |
| Avg statement lines per bank/day | ~1M | Major corridors (US, EU, ASEAN) generate high volumes |
| Daily ingestion volume | ~50M external records | 50 banks × ~1M lines |
| Internal ledger entries to match against | ~5M–10M/day | Internal transaction rate from Spec 2.1 |
| Matching data volume | ~50M external + ~10M internal | Distributed batch join rather than nested-loop search |
| Peak processing window | 2 hours (06:00–08:00 UTC) | Before market open / ops team shift start |
| Required sustained throughput | **~6,944 records/sec** | 50M / 7,200s; design target rounded to >7,000/sec |

### Storage Estimation

Capacity estimates below are **raw logical data estimates**. Actual physical storage depends on indexes, tuple/object overhead, replication, WAL, compression, and file format.

| Entity | Daily Growth | 30-day Raw | Retention |
| :--- | :--- | :--- | :--- |
| Raw bank statement files (S3) | ~2–5 GB/day compressed | ~60–150 GB | 7 years regulatory/archive |
| Canonical `BankStatementRecord` | 50M × ~200 B ≈ **10 GB/day** | ~300 GB | 1 year hot, then cold archive |
| `MatchingResult` | 50M × ~150 B ≈ **7.5 GB/day** | ~225 GB | 1 year hot |
| Internal ledger snapshot/export | ~5M–10M/day | workload-dependent | Per ledger policy |
| 90-day canonical + result raw logical volume | ~17.5 GB/day | **~1.6 TB / 90 days** | Partitioned by ingestion/batch date |

**Important:** Database/index/replication overhead can increase physical footprint materially above these raw figures. Use load testing before final instance sizing.

### Batch Storage Architecture

* **Amazon S3** is the immutable system of record for raw bank files.
* Canonical reconciliation datasets are preferably stored in **Parquet/Iceberg on S3** for large-scale batch processing.
* A relational database such as **PostgreSQL** is used for operational metadata, ingestion state, constraints, job state, break workflow, and selected serving/query paths rather than as the sole 50M-row/day analytical staging layer.

---

## 4. High-Level Architecture

```text
                         [ 50+ Partner Banks ]
                                  |
                           SFTP / API / MFT
                                  |
                                  v
                    [ AWS S3 Raw Dropzone Bucket ]
                    [ managed storage; ~2-5 GB/day compressed ]
                                  |
                        Event Notification
                                  |
                                  v
                         [ Amazon SQS Queue ]
                         [ managed queue; at-least-once delivery ]
                                  |
                                  v
                 [ Distributed Ingestion Cluster ]
                 [ Spark / Flink / Java workers ]
                 [ 10 nodes; 160 vCPU total ]
                 [ 160-320 GB RAM; local disk ephemeral ]
                                  |
              +-------------------+-------------------+
              |                   |                   |
           [MT940]            [CAMT.053]          [CSV/XML]
              |                   |                   |
              +-------------------+-------------------+
                                  |
                                  v
                     [ Canonical Statement Data ]
                                  |
                      Business key + content hash
                                  |
                                  v
                   [ S3 Parquet / Iceberg Dataset ]
                   [ managed storage; ~10 GB/day raw canonical ]
                   [ partitioned by batch_date/bank/corridor ]
                                  |
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
          [ Internal Ledger Snapshot ]     [ Batch Metadata DB ]
          [ S3 Parquet/Iceberg ]          [ PostgreSQL ]
          [ ~5M-10M rows/day ]            [ 16-32 vCPU ]
                                          [ 64-128 GB RAM ]
                                          [ 1-4 TB SSD/NVMe ]
                    |                           |
                    +-------------+-------------+
                                  |
                                  v
                      [ Matching Engine: Spark ]
                      [ 20 workers; 160-320 vCPU ]
                      [ ~1.25 TB aggregate RAM ]
                      [ local SSD optional for shuffle spill ]
                                  |
             +--------------------+--------------------+
             |                    |                    |
             v                    v                    v
       [Exact Join]      [Candidate Generation]   [Missing Detection]
       UETR / IDs        acct+ccy+amount+date      internal/external
             |                    |
             +--------------------+
                        |
                        v
                [Deterministic 1:1 Resolution]
                        |
              +---------+---------+
              |                   |
              v                   v
        [Reconciled]      [Break Dataset / DB]
        [S3 result set]   [PostgreSQL serving DB]
                          [8-16 vCPU; 32-64 GB RAM]
                          [1-2 TB SSD/NVMe]
                                  |
                                  v
                         [ Ops Dashboard / API ]
                         [2-4 replicas]
                         [4-8 vCPU; 8-16 GB RAM each]
```

### Component Sizing Estimates

These are interview-level starting estimates for the component diagram. Managed services such as S3 and SQS do not require application CPU/RAM sizing, but their throughput and request limits should still be monitored.

| Component | CPU | RAM | Disk / Storage | Notes |
| :--- | :--- | :--- | :--- | :--- |
| S3 raw dropzone | Managed | Managed | ~2-5 GB/day compressed, 7-year retention | Immutable raw files; throughput scales by object/key distribution |
| SQS file queue | Managed | Managed | Managed | At-least-once delivery; idempotent consumers required |
| Ingestion worker cluster | **10 nodes × 16 vCPU = 160 vCPU** | **16-32 GB/node = 160-320 GB** | Ephemeral local disk only; spill/temp buffers | Parser-heavy workload; enough memory for streaming buffers, parser state, and write batching |
| Batch metadata DB | **16-32 vCPU** | **64-128 GB** | **1-4 TB SSD/NVMe** | File manifests, idempotency state, job status, anomalies, ops workflow metadata |
| Canonical S3 Parquet/Iceberg dataset | Managed | Managed | ~10 GB/day raw canonical records; ~300 GB/30 days raw | Large-scale analytical matching dataset |
| Spark matching cluster | **20 nodes × 8-16 vCPU = 160-320 vCPU** | **64 GB/node = ~1.25 TB** | Local SSD optional for shuffle spill; durable data in S3 | Distributed joins, shuffles, candidate generation, and result writes |
| Break/result serving DB | **8-16 vCPU** | **32-64 GB** | **1-2 TB SSD/NVMe** | Serves break dashboard and manual resolution workflows |
| Ops dashboard/API | **2-4 replicas × 4-8 vCPU** | **8-16 GB/replica** | Small container/image/log disk | Horizontally scaled read/write API over break workflow data |

### Why this architecture

The core batch path is intentionally **snapshot-based**:

1. Raw bank files are immutable in S3.
2. Internal ledger data is exported as a consistent batch snapshot / CDC-derived dataset.
3. Both sides are transformed into the same canonical model.
4. Spark reads both Parquet/Iceberg snapshots and repartitions them by deterministic join keys.
5. PostgreSQL is not used for millions of per-record fuzzy-match RPCs.
6. The same input snapshots + engine version produce deterministic results.

---

## 5. Ingestion & Normalization

### Ingestion Flow

```text
Bank
  |
  | SFTP/API upload
  | latency: seconds-minutes per file
  | throughput target: ~50M lines / 2h = ~6,944 lines/sec sustained
  v
S3 Raw Dropzone
  |
  | ObjectCreated event
  | latency: ~100 ms-2 sec
  v
SQS File Queue
  |
  | worker poll + claim
  | latency: ~1-10 sec
  | job rate: ~50-200 file jobs/day, depending on bank splits
  v
Ingestion Worker Cluster
  |
  +--> Fetch metadata / verify checksum
  |    latency: ~100 ms-2 sec per file
  |
  +--> Select parser by bank + format version
  |    latency: <100 ms local config lookup
  |
  +--> Parse into CanonicalStatementRecord
  |    latency: ~30 sec-3 min per 1M-line file
  |    throughput: cluster target ~7K-25K lines/sec
  |
  +--> Compute business identity + content hash
  |    throughput: included in parser throughput
  |
  +--> Persist canonical records to S3 Parquet/Iceberg
  |    latency: ~15-45 min for all 50M records
  |    write rate: ~7K-55K records/sec depending on file format and parallelism
  |
  +--> Persist ingestion status / anomalies to PostgreSQL
       latency: milliseconds per metadata write; batched where possible
       write rate: low RPS for file/job metadata, not 50M row writes
```

### Sequence Latency Estimates

These estimates are for sequence-diagram annotation. They are order-of-magnitude expectations, not hard guarantees.

| Sequence Step | Estimated Latency | Throughput / RPS |
| :--- | :--- | :--- |
| Bank uploads statement file to S3 / MFT endpoint | Seconds to minutes, depending on file size and bank connectivity | Batch target averages ~6,944 statement lines/sec over 2h |
| S3 object-created event reaches SQS | ~100 ms-2 sec | Tens to hundreds of file events/day |
| Ingestion worker polls SQS and claims job | ~1-10 sec | Low queue RPS; file-level jobs, not row-level jobs |
| File checksum and metadata registration | ~100 ms-2 sec per file | Low metadata write RPS |
| Parse one ~1M-line statement file | ~30 sec-3 min | ~5.5K-33K lines/sec per large file depending on format and parallelism |
| Parse and canonicalize all ~50M external records | ~15-45 min on the initial ingestion cluster | ~18.5K-55.5K records/sec cluster throughput |
| Write canonical Parquet/Iceberg partitions | Included in ingestion path, or +5-15 min if staged separately | ~55K-166K records/sec if staged as a separate write phase |
| Export internal ledger snapshot to Parquet/Iceberg | ~5-20 min if CDC/EOD export is already available | ~8K-33K records/sec for 10M internal rows |
| Spark reads external + internal snapshots | ~5-15 min, depending on S3 throughput and partition count | ~67K-200K records/sec for ~60M input rows |
| Exact UETR distributed join | ~5-15 min | ~67K-200K records/sec over ~60M rows |
| Fuzzy candidate distributed join | ~5-30 min, depending on unmatched volume and candidate explosion | Depends on unmatched set; target keeps total batch under 2h |
| Deterministic 1:1 conflict resolution | ~2-10 min | ~83K-416K candidate/result records/sec for 50M-scale grouping |
| Missing-external detection | ~2-10 min | ~17K-83K records/sec for 10M internal rows |
| Persist match results and breaks | ~5-15 min | ~55K-166K records/sec for 50M results |
| Integrity checks and batch publication | ~2-10 min | Full-table assertions over result partitions |
| Total morning batch target | <2 hours; typical design estimate ~45-90 min | Sustained average must exceed ~6,944 records/sec |

### Canonical Record

```text
CanonicalStatementRecord
------------------------
statementId
statementLineId
bankId
accountNumber
uetr
amount
currency
valueDate
bookingDate
creditDebitIndicator
bankReference
rawFileHash
contentHash
batchRunId
```

### Business Identity vs Content Hash

Do **not** rely on one SHA-256 hash as the sole duplicate guarantee.

Use two concepts:

```text
business_key  = bank_id + statement_id + statement_line_id
content_hash  = SHA-256(canonicalized statement-line content)
```

Expected behavior:

```text
same business_key + same content_hash
    -> duplicate delivery; safely ignore / mark duplicate

same business_key + different content_hash
    -> data-integrity anomaly; do not silently create a second record
```

For operational enforcement, PostgreSQL can maintain a unique constraint on the business key for metadata/idempotency tracking.

### Chunked Parallel Parsing

Split files into parser-safe logical chunks (e.g. 10K-line or parser-defined blocks), but never split a multi-line financial transaction record across workers.

* MT940: chunk by parser-aware transaction blocks / statement boundaries.
* CAMT.053: use a streaming XML parser with structure-aware record boundaries.
* CSV / Fixed-Width: split on complete physical rows according to the file schema.

The goal is bounded memory and parallelism, not arbitrary byte-level slicing.

---

## 6. Ingestion Layer Scaling

### Initial Sizing Assumption

* **10 worker nodes**
* **16 vCPU / 16-32 GB RAM per node**
* Parallelism driven by the number and size of incoming files.

These are **initial interview sizing assumptions**, not production guarantees. Actual worker count should be validated with representative MT940/CAMT.053/CSV files and measured parser throughput.

### Capacity Reasoning

The ingestion workload includes:

* file decompression / transfer
* format parsing
* validation
* canonicalization
* hashing
* S3 writes
* metadata writes

SHA-256 is only one component of the workload, so the design should avoid claiming that parsing is purely CPU-bound without benchmark evidence.

---

## 7. Matching Engine Architecture

### Principle

The matching engine must avoid a synchronous database lookup for every unmatched record.

The preferred design is a **distributed data join** over batch snapshots.

### Phase 0: Snapshot Preparation

Create consistent Parquet/Iceberg snapshots for both sides of the reconciliation run:

```text
Internal Ledger                    Bank Statements
      |                                  |
      | CDC / EOD snapshot export        | Ingestion + canonicalization
      v                                  v
S3 Parquet / Iceberg              S3 Parquet / Iceberg
      |                                  |
      +---------------+------------------+
                      |
                      v
          Reconciliation batch inputs
```

This avoids depending on a potentially lagging read replica during matching and gives the run a fixed, auditable input state. The baseline design assumes Spark reads Parquet/Iceberg files from S3 and then shuffles/repartitions records by the required join key. Pre-bucketing the datasets by common keys can reduce shuffle cost, but it is an optimization rather than a correctness requirement.

### Phase 1: Exact UETR Join

Partition both datasets by the same normalized UETR key. Conceptually, every record with the same UETR is routed to the same Spark partition:

```text
External Parquet/Iceberg snapshot        Internal Parquet/Iceberg snapshot
        ~50M records/day                       ~5M-10M records/day
              |                                      |
              | read latency: ~5-15 min total        | read latency: ~5-15 min total
              | throughput: ~67K-200K rows/sec       | throughput included in same scan
              v                                      v
    repartition by hash(uetr)              repartition by hash(uetr)
    latency: ~5-15 min                     latency: ~5-15 min
    throughput: ~67K-200K rows/sec         throughput: ~67K-200K rows/sec
              |                                      |
              +-------------------+------------------+
                                  |
                                  v
                    Local partition hash join
                    latency: ~5-15 min
                    throughput: ~67K-200K rows/sec
```

For example:

```text
partition_id = hash(normalized_uetr) % num_partitions
```

Spark does not need to issue one query per UETR. It performs a distributed read of both snapshots, shuffles records with the same join key together, and then merges them locally within each partition.

### Spark Read vs Shuffle Exchange

A Spark file split is not the same thing as a reconciliation hash partition.

During the initial read, each executor reads only a subset of physical Parquet splits from S3. Those splits usually contain mixed UETR values:

```text
Executor A reads file split 1:
    rows with hash(uetr) = 1, 4, 9, 17

Executor B reads file split 2:
    rows with hash(uetr) = 2, 4, 8, 17

Executor C reads file split 3:
    rows with hash(uetr) = 1, 3, 9, 12
```

During the shuffle/exchange stage, executors send rows across the network to the executor partition responsible for each hash bucket:

```text
Before shuffle:
    each executor has mixed hash buckets from the file splits it read

Shuffle exchange:
    hash 1 rows  -> partition 1
    hash 4 rows  -> partition 4
    hash 17 rows -> partition 17

After shuffle:
    each join partition has all external and internal rows for its assigned hash bucket
```

This means no worker needs to read every S3 file to collect its own hashes. Workers read different physical file chunks, then Spark redistributes rows between workers so matching keys become co-located.

Before matching, detect duplicates:

```text
if count(internal rows for UETR) > 1
    -> duplicate/ambiguous internal reference

if count(external rows for UETR) > 1
    -> duplicate/ambiguous external reference
```

A duplicate UETR must never be silently overwritten by a Java `HashMap<String, InternalLedgerEntry>`.

### Phase 2: Fuzzy Candidate Generation

Only records unmatched by Rule 1 proceed.

Generate candidate pairs using a distributed join key:

```text
candidate_key = account_number + currency + normalized_amount + date_bucket
```

The date join expands the bank record over the permitted window:

```text
external value_date = D
candidate internal dates = D-2 ... D+2
```

Then apply the exact matching predicate:

```text
same account_number
same currency
same amount
abs(value_date difference) <= 2 days
```

Including `amount` in the candidate key is the default because Rule 2 requires the same amount. This sharply reduces candidate explosion compared with joining only on account, currency, and date. If a corridor supports fee-tolerant or FX-tolerant fuzzy matching, use a separate tolerance rule that expands amount buckets explicitly, rather than silently dropping amount from the join key.

### Phase 3: Deterministic 1:1 Resolution

Candidate generation can produce multiple candidate pairs. Resolve them deterministically:

```text
candidate pairs
      |
      v
group by external statementLineId
      |
      +--> 0 candidates -> MISSING_INTERNAL_RECORD
      +--> 1 candidate   -> provisional match
      +--> >1 candidates -> ambiguous candidate break
      |
      v
group by internal txnId
      |
      +--> one external owner -> accepted
      +--> multiple owners  -> ambiguous / conflict break
```

This makes the 1:1 mapping a **distributed data invariant**, rather than relying on a shared mutable Java `HashSet` across executors.

---

## 8. Matching Engine Implementation (Java-Oriented)

The Java implementation should represent the matching logic, while Spark/Flink handles the distributed data movement.

```java
public record CanonicalStatementRecord(
    String statementLineId,
    String bankId,
    String uetr,
    String accountNumber,
    BigDecimal amount,
    String currency,
    LocalDate valueDate,
    String contentHash
) {}

public record InternalLedgerEntry(
    String txnId,
    String uetr,
    String accountNumber,
    BigDecimal amount,
    String currency,
    LocalDate bookingDate
) {}
```

### Exact Matching Pseudocode

```java
Map<String, List<InternalLedgerEntry>> byUetr = groupInternalByUetr(internalEntries);

for (CanonicalStatementRecord bank : externalRecords) {
    List<InternalLedgerEntry> candidates = byUetr.getOrDefault(
        bank.uetr(), List.of());

    if (candidates.size() == 1) {
        InternalLedgerEntry internal = candidates.get(0);

        if (bank.amount().compareTo(internal.amount()) == 0
                && bank.currency().equalsIgnoreCase(internal.currency())) {
            reconcile(bank, internal, "EXACT_UETR");
        } else {
            mismatch(bank, internal, "Amount or currency discrepancy");
        }
    } else if (candidates.size() > 1) {
        ambiguous(bank, "Duplicate UETR");
    } else {
        deferToFuzzyPass(bank);
    }
}
```

### Fuzzy Matching Pseudocode

The candidate search itself is performed as a distributed join, not a database call per external record.

```java
for (CandidatePair pair : distributedCandidatePairs) {
    if (sameAccount(pair)
            && sameCurrency(pair)
            && sameAmount(pair)
            && withinTwoDays(pair)) {
        emitCandidate(pair);
    }
}
```

Final 1:1 ownership is decided using distributed grouping/windowing by external and internal IDs.

---

## 9. Matching Performance Characteristics

The following figures are **illustrative interview benchmarks / sizing assumptions**. They are intended to compare order-of-magnitude behavior and justify architecture choices, not to guarantee production latency.

| Phase / Approach | Complexity | Illustrative Time | Notes |
| :--- | :--- | :--- | :--- |
| Build in-memory UETR map | O(n) | ~2s for 10M entries | Approximate; JVM object overhead matters |
| HashMap lookup | O(1) average | ~100 ns/op | Favorable in-memory benchmark assumption |
| 50M exact lookups on one JVM | O(m) | ~5–7s CPU-side estimate | Network / serialization excluded |
| PostgreSQL large batch JOIN | O(n+m) with hash/merge strategy | ~45–90 min | Interview benchmark assumption; depends heavily on indexes/hardware |
| Spark distributed join | O(n+m) logical join | ~15–25 min | Interview benchmark assumption; depends on partitioning/skew/storage |
| Distributed fuzzy candidate join | O(candidates) after pruning | ~10–30s–minutes | Depends primarily on unmatched volume and candidate explosion |

### Why Distributed Join Over Per-Record DB RPC

A per-record fuzzy query of 2–5 ms becomes expensive at scale:

```text
1,000,000 unmatched records × 2 ms
≈ 2,000 seconds
≈ 33 minutes
```

That is before queueing, connection overhead, retries, and database contention.

Therefore the scalable design is:

```text
External unmatched records
        |
        v
Distributed candidate join
        |
        v
Candidate pairs
        |
        v
Deterministic resolution
```

rather than:

```text
for every record:
    SELECT candidates FROM DB
```

---

## 10. Why Spark and Not Only an RDBMS?

| Approach | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| PostgreSQL batch SQL | Simple, ACID, familiar; good for metadata and moderate batch workloads | Large scans/joins compete for DB resources; scaling and isolation become difficult at 50M-row batch volumes | ⚠️ Useful component, not sole large-scale engine |
| Apache Spark (batch) | Distributed joins, partitioning, replayability, mature S3/Parquet integration | Higher infrastructure and operational complexity | ✅ Primary batch matching engine |
| Apache Flink | Strong streaming model and incremental processing | More operational complexity; not necessary for the core morning batch | ✅ Future near-real-time overlay |
| Snowflake / BigQuery | Serverless SQL, excellent analytics/reporting | Cost/performance characteristics depend on workload and platform | ✅ Analytics / reporting option |

The architecture therefore uses **S3 + Spark for bulk reconciliation** and **PostgreSQL for operational state and serving workflows**.

---

## 11. Transaction Lifecycle State Machine

```text
[ SUBMITTED ]
      |
      +------------------------------+
      |                              |
      v                              v
[ CLEARED ]                  [ PENDING_EXTERNAL ]
      |                              |
      |                              +--> Rule 1: UETR Exact --> [ RECONCILED ]
      |                              |
      |                              +--> Rule 2: Fuzzy -------> [ RECONCILED ]
      |                              |
      |                              +--> Bank record, no internal
      |                              |        -> [ BREAK_MISSING_INTERNAL ]
      |                              |
      |                              +--> T+3 without bank record
      |                                       -> [ BREAK_MISSING_EXTERNAL ]
      |                                                |
      +--> Rule 1 / Rule 2 -----------------------------+
                                                       |
                                                       v
                                             [ RESOLVED_MANUAL ]

Reference match + amount/currency discrepancy
                  |
                  v
          [ BREAK_MISMATCH ]
                  |
          +-------+--------+
          |                |
          v                v
  auto-resolve        manual review
```

### State Transition Expectations

| Transition | Typical Latency | Driver |
| :--- | :--- | :--- |
| SUBMITTED → CLEARED | T+0 to T+2 business days | Clearing network; corridor dependent |
| SUBMITTED → PENDING_EXTERNAL | EOD export | Internal ledger snapshot/CDC |
| PENDING_EXTERNAL → RECONCILED | Within morning batch | Spark matching |
| PENDING_EXTERNAL → BREAK_MISSING_EXTERNAL | T+3 business days | Grace period for settlement delays |
| BREAK → RESOLVED_MANUAL | 1–48 hours | Ops SLA |
| BREAK_MISMATCH → automated resolution | Minutes | Configured tolerance rules |

Tolerance logic must be corridor/currency-aware and explicitly documented. Do not automatically assume that a single universal `$1 / 0.1%` tolerance is valid across all payment types.

---

## 12. Failure Points & Recovery

| Failure Scenario | Impact | Detection | Recovery Strategy | RTO |
| :--- | :--- | :--- | :--- | :--- |
| Bank file delivery delayed | Incomplete recon; false missing-external breaks if processed too early | Expected-vs-received file manifest | Hold that bank/corridor until expected files arrive; re-run affected scope | <4h |
| Spark executor OOM | Batch partition fails | Spark executor metrics/logs | Retry failed task; fix skew/repartition; tune executor memory | <30min |
| Duplicate file re-delivery | Potential duplicate records | File checksum + business-key uniqueness | Idempotently absorb duplicate; flag same-key/different-content anomaly | Auto |
| Staging/metadata DB unavailable | Operational metadata operations fail | Connection/health checks | Retry; degrade only non-critical serving paths; resume from durable S3 datasets | <1h |
| Internal snapshot unavailable | Matching cannot run against authoritative snapshot | Snapshot freshness check | Defer matching rather than use an arbitrarily stale replica | <2h |
| Matching rule false positive | Incorrect reconciliation | Ops overrides / quality metrics | Versioned rules, replay batch, manual review for high-risk cases | <1h |
| Recon code deploy corrupts output | Break counts spike / incorrect matches | Schema + invariant checks + anomaly detection | Roll back engine version; replay from immutable S3 source | <1h |
| Data skew by bank/corridor | One or more partitions become stragglers | Partition-level duration metrics | Salt/skew-aware partitioning, repartition by normalized key, isolate very large banks | <30min |
| S3 / object availability issue | Batch input inaccessible | AWS service health + read errors | Retry and resume from durable source; no need to recompute already persisted canonical partitions | <2h |

---

## 13. Data Integrity Invariants

Run these assertions after every reconciliation batch:

```text
Assertion 1:
COUNT(external_records)
= COUNT(reconciled_external_records)
+ COUNT(unresolved_breaks)
+ COUNT(explicitly_quarantined_records)

Assertion 2:
No external record maps to more than one internal record.

Assertion 3:
No internal record maps to more than one external record.

Assertion 4:
Duplicate UETRs are explicitly classified as duplicates/ambiguities,
not silently overwritten.

Assertion 5:
For exact matches, amount and currency must satisfy the exact-match rule.

Assertion 6:
All fuzzy matches satisfy the documented candidate constraints.

Assertion 7:
Re-running the same batch against the same snapshots produces the same result set.
```

Violation triggers:

```text
RECON_INTEGRITY_VIOLATION
```

and blocks automatic publication of the affected batch as authoritative.

---

## 14. Observability

### Key Operational Metrics

| Metric | Type | Example Alert | Why It Matters |
| :--- | :--- | :--- | :--- |
| `recon.batch.duration_minutes` | Gauge | >90min warning; >120min critical | SLA compliance |
| `recon.batch.records_processed` | Counter | <80% expected | File or processing failure |
| `recon.match_rate` | Gauge | <95% warning; <90% critical | Systematic matching issue |
| `recon.break.count_by_type` | Counter | >3σ from baseline | Detects abnormal break generation |
| `recon.break.age_hours` | Histogram | Any unresolved break >72h | Ops SLA |
| `recon.ingestion.dedup_hit_rate` | Gauge | >5% investigate | Duplicate delivery / bank behavior |
| `recon.fuzzy_candidate_count` | Histogram | Candidate explosion | Detects poor candidate-key selectivity |
| `recon.fuzzy_match.override_rate` | Gauge | >2% investigate | False-positive signal |
| `recon.file.expected_vs_received` | Gauge | Missing files by bank | Prevents premature reconciliation |
| `recon.partition.duration_seconds` | Histogram | Large skew outliers | Detects data-skew problems |

### Batch Trace

Each run receives a `batchRunId` that tags:

* ingestion file counts and parse errors
* records by bank/corridor
* dedup counts
* exact-match count
* fuzzy candidate count
* fuzzy accepted/rejected/ambiguous count
* break counts by type
* integrity assertions
* total runtime
* engine/rule version

Example:

```text
batchRunId: recon-2026-09-12-0600
  |
  +-- ingestion.files_received: 53
  +-- ingestion.records: 51,234,891
  +-- ingestion.duplicate_lines: 83,201
  +-- ingestion.parse_errors: 12
  |
  +-- matching.rule1_exact: 49,102,333
  +-- matching.rule2_candidates: 2,998,411
  +-- matching.rule2_accepted: 1,456,221
  +-- matching.rule2_ambiguous: 41,002
  |
  +-- breaks.missing_internal: 234,112
  +-- breaks.missing_external: 389,002
  +-- breaks.value_mismatch: 53,223
  |
  +-- assertions.record_count: PASS
  +-- assertions.1_to_1_mapping: PASS
  +-- assertions.determinism: PASS
  |
  +-- total_duration_minutes: 47
```

---

## 15. Real-Time / Future Extension

The morning batch remains the authoritative reconciliation run for EOD statements.

For near-real-time reconciliation, add a Flink pipeline:

```text
Bank API / streaming feed
        |
        v
      Kafka
        |
        v
      Flink
        |
        +--> canonicalization
        +--> stateful matching
        +--> provisional reconciliation
        |
        v
   Kafka / serving DB
```

The next EOD batch replays against the authoritative bank statement and ledger snapshot, providing eventual convergence and auditability.

Do not maintain two conflicting reconciliation authorities; the batch and streaming systems should share the same matching rules/versioning model.

---

## 16. Interview Tradeoffs & Talking Points

### Why S3?

* Durable, cheap, immutable raw source.
* Easy replay when parser/matching logic changes.
* Natural integration with Spark/Parquet.

### Why SQS?

* At-least-once delivery is acceptable because ingestion is idempotent.
* Visibility timeout supports worker crash recovery.

### Why Spark?

* The workload is dominated by a large batch join rather than OLTP transactions.
* Distributed partitioning avoids forcing 50M rows through one relational database.

### Why not query PostgreSQL for every fuzzy candidate?

At 2ms/query, one million unmatched rows already imply ~33 minutes of serial query time before considering network, contention, retries, and parallelism limits. Candidate generation should therefore be a distributed join.

### Why not broadcast the entire internal dataset?

Broadcasting can be a valid optimization when one side is genuinely small, but at 10M rows it creates unnecessary replication, serialization, driver/executor pressure, and memory overhead. Partitioning both datasets by deterministic join keys is the safer default.

### Why not use a read replica for the internal ledger?

A stale replica can cause a false `MISSING_INTERNAL_RECORD`. Reconciliation should operate from a consistent snapshot/CDC-derived dataset with an explicit as-of time.

### Why separate business key and content hash?

A repeated statement line with modified content is not necessarily a duplicate. It is potentially a source-data integrity problem and should be detectable.

---

## 17. Self-Evaluation Checklist

- [x] **Ingestion Architecture**: S3 → SQS → distributed parser → canonical S3 dataset.
- [x] **Multi-Format Support**: MT940, CAMT.053, CSV/Fixed-Width adapters.
- [x] **Matching Architecture**: Distributed exact join + distributed fuzzy candidate generation.
- [x] **1:1 Correctness**: Explicit duplicate detection and deterministic ownership resolution.
- [x] **Break Categorization**: Missing Internal, Missing External, Value/Currency Mismatch, plus ambiguity/quarantine handling.
- [x] **Idempotency**: Business identity + content hash + durable ingestion state.
- [x] **Scaling & Capacity**: 50M records, >7K records/sec, Spark sizing assumptions, benchmark comparisons.
- [x] **Storage Math**: Correct raw logical-volume calculation; physical sizing explicitly called out as workload dependent.
- [x] **Failure Recovery**: Bank delays, executor OOM, duplicate deliveries, snapshot failure, false positives, skew, and replay.
- [x] **Observability**: Batch duration, throughput, match rate, break rate, candidate explosion, skew, and invariant checks.
- [x] **Auditability**: Immutable S3 inputs, batch IDs, engine versioning, deterministic replay.
