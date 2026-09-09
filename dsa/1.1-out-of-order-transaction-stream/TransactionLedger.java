import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class TransactionLedger {

    public record Transaction(String id, String accountId, long timestamp, BigInteger amount) {
    }

    public record BalanceQuery(String accountId, long timestamp) {
    }

    private final Map<String, AccountLedger> accounts = new ConcurrentHashMap<>();

    public void addTransaction(Transaction txn) {
        accounts.computeIfAbsent(txn.accountId(), k -> new AccountLedger()).addTransaction(txn);
    }

    public BigInteger getBalanceAt(BalanceQuery query) {
        AccountLedger acc = accounts.get(query.accountId());
        return acc != null ? acc.getBalanceAt(query.timestamp()) : BigInteger.ZERO;
    }

    private static class AccountLedger {
        private final Set<String> processedTxnIds = new HashSet<>();
        private final Map<Long, BigInteger> fenwickTree = new HashMap<>();
        private static final long MAX_TS = 1_000_000_000_000_000L; // 10^15 limit max epoch ms

        public synchronized void addTransaction(Transaction txn) {
            if (!processedTxnIds.add(txn.id()))
                return; // Idempotent skip

            long i = txn.timestamp() + 1; // 1-index for Fenwick Tree logic
            BigInteger amount = txn.amount();

            // Point update: Add amount to Fenwick Tree in O(log MAX_TS)
            // Bitwise Logic (`i & -i` isolates the Least Significant Bit):
            // `i += i & -i` traverses UP the tree, hitting all subsequent nodes
            // that encompass this timestamp's range to distribute the delta.
            while (i <= MAX_TS) {
                fenwickTree.put(i, fenwickTree.getOrDefault(i, BigInteger.ZERO).add(amount));
                i += i & (-i); // Move to next responsible node
            }
        }

        public synchronized BigInteger getBalanceAt(long timestamp) {
            if (timestamp < 0)
                return BigInteger.ZERO;

            long i = Math.min(timestamp, MAX_TS - 1) + 1; // 1-index
            BigInteger sum = BigInteger.ZERO;

            // Range query [1, timestamp + 1] in O(log MAX_TS)
            // Bitwise Logic (`i & -i` isolates the Least Significant Bit):
            // `i -= i & -i` traverses DOWN the tree strictly through non-overlapping
            // interval nodes to aggregate the total prefix sum from 1 to i.
            while (i > 0) {
                if (fenwickTree.containsKey(i)) {
                    sum = sum.add(fenwickTree.get(i));
                }
                i -= i & (-i); // Move to parent node
            }
            return sum;
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Spec 1.1: Out-of-Order Transaction Stream Demo (Sparse Fenwick Tree) ===");
        TransactionLedger ledger = new TransactionLedger();
        String accId = "ACC_1001";

        ledger.addTransaction(new Transaction("tx1", accId, 1000L, BigInteger.valueOf(10000)));
        ledger.addTransaction(new Transaction("tx2", accId, 2000L, BigInteger.valueOf(-2000)));
        ledger.addTransaction(new Transaction("tx3", accId, 3000L, BigInteger.valueOf(-5000)));
        ledger.addTransaction(new Transaction("tx4", accId, 2000L, BigInteger.valueOf(-1500)));
        ledger.addTransaction(new Transaction("tx1", accId, 1000L, BigInteger.valueOf(10000))); // Duplicate

        System.out.println("Balance at t=500: " + ledger.getBalanceAt(new BalanceQuery(accId, 500L))); // 0
        System.out.println("Balance at t=1000: " + ledger.getBalanceAt(new BalanceQuery(accId, 1000L))); // 10000
        System.out.println("Balance at t=2500: " + ledger.getBalanceAt(new BalanceQuery(accId, 2500L))); // 6500
        System.out.println("Balance at t=3500: " + ledger.getBalanceAt(new BalanceQuery(accId, 3500L))); // 1500
        System.out.println("=== Demo Execution Successful ===");
    }
}
