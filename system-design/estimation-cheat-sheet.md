# System Design Estimation Cheat Sheet

A senior engineer's reference for back-of-the-envelope calculations. Every number here is a real-world benchmark or industry standard you should be able to recall and apply in an interview.

---

## 1. Latency Numbers Every Engineer Should Know

| Operation | Latency | Order of Magnitude |
| :--- | :--- | :--- |
| L1 cache reference | 0.5 ns | |
| Branch mispredict | 5 ns | |
| L2 cache reference | 7 ns | |
| Mutex lock/unlock | 25 ns | |
| L3 cache reference | ~30 ns | |
| Main memory (DRAM) reference | 100 ns | |
| Compress 1 KB with Snappy | 3 μs | |
| **Read 1 MB sequentially from memory** | **250 μs** | ← key number |
| Round trip within same datacenter | 500 μs | |
| **SSD random read** | **100 μs** | |
| **Read 1 MB sequentially from SSD** | **1 ms** | ← key number |
| HDD seek | 10 ms | |
| **Read 1 MB sequentially from HDD** | **20 ms** | |
| **Read 1 MB sequentially from network (1 Gbps)** | **10 ms** | ← key number |
| Send packet CA → Netherlands → CA | 150 ms | |
| TLS handshake | 5–50 ms | (1-RTT with TLS 1.3) |
| TCP handshake (SYN-ACK) | 0.5–150 ms | (depends on distance) |
| **PostgreSQL simple query (indexed lookup)** | **1–5 ms** | |
| **PostgreSQL WAL fsync (commit)** | **1–3 ms** (NVMe) | 5–10 ms on EBS gp3 |
| **Redis GET/SET** | **0.1–0.5 ms** | (network-bound, not CPU) |
| **Redis Lua script (3–5 commands)** | **0.2–1 ms** | |
| **Kafka produce (acked)** | **2–5 ms** | (replication to ISR) |
| **HTTP API call (in-VPC)** | **1–5 ms** | |
| **HTTP API call (cross-region)** | **50–200 ms** | |
| **DNS lookup (uncached)** | **20–120 ms** | |

### Rule of Thumb: The "Powers of 10" Ladder
```
Nanoseconds (ns)   →  CPU cache, branch prediction
Microseconds (μs)  →  Memory access, mutex, SSD read
Milliseconds (ms)  →  Disk I/O, network call, DB query
Seconds (s)        →  Cross-region, cold start, large scan
```

---

## 2. Typical Server Node Hardware Profiles

### The "Default Interview Server" — What to Assume

When an interviewer says "a server" or "a node" without specifying, assume this baseline:

```
CPU:      8 vCPUs  (4 physical cores, hyper-threaded)
Memory:   32 GB RAM
NIC:      10 Gbps  (≈ 1.25 GB/sec throughput)
Disk:     500 GB SSD (NVMe or EBS gp3)
OS:       Linux (Ubuntu / Amazon Linux)
```

This maps approximately to an **AWS m6i.2xlarge** or **GCP n2-standard-8** — the workhorse general-purpose instance most production services run on.

### Full Hardware Ranges (Cloud Servers)

**CPU Range:**
| Tier | vCPUs | Physical Cores | Typical Instance | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| Minimum | 1–2 | 1 | t3.micro / t3.small | Dev, cron jobs, bastion hosts |
| Small | 4 | 2 | m6i.xlarge | Light API service, sidecar |
| **Standard** | **8** | **4** | **m6i.2xlarge** | **Typical production app node** |
| Medium | 16–32 | 8–16 | c6i.4xlarge / c6i.8xlarge | Compute workers, mid-size DB |
| Large | 64–96 | 32–48 | m6i.16xlarge / c6i.24xlarge | Heavy DB, Elasticsearch, Kafka |
| Maximum | 192–448 | 96–224 | u-24tb1.112xlarge / p5.48xlarge | HPC, ML training, SAP HANA |

