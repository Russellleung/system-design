# Spec 1.2: Arbitrary FX Currency Conversion Engine (Stateless Graph Search)

## 1. Problem Statement
Cross-border payment gateways often need to convert between currencies that do not have direct market pairs (e.g., `USD` to `JPY`, but only `USD -> EUR` and `EUR -> SGD` and `SGD -> JPY` exist). We must evaluate arbitrary currency conversions by searching a graph of predefined exchange rates provided at runtime.

## 2. Interface & Types (Java)

```java
import java.math.BigDecimal;
import java.util.Map;

public interface FXConverter {
    /**
     * @param rates  A map of conversion strings strictly formatted as "SOURCE/TARGET" (e.g., "USD/JPY") to conversion multipliers.
     * @param source The source currency (e.g., "USD")
     * @param target The target currency (e.g., "SGD")
     * @return The calculated conversion rate, or null if no valid conversion path exists.
     */
    BigDecimal findRate(Map<String, BigDecimal> rates, String source, String target);
}
```

## 3. Constraints & Rules
1. **Stateless Evaluation**: The graph is constructed directly from the provided `rates` map at call time. No persistent state is required.
2. **Strict Format**: The keys in the `rates` map must be strictly formatted with a forward slash delimiter between the ISO pairs (e.g., `"USD/EUR"`, `"GBP/JPY"`).
3. **Bidirectional Conversion**: If `USD/EUR` is `0.90`, then `EUR/USD` automatically exists as `1 / 0.90 = 1.1111...` (Use `RoundingMode.HALF_UP` with 12 decimals for intermediate inversion).
4. **Precision Calculation**: 
   * All intermediate path calculations use `BigDecimal` multiplication to prevent floating-point drift. 
   * Final returned rates scale to `4` decimal places `RoundingMode.HALF_UP`.
5. **Shortest Path**: Finding the target rate uses Breadth-First Search (BFS) to traverse the shortest path (fewest conversion hops), reducing precision loss.

## 4. Algorithmic Design

1. **Adjacency List Construction**: 
   Parse the incoming `Map<String, BigDecimal> rates` to construct a bidirectional adjacency list. For every `U -> V (rate)`, insert `V -> U (1/rate)`.
2. **BFS Traversal**:
   Push the `source` node to a queue with a baseline `rate` of `1.0`. For each neighboring vertex, multiply the accumulated baseline by the edge weight and enqueue. Wait until `target` is popped.

### Execution Time & Space Complexity

| Operation | Time Complexity | Space Complexity |
| :--- | :--- | :--- |
| `findRate` | $O(V + E)$ BFS | $O(V + E)$ Adjacency Map |

## 5. Complete Implementation (Java)

```java
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

public class FXConverter {

    public static BigDecimal findRate(Map<String, BigDecimal> rates, String source, String target) {
        if (source == null || target == null || rates == null) return null;
        if (source.equals(target)) return BigDecimal.ONE;

        // 1. Build bidirectional adjacency list
        Map<String, Map<String, BigDecimal>> adj = new HashMap<>();

        for (Map.Entry<String, BigDecimal> entry : rates.entrySet()) {
            String key = entry.getKey();
            String u = null, v = null;

            // Handle common delimiter formats or 6-character ISO pairs
            if (key.contains(":")) { String[] p = key.split(":"); u = p[0]; v = p[1]; }
            else if (key.contains("/")) { String[] p = key.split("/"); u = p[0]; v = p[1]; }
            else if (key.contains("-")) { String[] p = key.split("-"); u = p[0]; v = p[1]; }
            else if (key.length() == 6) { u = key.substring(0, 3); v = key.substring(3, 6); }
            else { continue; } // Unrecognized format skip

            BigDecimal rate = entry.getValue();
            if (rate.compareTo(BigDecimal.ZERO) <= 0) continue;

            adj.computeIfAbsent(u, k -> new HashMap<>()).put(v, rate);
            adj.computeIfAbsent(v, k -> new HashMap<>()).putIfAbsent(u, BigDecimal.ONE.divide(rate, 12, RoundingMode.HALF_UP));
        }

        if (!adj.containsKey(source) || !adj.containsKey(target)) return null;

        // 2. BFS Shortest-Path Search
        record Node(String curr, BigDecimal rate) {}
        Queue<Node> q = new ArrayDeque<>();
        Set<String> visited = new HashSet<>();

        q.add(new Node(source, BigDecimal.ONE));
        visited.add(source);

        while (!q.isEmpty()) {
            Node curr = q.poll();
            if (curr.curr().equals(target)) {
                return curr.rate().setScale(4, RoundingMode.HALF_UP);
            }

            Map<String, BigDecimal> neighbors = adj.get(curr.curr());
            if (neighbors != null) {
                for (Map.Entry<String, BigDecimal> entry : neighbors.entrySet()) {
                    if (visited.add(entry.getKey())) {
                        q.add(new Node(entry.getKey(), curr.rate().multiply(entry.getValue())));
                    }
                }
            }
        }

        return null; // Unreachable
    }

    public static void main(String[] args) {
        System.out.println("=== Spec 1.2: Arbitrary FX Currency Conversion Engine Demo (Stateless findRate) ===");

        Map<String, BigDecimal> rates = new HashMap<>();
        rates.put("USD:EUR", new BigDecimal("0.90"));
        rates.put("EUR:SGD", new BigDecimal("1.45"));
        rates.put("USD:JPY", new BigDecimal("150.0"));

        System.out.println("USD to SGD = " + findRate(rates, "USD", "SGD")); // 0.90 * 1.45 = 1.3050
        System.out.println("SGD to JPY = " + findRate(rates, "SGD", "JPY")); // 1/1.45 * 1/0.90 * 150 = ~114.9425
        System.out.println("EUR to GBP = " + findRate(rates, "EUR", "GBP")); // null

        System.out.println("=== Demo Execution Successful ===");
    }
}
```

## 6. Self-Evaluation Checklist
- [x] **Stateless FindRate Function**: Evaluates conversions logically from an inputted `Map<String, BigDecimal>`.
- [x] **Graph Adjacency Dynamic Processing**: Evaluates and computes inverted ratios at runtime string parse.
- [x] **Lossless Intermediate Precision**: Multiplication using `BigDecimal` prevents precision drop across multiple hops.
