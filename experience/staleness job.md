Staleness job

Capacity & Memory Math
* Memory Footprint: $6\text{, }000\text{ RICs} \times 1\text{ KB/RIC} = 6\text{ MB}$ raw payload.
    * Systems Insight: $6\text{ MB}$ fits comfortably inside modern CPU L3 caches (typically $16\text{ MB}$–$64\text{ MB}$), enabling sub-microsecond in-memory reads without hitting network or disk I/O.
* Throughput & Batching:
    * Batching: $10\text{ RICs per batch} \implies 600\text{ total batch requests}$ to evaluate the entire universe of $6\text{, }000\text{ RICs}$.
    * Throughput: $3\text{, }000\text{ RPS}$ capacity $\implies 3\text{, }000 \times 10 = 30\text{, }000\text{ RIC evaluations/sec}$.
    * Latency Target: Processing the full $6\text{, }000\text{ RIC}$ universe takes $\approx 200\text{ ms}$ on a single multi-threaded instance ($600\text{ batches} / 3\text{, }000\text{ RPS}$).
Algorithmic Breakdown
* Temporal Staleness Check:
    * Algorithm: Binary Search ($O(\log K)$ where $K$ is the number of active time intervals) on pre-sorted validity windows to determine interval overlap instantly.
* Dependency Cascade & Pruning:
    * Algorithm: Memoized Directed Graph Traversal (DFS/Memoization).
    * Optimization: Prunes duplicate downstream subgraph evaluations, reducing worst-case exponential path checks ($O(2^V)$) to linear time ($O(V + E)$).
Polished Interview Pitch
"To detect market data staleness across $6\text{, }000\text{ RICs}$, I engineered an in-memory batch processing engine designed for ultra-low latency. With a total memory footprint of just $6\text{ MB}$, the entire dataset sits in RAM, allowing CPU cache-friendly lookups without database bottlenecks. I optimized interval validation using $O(\log K)$ binary search to find out if the current time is within an active interval and applied memoized DFS traversal to prune redundant subgraphs in the market data dependency tree. By batching $10\text{ RICs}$ per request, a single service instance handled $3\text{, }000\text{ RPS}$—yielding a throughput of $30\text{, }000\text{ RIC checks/sec}$ and completing full-universe staleness checks in under $200\text{ ms}$."