**Memory (RAM) Range:**
| Tier | RAM | Typical Instance | Use Case |
| :--- | :--- | :--- | :--- |
| Minimum | 0.5–4 GB | t3.nano – t3.medium | Microservices, lightweight proxies |
| Small | 8–16 GB | m6i.large / m6i.xlarge | Standard web server, worker |
| **Standard** | **32 GB** | **m6i.2xlarge** | **Typical production node** |
| Medium | 64–128 GB | r6i.2xlarge / r6i.4xlarge | Redis, application caches, mid DB |
| Large | 256–512 GB | r6i.8xlarge / r6i.16xlarge | Large PostgreSQL, Elasticsearch |
| Very Large | 1–2 TB | x2idn.24xlarge / x2idn.32xlarge | In-memory OLAP, SAP HANA |
| Maximum | 6–24 TB | u-24tb1.112xlarge | Extreme in-memory (SAP, mainframe migration) |

**NIC Bandwidth Range:**
| Tier | Bandwidth | Throughput | Typical Instance | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| Burst | Up to 5 Gbps | ~625 MB/sec (burst) | t3.* | Dev, low-traffic |
| Small | Up to 12.5 Gbps | ~1.5 GB/sec | m6i.xlarge – m6i.4xlarge | Standard API servers |
| **Standard** | **Up to 12.5 Gbps** | **~1.5 GB/sec** | **m6i.2xlarge** | **Typical production node** |
| Enhanced | 25 Gbps | ~3.1 GB/sec | m6i.8xlarge+, r6i.8xlarge+ | DB replication, heavy inter-service |
| High | 50 Gbps | ~6.25 GB/sec | c6in.16xlarge | Kafka brokers, storage gateways |
| Maximum | 100–200 Gbps | 12.5–25 GB/sec | c6gn.16xlarge, p5.48xlarge | Network-optimized LBs, HPC, ML distributed training |

**Summary — The Ranges to Cite in an Interview:**
```
          MIN         TYPICAL       MAX
CPU:      1 vCPU      8 vCPUs       448 vCPUs
RAM:      0.5 GB      32 GB         24 TB
NIC:      5 Gbps      10 Gbps       200 Gbps
Disk:     10 GB       500 GB        60 TB (instance storage)
```

### Cloud Instance Profiles (AWS EC2 as Reference)

| Instance | vCPUs | Memory | NIC Bandwidth | Disk | Use Case | $/hr (on-demand) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **t3.medium** | 2 | 4 GB | Up to 5 Gbps (burst) | EBS only | Dev/test, low-traffic | $0.042 |
| **m6i.xlarge** | 4 | 16 GB | Up to 12.5 Gbps | EBS only | Small API service | $0.192 |
| **m6i.2xlarge** | 8 | 32 GB | Up to 12.5 Gbps | EBS only | **Standard production node** | $0.384 |
| **m6i.4xlarge** | 16 | 64 GB | Up to 12.5 Gbps | EBS only | Medium DB, cache | $0.768 |
| **c6i.8xlarge** | 32 | 64 GB | 12.5 Gbps | EBS only | CPU-heavy (compute workers) | $1.36 |
| **r6i.4xlarge** | 16 | 128 GB | Up to 12.5 Gbps | EBS only | Memory-heavy (Redis, in-memory DB) | $1.008 |
| **r6i.16xlarge** | 64 | 512 GB | 25 Gbps | EBS only | Large PostgreSQL / Elasticsearch | $4.032 |
| **i3en.2xlarge** | 8 | 64 GB | Up to 25 Gbps | 2 × 2.5 TB NVMe | Storage-heavy (Kafka, Cassandra) | $0.904 |
| **c6gn.16xlarge** | 64 | 128 GB | **100 Gbps** | EBS only | Network-heavy (load balancer, proxy) | $2.764 |

### NIC Bandwidth: What You Need to Know

| NIC Speed | Throughput | Packets/sec (small frames) | When You Hit It |
| :--- | :--- | :--- | :--- |
| **1 Gbps** | 125 MB/sec | ~150K pps | Legacy / small VMs. Bottleneck for file transfers. |
| **10 Gbps** | 1.25 GB/sec | ~1.5M pps | **Standard for most cloud instances.** Sufficient for 100K+ API req/sec at 5 KB avg response. |
| **25 Gbps** | 3.1 GB/sec | ~3M pps | Large instances (r6i.16xlarge). Needed for DB replication, Kafka ISR, HDFS. |
| **100 Gbps** | 12.5 GB/sec | ~10M pps | Network-optimized instances. HPC, load balancers, CDN origin servers. |

