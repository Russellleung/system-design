# Handling Kafka Hot Partitions with Skewed Market Data (RICs)

## 1. Problem Statement
When streaming market data via Kafka, a common approach is to use the ticker symbol (RIC - Reuters Instrument Code) as the partition key. This guarantees that all ticks for a specific asset (e.g., `AAPL.O`) land on the same partition, preserving strict chronological ordering.

However, financial markets exhibit extreme power-law (Zipfian) distributions. A few highly liquid assets (like `AAPL`, `SPY`, `TSLA`) generate orders of magnitude more ticks than illiquid small-cap stocks.
This results in **Hot Partitions**:
- The massive volume of a hot RIC dominates its assigned partition.
- The single Kafka consumer thread assigned to that partition becomes completely CPU-bound or network-bound.
- This consumer lags behind real-time, while consumers assigned to "cold" partitions sit idle. 

## 2. Detection & Metrics
Before fixing the problem, you must mathematically prove it exists and monitor it.

### Step 1: Instrument Consumer Lag
You must export consumer lag at the **partition level**, not just the topic level.
* **Metric**: `kafka_consumergroup_lag` (tagged by `topic` and `partition`).
* **Symptom**: If `max(lag)` across all partitions is severely disconnected from `avg(lag)` (e.g., Partition-4 has 500k lag, while Partitions 1, 2, 3 have 0 lag), you have a hot partition.

### Step 2: Instrument Compute Utilization
* **Metric**: Container/Pod CPU usage OR consumer thread busy-time percentage.
* **Symptom**: One worker pod is pegged at 100% CPU, while others are at 10%.

### Step 3: View Ingress Byte Skew
* **Metric**: `kafka_server_brokertopicmetrics_bytesinpersec` (tagged by `partition`).
* **Symptom**: The broker shows disproportionate bytes flowing into a specific partition at the Producer stage.

---

## 3. Balancing Strategies

The solution depends entirely on one question: **Is strict absolute ordering per-RIC required?**

### Approach 1: Key Salting (If strict ordering is NOT required)
If downstream consumers simply aggregate global metrics (e.g., counting total ticks globally across all stocks in a 1-second window) and do not care if tick $T_1$ for AAPL arrives after tick $T_2$:

* **How it works**: Change the producer's partition key from `RIC` to a compound key: `RIC + "-" + (random() % N)`.
  * e.g., `AAPL-0`, `AAPL-1`, `AAPL-2`.
* **Result**: AAPL ticks are perfectly distributed across `N` partitions.
* **Verdict**: Extremely effective, but almost never viable for trading systems where time-sequence state books must be rebuilt exactly in order.

### Approach 2: Custom Weighted Partition Assignment
Instead of using Kafka's default `RangeAssignor` or `RoundRobinAssignor`, implement a custom `ConsumerPartitionAssignor`.

* **How it works**: You maintain a dynamic lookup table of "Historical RIC Volumes." The custom assignor uses this metadata to pack partitions to consumers based on weight (bin-packing algorithm).
* **Result**: It ensures that a consumer assigned to the "AAPL" partition is *only* assigned to that partition, while another consumer gets assigned 50 "cold" partitions.
* **Verdict**: Good for moderately skewed loads, but fails if AAPL alone exceeds the computing capacity of a single consumer pod thread.

### Approach 3: Decoupled IO and Compute (The Actor / Dispatcher Model)
This is the **industry-standard architecture** for ultra-low latency trading systems that must maintain ordering despite massive skew. 

Here, you stop relying on Kafka partition assignment to balance your compute. 

* **The Concept**: The Kafka Consumer threads do effectively *zero business logic*. They exist solely to pull bytes off the network as fast as possible. Once pulled, they dispatch the ticks to an massive internal pool of worker threads.
* **How it maintains order**: By using an internal `ConcurrentHashMap<String, Queue>` (or an Actor system like Akka), you hash the `RIC` to an internal worker thread. 

```text
[ Kafka Topic: 16 Partitions ]
          |
   (Fast network fetch)
          v
[ Kafka Consumer (Pod 1) ] ------------> (Commits offset only when Local Buffer is fully drained)
          |
   (In-App Dispatch)
   Hash(RIC) % 64 Internal Threads
          |
   +------+------+------+------+
   |             |             |
[ Worker 1 ]  [ Worker 2 ]  [ Worker 64 ]
(Processes   (Processes
 AAPL seq)    MSFT seq)
```

**Why this works:**
Even if all `AAPL` ticks come from a single Kafka partition (pulled by a single consumer thread), the compute-heavy business logic (building order books, calculating Greeks, persisting to DB) is executed by the 64 internal thread pool workers. The CPU load is distributed perfectly across the Pod's cores.

**The Catch (Offset Management):**
If you pull messages fast and dispatch them to internal threads, you **cannot** blindly auto-commit offsets to Kafka. You must implement custom offset tracking:
1. Turn off `enable.auto.commit`.
2. As internal workers complete their RIC ticks, update an internal map of the "lowest uncompleted offset".
3. The Kafka Consumer periodically commits the exact minimum offset of all in-flight messages for that partition to ensure zero data loss on crash.

### Approach 4: Topic Splitting (Fast-Path / Slow-Path)
* **How it works**: Producers maintain a dynamic config of the top 50 most active RICs.
  * Active RICs are published to `market-ticks-hot` (128 partitions).
  * The rest are published to `market-ticks-cold` (16 partitions).
* **Verdict**: Useful at the infrastructure layer if hot RICs are actually overwhelming the disk IO of the Kafka Brokers themselves, long before it even reaches the consumers.

---

## 4. Summary Recommendation

1. **Step 1:** Mathematically prove the skew using `kafka_consumergroup_lag` per-partition.
2. **Step 2:** If sequence ordering doesn't matter, salt the key (Approach 1).
3. **Step 3:** If sequence ordering matters and business logic is heavy, decouple the Kafka IO from the Compute using an internal dispatcher/Actor model (Approach 3). This lets you scale out internal threads to consume the hot partition without relying on Kafka's rebalance protocols.
