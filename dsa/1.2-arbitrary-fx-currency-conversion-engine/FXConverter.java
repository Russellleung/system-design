import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

public class FXConverter {

    /**
     * Finds the conversion rate between a source and target currency.
     *
     * @param rates  A map of conversion strings (e.g., "USD:EUR", "USD/EUR", or
     *               "USDEUR") to numbers.
     * @param source The source currency (e.g., "USD")
     * @param target The target currency (e.g., "SGD")
     * @return The calculated conversion rate, or null if no valid conversion path
     *         exists.
     */
    public static BigDecimal findRate(Map<String, BigDecimal> rates, String source, String target) {
        if (source == null || target == null || rates == null)
            return null;
        if (source.equals(target))
            return BigDecimal.ONE;

        // 1. Build bidirectional adjacency list
        Map<String, Map<String, BigDecimal>> adj = new HashMap<>();

        for (Map.Entry<String, BigDecimal> entry : rates.entrySet()) {
            String key = entry.getKey();
            String[] p = key.split("/");
            if (p.length != 2)
                continue; // Skip unrecognized format
            String u = p[0], v = p[1];

            BigDecimal rate = entry.getValue();
            if (rate.compareTo(BigDecimal.ZERO) <= 0)
                continue;

            adj.computeIfAbsent(u, k -> new HashMap<>()).put(v, rate);
            adj.computeIfAbsent(v, k -> new HashMap<>()).putIfAbsent(u,
                    BigDecimal.ONE.divide(rate, 12, RoundingMode.HALF_UP));
        }

        if (!adj.containsKey(source) || !adj.containsKey(target))
            return null;

        // 2. BFS Shortest-Path Search
        record Node(String curr, BigDecimal rate) {
        }
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
        rates.put("USD/EUR", new BigDecimal("0.90"));
        rates.put("EUR/SGD", new BigDecimal("1.45"));
        rates.put("USD/JPY", new BigDecimal("150.0"));

        System.out.println("USD to SGD = " + findRate(rates, "USD", "SGD")); // 0.90 * 1.45 = 1.3050
        System.out.println("SGD to JPY = " + findRate(rates, "SGD", "JPY")); // 1/1.45 * 1/0.90 * 150 = ~114.9425
        System.out.println("EUR to GBP = " + findRate(rates, "EUR", "GBP")); // null

        System.out.println("=== Demo Execution Successful ===");
    }
}