**Rule of thumb**: You almost never saturate NIC before CPU on a typical API server. A 10 Gbps NIC supports **100,000 req/sec × 10 KB response = 1 GB/sec** — well within limit. NIC becomes the bottleneck for:
- Large file transfers / object storage proxying
- Database replication (shipping WAL at high write rates)
- Kafka brokers with high partition throughput

### Database Disk Sizing Rules of Thumb

```
The "Default Database Node" to assume in interviews:
  CPU:    16 vCPUs
  Memory: 128 GB RAM
  Disk:   1 TB SSD (EBS io2 or NVMe)
  NIC:    Up to 12.5 Gbps
```

**Key ratios:**
| Rule | Value | Why |
| :--- | :--- | :--- |
| **Disk : Memory ratio** | 5–10× | If you have 128 GB RAM, a 1 TB dataset means ~12% is hot-cached. For OLTP where 80/20 applies (20% of data is hot), 128 GB caches the hot set. |
| **When to shard** | Single node > 5–10 TB, or write TPS > 15K | Beyond this, single-node PostgreSQL hits I/O or CPU wall |
| **WAL / binlog overhead** | +20–30% of data size | Write-ahead log segments, replication slots |
| **Index overhead** | +30–50% of table size | B-tree indexes. More indexes = more disk + slower writes. |
| **Compaction headroom (LSM-tree DBs)** | 2× data size | Cassandra, RocksDB need temp space during compaction |
| **Actual usable disk** | ~60–70% of raw disk | After WAL, indexes, compaction, temp files, OS |

**Example**: "How big a disk for 500M user profiles at 500 bytes each?"
```
Raw data:     500M × 500B = 250 GB
+ Indexes:    250 GB × 0.4 = 100 GB
+ WAL:        250 GB × 0.25 = 63 GB
+ Headroom:   30% buffer
= Total:      (250 + 100 + 63) × 1.3 ≈ 537 GB → provision 1 TB disk
Memory:       Hot 20% = 50 GB → 64–128 GB RAM instance
```

### Quick Conversion: "How Many Servers Do I Need?"

```
servers_needed = peak_TPS / throughput_per_server

Where throughput_per_server depends on workload:
  - API + DB call:     ~3,000 req/sec per 8-vCPU node
  - API + Redis only:  ~10,000 req/sec per 8-vCPU node
  - Static proxy:      ~30,000 req/sec per 8-vCPU node
  - CPU-heavy compute: ~500 req/sec per 8-vCPU node

Add 50% headroom for safety:
  servers_needed = (peak_TPS / throughput_per_server) × 1.5

Example: 50,000 peak TPS, API + DB call
  = (50,000 / 3,000) × 1.5 = 25 servers
```

---

## 3. Throughput Numbers

### Database Systems

| System | Read TPS (single node) | Write TPS (single node) | Notes |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** (indexed lookup) | 50,000–100,000 | 5,000–15,000 | Write-bound by WAL fsync. 64 vCPU, NVMe SSD. |
| **PostgreSQL** (complex JOIN) | 500–2,000 | — | Depends on table size, indexes, `work_mem` |
| **MySQL / InnoDB** | 50,000–80,000 | 5,000–10,000 | Similar to PostgreSQL for OLTP |
| **Redis** (GET/SET) | **100,000–200,000** | **100,000–200,000** | Single-threaded; pipelined. 1 core saturates. |
| **Redis** (Lua script, 3 cmds) | **80,000–100,000** | Same | Atomic script = fewer ops/sec but richer logic |
| **DynamoDB** (on-demand) | 40,000 RCU/sec | 40,000 WCU/sec | Per table. Partition-key-aware. |
| **Cassandra** (single node) | 10,000–30,000 | 10,000–30,000 | Linear scale with nodes |
| **MongoDB** | 20,000–50,000 | 5,000–15,000 | WiredTiger, depends on document size |
| **Elasticsearch** (search) | 1,000–5,000 queries/sec | 5,000–20,000 docs/sec (bulk) | Per node. Search latency spikes under write load. |

### Message Queues

