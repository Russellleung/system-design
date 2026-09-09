# Spec 1.5: Sliding Window Rate Limiter

## 1. Problem Statement
Financial APIs (e.g., payment gateways, FX rate streams) require rate limiting to prevent system overload and denial-of-service (DoS). We require a high-throughput, thread-safe sliding window log rate limiter per client key.

## 2. Interface & Types (Java)

```java
public class Spec1_5 {

    public interface SlidingWindowRateLimiter {
        boolean allowRequest(String clientId, long currentTimestampMs);
        void sweepStaleClients(long currentTimestampMs);
    }
}
```

## 3. Constraints & Rules
* **Window SLA**: Enforce `maxRequests` per `windowSizeMs`.
* **Accuracy**: Prevent boundary burst attacks.
* **Pruning Math**: Iterate over log state to clear expired timestamps at front (acceptable $O(K \cdot N)$ given short window horizons).

## 4. Complete Implementation (Java)

```java
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class SlidingWindowRateLimiter {

    private final int maxRequests;
    private final long windowSizeMs;
    private final Map<String, Deque<Long>> clientLogs = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter(int maxRequests, long windowSizeMs) {
        if (maxRequests <= 0 || windowSizeMs <= 0)
            throw new IllegalArgumentException("Parameters must be positive");
        this.maxRequests = maxRequests;
        this.windowSizeMs = windowSizeMs;
    }

    public boolean allowRequest(String clientId, long currentTimestampMs) {
        long windowStart = currentTimestampMs - windowSizeMs;
        Deque<Long> timestamps = clientLogs.computeIfAbsent(clientId, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst() <= windowStart) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests)
                return false;

            timestamps.add(currentTimestampMs);
            return true;
        }
    }



    public static void main(String[] args) {
        System.out.println("=== Spec 1.5: Sliding Window Rate Limiter Demo ===");
        SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(3, 1000L);
        String client = "CLIENT_A";

        long now = 100000L;
        System.out.println("Req 1 at t=100,000ms: " + limiter.allowRequest(client, now)); // true
        System.out.println("Req 2 at t=100,200ms: " + limiter.allowRequest(client, now + 200)); // true
        System.out.println("Req 3 at t=100,500ms: " + limiter.allowRequest(client, now + 500)); // true
        System.out.println("Req 4 at t=100,800ms: " + limiter.allowRequest(client, now + 800)); // false
        System.out.println("Req 5 at t=101,050ms: " + limiter.allowRequest(client, now + 1050)); // true

        System.out.println("=== Demo Execution Successful ===");
    }
}
```
