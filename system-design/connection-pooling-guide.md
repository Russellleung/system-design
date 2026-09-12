# Database Connection Pooling & Capacity Sizing

When designing systems, calculating database connection limits is one of the most critical factors for ensuring high throughput and preventing cascading failures under load. This guide details how to size connection pools for both the Database layer (e.g., PostgreSQL) and the Application layer (e.g., HikariCP / Spring Boot).

## 1. The Core Misconception: "More Connections = More QPS"
A common anti-pattern is setting an application's connection pool to 500+ connections per node, assuming this scales throughput capabilities. The exact opposite is true.

* **Context Switching (CPU Thrashing):** An OS process running PostgreSQL can only actively execute queries up to the number of physical CPU cores. If a database has 64 cores, but 5,000 active connections attempt to execute queries simultaneously, the database CPU spends almost all its time aggressively context-switching between threads rather than executing the actual work. Performance drops exponentially.
* **Connection Multiplexing:** A single database connection does not handle just one user. If a single SQL query executes in 2 milliseconds, that *single connection* sequentially flushes 500 Queries Per Second (QPS). Therefore, a small pool of 30 connections multiplexed correctly on an application server can drive 15,000 QPS down to the database.

## 2. Memory Overhead of Connections
In PostgreSQL specifically, an entirely new OS process is forked for every single connection.
* **Idle Memory Cost:** Each connection consumes ~5 to 10 MB of RAM purely for baseline overhead, regardless of whether it is executing a query or sitting completely idle.
* **Execution Memory Cost:** Complex queries using `work_mem` for operations like sorting or hash joins will radically expand this footprint.
* **The Danger:** A limit of 5,000 connections instantly burns ~50 GB of RAM. This starves the database of OS Page Cache and `shared_buffers` memory, crushing index lookup efficiency and shifting the database from fast RAM-reads to extremely slow Disk-reads.

## 3. Calculating the Limits

### A) The Database Layer (Global Limit)
Database administrators define this absolute ceiling via the `max_connections` setting in PostgreSQL.

* **The Golden Formula (Based on HikariCP/Postgres Research):** 
  `Optimal DB Connections = (CPU Core Count × 2) + Effective Disk Spindles`
* **Example:** For a powerful 64-core Database Server, the optimal globally active connection ceiling is generally between **150 and 300 connections**.

*(Note: If your microservice architecture legitimately demands 10,000 concurrent client connections hanging idle, you must deploy a layer-7 connection pooler like **PgBouncer** directly in front of the database. PgBouncer holds 10,000 lightweight client connections in memory, but routes them down to ~200 heavy PostgreSQL connections).*

### B) The Application Server Layer (Per Node Limit)
The application server configuration (e.g., Java Spring Boot's HikariCP) must be calculated dynamically based on your auto-scaling deployment model.

* **The Formula:**
  `App Node Pool Size = (Global DB max_connections) / (Peak Number of Auto-Scaled App Nodes)`
* **Example (Configuring HikariCP):** If your DBA sets the database `max_connections` to 300, and your Kubernetes application cluster aggressively auto-scales up to a maximum of 10 Pods during Black Friday, you must configure each Pod's maximum connection pool size to **30**.

#### Example Spring Boot (`application.yml`) Configuration:
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 30
      minimum-idle: 10
      connection-timeout: 30000
```

### 4. Summary Configuration Matrix
| Architecture Scale | Peak App Nodes | DB `max_connections` | HikariCP `maximum-pool-size` (per node) |
| :--- | :--- | :--- | :--- |
| Internal Admin Tool | 1 | 100 | 80 |
| Standard SaaS App | 4 | 200 | 45 |
| Microservices Spike Event | 20 | 300 | 12 |
| Serverless / Lambda | 10,000+ | Requires PgBouncer | N/A (PgBouncer multiplexes connections) |