| System | Produce TPS (per partition/queue) | Consume TPS | Notes |
| :--- | :--- | :--- | :--- |
| **Kafka** | 100,000–200,000 msg/sec (per broker) | Same | Throughput scales linearly with partitions |
| **RabbitMQ** | 20,000–50,000 msg/sec | 20,000–50,000 | Persistent, acked messages |
| **AWS SQS** (Standard) | Unlimited (soft) | 3,000 msg/sec per API call | Batch: 10 msgs × 300 calls/sec |
| **AWS SQS** (FIFO) | 3,000 msg/sec (with batching) | Same | 300 API calls/sec × 10 msgs |
| **NATS** (core) | 10,000,000+ msg/sec | Same | In-memory, no persistence |
| **NATS JetStream** | 500,000+ msg/sec | Same | With persistence, Raft consensus |

### Web Servers / Application Servers

| Stack | Requests/sec (per instance) | Notes |
| :--- | :--- | :--- |
| **Nginx** (static files) | 50,000–100,000 | Event-driven, non-blocking |
| **Spring Boot** (REST, 4 cores) | 5,000–15,000 | Depends on handler complexity |
| **Node.js** (Express, 1 core) | 5,000–15,000 | Single-threaded event loop |
| **Go** (net/http, 4 cores) | 50,000–100,000 | Goroutines, minimal overhead |
| **gRPC** (Java, 4 cores) | 20,000–50,000 | Binary protocol, connection multiplexing |

---

## 3. Storage & Memory Sizing

### Data Size Rules of Thumb

| Data Type | Typical Size |
| :--- | :--- |
| UUID (string) | 36 bytes |
| UUID (binary) | 16 bytes |
| Timestamp (ISO 8601 string) | 25 bytes |
| Timestamp (epoch ms, bigint) | 8 bytes |
| Email address | 30–50 bytes |
| URL | 50–200 bytes |
| JSON object (small, ~5 fields) | 200–500 bytes |
| JSON object (medium, ~15 fields) | 1–3 KB |
| Average tweet / short message | 200–500 bytes (with metadata) |
| Average web page (HTML) | 50–100 KB |
| User profile row (RDBMS) | 200–500 bytes |
| Log line (structured JSON) | 200–500 bytes |
| Image thumbnail (100×100) | 5–10 KB |
| Compressed image (JPEG, 1080p) | 100–500 KB |
| 1 minute of MP3 audio | ~1 MB |
| 1 minute of video (720p, compressed) | ~5 MB |
| 1 minute of video (1080p, compressed) | ~15 MB |

### Quick Size Math

| Scale | Bytes | Human-Readable |
| :--- | :--- | :--- |
| $10^3$ | 1 KB | A short text message |
| $10^6$ | 1 MB | A photo |
| $10^9$ | 1 GB | ~250 photos / 1 hour of SD video |
| $10^{12}$ | 1 TB | ~13 million user profile rows @ 80 bytes |
| $10^{15}$ | 1 PB | ~1,000 TB |

### Memory Sizing

| Data Structure | Memory Per Entry | Notes |
| :--- | :--- | :--- |
| Java `HashMap<String,String>` entry | ~120–150 bytes overhead | Key + value + Entry object + hash + pointers |
| Java `String` (20 chars) | ~80 bytes | 40B object header + 40B char array |
| Redis `String` key-value pair | ~90 bytes overhead + data | Even a 1-byte value costs ~90 bytes total |
| Redis `Hash` field | ~70 bytes overhead + data | More efficient for multiple fields per key |
| Go `map[string]string` entry | ~100 bytes overhead | |
| PostgreSQL row overhead | ~23 bytes (tuple header) | Plus column data, TOAST for large values |

### Memory Capacity Planning Formula

```
Total Memory = (entries × bytes_per_entry) × overhead_factor

overhead_factor:
  - HashMap/Dict: 1.5× (load factor + fragmentation)
  - Redis: 1.2× (jemalloc fragmentation)
  - JVM: 2× (GC needs ~50% free heap to avoid GC thrashing)
```

**Example**: 10M user sessions in Redis, 500 bytes each:
```
10M × 500B × 1.2 = 6 GB Redis memory
JVM HashMap: 10M × 500B × 2.0 = 10 GB heap required
```

---

## 4. Bandwidth & Network

### Bandwidth Conversion

| Unit | Equivalent |
| :--- | :--- |
| 1 Gbps | 125 MB/sec |
| 10 Gbps | 1.25 GB/sec |
| 100 Mbps (typical home) | 12.5 MB/sec |
| 1 Mbps | 125 KB/sec |

