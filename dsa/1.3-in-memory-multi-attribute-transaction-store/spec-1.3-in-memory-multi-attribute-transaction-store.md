# Spec 1.3: In-Memory Multi-Attribute Transaction Store

## 1. Problem Statement
High-frequency payment processors need an in-memory data store for millions of transaction records. The store must support multi-attribute filtering (by `userId`, `status`, and `timestamp` ranges) with sub-millisecond query responses without full database table scans.

## 2. Interface & Types (Java)

```java
import java.math.BigInteger;
import java.util.List;

public class Spec1_3 {

    public enum TransactionStatus {
        PENDING,
        SETTLED,
        REJECTED
    }

    public record TxnRecord(
        String txnId,
        String userId,
        BigInteger amount,
        TransactionStatus status,
        long timestamp
    ) {}

    public record FilterCriteria(
        String userId,
        TransactionStatus status,
        Long startTime,
        Long endTime
    ) {}

    public interface TransactionStore {
        void insert(TxnRecord record);
        List<TxnRecord> query(FilterCriteria filter);
    }
}
```

## 3. Constraints & Rules
* **Scale**: Support up to $10^7$ transaction records.
* **Stream Order Guarantee**: Transactions arrive strictly chronologically ($O(1)$ appends).
* **Binary Search Range Queries**: Use `bisect_left` and `bisect_right` on the ascending lists for $O(\log N)$ point-in-time filtering.

## 4. Complete Implementation (Java)

```java
import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class TransactionStore {

    public enum TransactionStatus { PENDING, SETTLED, REJECTED }
    public record TxnRecord(String txnId, String userId, BigInteger amount, TransactionStatus status, long timestamp) {}
    public record FilterCriteria(String userId, TransactionStatus status, Long startTime, Long endTime) {}

    private final Map<String, UserBucket> userIndex = new ConcurrentHashMap<>();

    public void insert(TxnRecord record) {
        userIndex.computeIfAbsent(record.userId(), k -> new UserBucket()).insert(record);
    }

    public List<TxnRecord> query(FilterCriteria filter) {
        UserBucket bucket = userIndex.get(filter.userId());
        return bucket != null ? bucket.query(filter) : Collections.emptyList();
    }

    private static class UserBucket {
        private final List<TxnRecord> records = new ArrayList<>();
        private final Map<TransactionStatus, List<TxnRecord>> statusMap = new EnumMap<>(TransactionStatus.class);
        private final Set<String> seenTxnIds = new HashSet<>();

        public UserBucket() {
            for (TransactionStatus s : TransactionStatus.values()) statusMap.put(s, new ArrayList<>());
        }

        public synchronized void insert(TxnRecord record) {
            if (!seenTxnIds.add(record.txnId())) return;
            records.add(record);
            statusMap.get(record.status()).add(record);
        }

        public synchronized List<TxnRecord> query(FilterCriteria filter) {
            List<TxnRecord> candidates = filter.status() != null ? statusMap.get(filter.status()) : records;
            if (candidates.isEmpty()) return Collections.emptyList();

            long startTime = filter.startTime() != null ? filter.startTime() : Long.MIN_VALUE;
            long endTime = filter.endTime() != null ? filter.endTime() : Long.MAX_VALUE;

            int startIdx = bisect_left(candidates, startTime);
            int endIdx = bisect_right(candidates, endTime);

            if (startIdx > endIdx || startIdx >= candidates.size() || endIdx < 0)
                return Collections.emptyList();
            return new ArrayList<>(candidates.subList(startIdx, endIdx + 1));
        }

        private int bisect_left(List<TxnRecord> candidates, long targetTime) {
            int low = 0, high = candidates.size() - 1, idx = candidates.size();
            while (low <= high) {
                int mid = low + (high - low) / 2;
                if (candidates.get(mid).timestamp() >= targetTime) {
                    idx = mid;
                    high = mid - 1;
                } else low = mid + 1;
            }
            return idx;
        }

        private int bisect_right(List<TxnRecord> candidates, long targetTime) {
            int low = 0, high = candidates.size() - 1, idx = -1;
            while (low <= high) {
                int mid = low + (high - low) / 2;
                if (candidates.get(mid).timestamp() <= targetTime) {
                    idx = mid;
                    low = mid + 1;
                } else high = mid - 1;
            }
            return idx;
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Spec 1.3: In-Memory Multi-Attribute Transaction Store Demo ===");
        TransactionStore store = new TransactionStore();
        String userId = "USER_99";

        store.insert(new TxnRecord("t1", userId, BigInteger.valueOf(100), TransactionStatus.SETTLED, 1000L));
        store.insert(new TxnRecord("t2", userId, BigInteger.valueOf(200), TransactionStatus.PENDING, 2000L));
        store.insert(new TxnRecord("t3", userId, BigInteger.valueOf(300), TransactionStatus.SETTLED, 3000L));
        store.insert(new TxnRecord("t4", userId, BigInteger.valueOf(400), TransactionStatus.REJECTED, 4000L));
        store.insert(new TxnRecord("t5", userId, BigInteger.valueOf(500), TransactionStatus.SETTLED, 5000L));

        System.out.println("Settled count (Expected 3): " + store.query(new FilterCriteria(userId, TransactionStatus.SETTLED, null, null)).size());
        System.out.println("Range 2000..4500 count (Expected 3): " + store.query(new FilterCriteria(userId, null, 2000L, 4500L)).size());
        System.out.println("=== Demo Execution Successful ===");
    }
}
```