### Bandwidth Estimation Formula

```
Bandwidth = (requests/sec) × (avg_response_size)

Example: 10,000 RPS × 5 KB avg response = 50 MB/sec = 400 Mbps
```

### CDN & Edge Stats

| Metric | Value |
| :--- | :--- |
| CloudFront edge locations | 400+ globally |
| CDN cache-hit ratio (well-tuned) | 90–99% |
| CDN latency (cache hit) | 1–10 ms (edge to user) |
| CDN bandwidth cost (AWS) | ~$0.085/GB (first 10 TB) |
| S3 PUT throughput | 3,500 PUT/sec per prefix |
| S3 GET throughput | 5,500 GET/sec per prefix |
| S3 transfer speed | Up to 100 Gbps per request with S3 Transfer Acceleration |

---

## 5. CPU & Compute

### CPU-Bound Operation Benchmarks

| Operation | Throughput (single core) | Notes |
| :--- | :--- | :--- |
| SHA-256 hash (1 KB) | ~500,000/sec | With hardware AES-NI |
| HMAC-SHA256 sign | ~1,000,000/sec | ~1 μs per operation |
| RSA-2048 sign | ~1,000/sec | ~1 ms per operation |
| RSA-2048 verify | ~30,000/sec | Verify is cheaper than sign |
| Ed25519 sign | ~30,000/sec | ~30 μs per operation |
| PBKDF2 password hash (100K iterations) | ~10/sec | Intentionally slow |
| bcrypt (cost=12) | ~3/sec | Intentionally slow |
| JSON parse (1 KB) | ~200,000/sec | Jackson / Gson |
| JSON serialize (1 KB) | ~300,000/sec | |
| Protobuf serialize (1 KB) | ~1,000,000/sec | 3–5× faster than JSON |
| gzip compress (1 KB) | ~100,000/sec | Level 6 (default) |
| Snappy compress (1 KB) | ~500,000/sec | Optimized for speed, not ratio |
| Regex match (simple) | ~5,000,000/sec | Pre-compiled pattern |

### CPU Sizing Rules of Thumb

```
1 vCPU ≈ 1 core ≈ handles ~1,000–5,000 "typical" API requests/sec
  (where "typical" = JSON parse + DB query + JSON serialize)

CPU-heavy workloads (image processing, ML inference):
  1 vCPU ≈ 10–100 operations/sec

IO-bound workloads (proxy, cache lookups):
  1 vCPU ≈ 10,000–50,000 operations/sec (event-driven / async)
```

**Threads ≈ Cores × 2** for mixed workloads (CPU + I/O wait).
**Threads ≈ Cores** for pure CPU workloads (avoid context switching).

---

## 6. Daily Volume Estimation Framework

### The DAU → TPS Formula

```
Given:
  DAU = Daily Active Users
  actions_per_user = avg actions per user per day
  peak_factor = peak-to-average ratio (typically 2×–5×)
  seconds_per_day = 86,400

Average TPS = (DAU × actions_per_user) / seconds_per_day
Peak TPS    = Average TPS × peak_factor
```

**Example**: Twitter-scale
```
DAU = 200M
actions_per_user = 5 (view timeline, post, like, follow, search)
average TPS = (200M × 5) / 86,400 ≈ 11,574 TPS
peak TPS = 11,574 × 3 ≈ 35,000 TPS
```

### Common Peak-to-Average Ratios

| Application Type | Peak Factor | Notes |
| :--- | :--- | :--- |
| Social media | 2–3× | Spikes during viral events |
| E-commerce | 3–5× | Flash sales, Black Friday |
| Ticketing | 10–100× | On-sale surge (30-second thundering herd) |
| Payment processing | 2–3× | Salary days, month-end |
| Streaming video | 2× | Prime time (8–11 PM local) |
| B2B SaaS | 1.5–2× | Business hours vs overnight |

### Storage Growth Formula

```
Daily Storage = (write_TPS × avg_record_size × 86,400)
Monthly Storage = Daily × 30
Yearly Storage = Daily × 365

With compression (typical 3–5× for text/JSON):
  Actual Storage = Raw Storage / compression_ratio
```

**Example**: Chat application
```
write_TPS = 5,000 messages/sec
avg_message_size = 500 bytes
daily = 5,000 × 500 × 86,400 = 216 GB/day
monthly = 216 × 30 = 6.5 TB/month raw
with compression (4×): ~1.6 TB/month
```

---

## 7. Connection & Concurrency Limits

| Resource | Typical Limit | Notes |
| :--- | :--- | :--- |
| PostgreSQL `max_connections` | 100–500 | Each conn ≈ 5–10 MB RAM. Use PgBouncer for pooling. |
| PostgreSQL via PgBouncer | 10,000+ client connections | Multiplexed to ~100 server connections |
| MySQL `max_connections` | 150–500 | Similar to PostgreSQL |
| Redis `maxclients` | 10,000 (default) | Can increase to 100,000 |
| HikariCP pool size | `cores × 2 + effective_spindle_count` | Typically 10–30 for 4-core app |
| TCP connections per port | 65,535 | Theoretical. `(local_ip, local_port, remote_ip, remote_port)` 4-tuple allows millions. |
| Linux file descriptors (default) | 1,024 (soft), 65,535 (hard) | Increase `ulimit -n` for high-connection servers |
| WebSocket connections per server | 50,000–100,000 | Bound by memory (~10 KB per connection) |
| HTTP/2 streams per connection | 100–256 (configurable) | Multiplexed on single TCP connection |
| Kubernetes pods per node | 110 (default) | Limited by kubelet |
| AWS ALB targets per target group | 1,000 | |

### DB Connection Pool Sizing Per App Server

A connection is **reused** — it runs query after query, not one-and-done. QPS per server = `pool_size × (1 / avg_query_time)`.

```
pool_size = PostgreSQL max_connections / number_of_app_servers

Example: max_connections = 300, 10 app servers → 30 connections each
Each connection at 5ms/query → 200 QPS per connection
30 connections × 200 QPS = 6,000 QPS per app server (theoretical max)
```

| App Servers | Pool Per Server | Total to DB | Scenario |
| :--- | :--- | :--- | :--- |
| 3 | 50–100 | 150–300 | Small startup |
| 10 | 20–30 | 200–300 | **Typical production** |
| 50 | 5–10 | 250–500 | Large microservices fleet |
| 200+ | 2–3 (must use PgBouncer) | 400–600 | Big fleet — direct connections are impossible |

**Why not just raise max_connections to 5,000?** PostgreSQL forks a process per connection. Above ~300–500 connections, OS context-switching overhead between processes exceeds actual query execution time — throughput **drops** even though you have more connections. PgBouncer solves this by multiplexing thousands of app connections onto ~100–300 actual DB connections.

---

## 8. Availability & SLA Math

### Nines Table

| Availability | Downtime/Year | Downtime/Month | Downtime/Week |
| :--- | :--- | :--- | :--- |
| 99% (two 9s) | 3.65 days | 7.31 hours | 1.68 hours |
| 99.9% (three 9s) | 8.77 hours | 43.83 min | 10.08 min |
| 99.95% | 4.38 hours | 21.92 min | 5.04 min |
| **99.99% (four 9s)** | **52.60 min** | **4.38 min** | **1.01 min** |
| 99.999% (five 9s) | 5.26 min | 26.30 sec | 6.05 sec |
| 99.9999% (six 9s) | 31.56 sec | 2.63 sec | 0.60 sec |

### Composite Availability

```
Serial (both must be up):       A_total = A₁ × A₂
Parallel (either can serve):    A_total = 1 - (1 - A₁)(1 - A₂)

Example: API → DB (serial)
  99.99% × 99.99% = 99.98%

Example: Two replicas (parallel)
  1 - (1 - 0.999)(1 - 0.999) = 1 - 0.000001 = 99.9999%
```

---

## 9. Replication & Consistency Costs

| Replication Type | Latency Impact | Durability | Use When |
| :--- | :--- | :--- | :--- |
| **Synchronous** (PostgreSQL `synchronous_commit = on`) | +1–5ms per write | Zero data loss on failover | Financial transactions, ledger |
| **Asynchronous** | 0 extra latency | Up to ~100ms of data loss on failover | Read replicas, analytics |
| **Semi-synchronous** (MySQL) | +1 ms (one replica ack) | Near-zero loss | Balanced durability/performance |
| **Kafka ISR replication** (acks=all) | +2–5ms | Zero loss within ISR | Event sourcing, outbox |
| **Redis replication** | Async by default (~sub-ms lag) | Can lose last ~100ms of writes | Cache, ephemeral data |

---

## 10. Quick Estimation Cheat: Common Systems

### URL Shortener (100M DAU)
```
Reads:  100M × 5 clicks/day / 86,400 = ~5,800 read TPS → cache-friendly
Writes: 1M new URLs/day / 86,400 = ~12 write TPS → trivial
Storage: 1M × 200B/day × 365 = ~73 GB/year
Cache:  Hot 20% of URLs = 200K × 200B = 40 MB (fits in any Redis)
```

### Chat System (50M DAU)
```
Messages: 50M × 20 msgs/day = 1B messages/day
Write TPS: 1B / 86,400 = ~11,600 TPS → sharded DB or Cassandra
Storage: 1B × 500B = 500 GB/day → 15 TB/month
WebSocket connections: 50M concurrent → 500 servers × 100K conn/server
Fanout (group chat): 50-member group × 11,600 msg/sec = 580K pushes/sec
```

### Social Feed (200M DAU)
```
Timeline reads: 200M × 10 refreshes/day / 86,400 = ~23,000 TPS
Posts written: 200M × 0.5 posts/day / 86,400 = ~1,200 TPS
Fanout-on-write: 1,200 posts/sec × 500 avg followers = 600K cache writes/sec
Storage (posts): 1,200 × 2KB × 86,400 = ~200 GB/day
Image storage: 200M × 0.1 uploads/day × 500KB = 10 TB/day
```

### E-Commerce (10M DAU)
```
Product page views: 10M × 15 views/day / 86,400 = ~1,700 TPS (CDN-cached)
Cart operations: 10M × 3/day / 86,400 = ~350 TPS
Orders: 10M × 0.05 orders/day / 86,400 = ~6 TPS → PostgreSQL single node
Payment calls: ~6 TPS (matches orders)
Peak (Black Friday): 6 × 20 = 120 TPS → still single node
```

---

## 11. The Estimation Interview Framework

### Step-by-Step Protocol

```
1. CLARIFY requirements (DAU, peak vs avg, read vs write ratio)
2. ESTIMATE daily volume (DAU × actions_per_user)
3. CONVERT to TPS (daily_volume / 86,400)
4. APPLY peak factor (2×–10× depending on domain)
5. SIZE storage (TPS × record_size × 86,400)
6. SIZE memory (hot dataset × overhead_factor)
7. SIZE bandwidth (TPS × response_size)
8. SIZE compute (TPS / per_core_throughput → cores needed)
9. VERIFY against known benchmarks (Redis: 100K ops/sec, PostgreSQL: 10K write TPS)
10. STATE assumptions and cross-check with 80/20 rule
```

### Key Ratios to Memorize

| Ratio | Value | Application |
| :--- | :--- | :--- |
| Read:Write ratio (social media) | 100:1 to 1000:1 | Cache reads aggressively |
| Read:Write ratio (chat) | 1:1 | Symmetric load |
| Read:Write ratio (e-commerce catalog) | 100:1 | CDN + cache |
| Read:Write ratio (logging/analytics) | 1:10 to 1:100 | Write-heavy; append-only |
| DAU / MAU ratio (healthy app) | 40–60% | "Stickiness" metric |
| DAU / registered users | 5–20% | Typical engagement |
| Seconds in a day | **86,400** | ← memorize this |
| Seconds in a month | ~2,500,000 | ~2.5M |
| 80/20 rule | 80% of traffic from 20% of users/data | Size hot cache for 20% of dataset |

### Sanity Check Numbers

| "If your answer exceeds this, re-check" | Threshold |
| :--- | :--- |
| Single PostgreSQL node write TPS | > 15,000 → you need sharding |
| Single Redis instance ops/sec | > 100,000 → you need cluster |
| Single server HTTP connections | > 100,000 → you need more servers |
| Response time for user-facing API | > 500ms → too slow |
| In-memory dataset size | > 256 GB → consider distributed cache |
| Single Kafka partition throughput | > 10 MB/sec → add partitions |
