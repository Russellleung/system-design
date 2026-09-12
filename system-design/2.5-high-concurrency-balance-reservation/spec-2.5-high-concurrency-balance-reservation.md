# Spec 2.5: High-Concurrency Balance Reservation (PostgreSQL Sharded Ledger)

## Executive Summary
Use a strongly consistent, sharded transactional database as the source of truth. Partition accounts by `account_id`, and serialize mutations to an individual account using row-level locking or optimistic concurrency. A reservation atomically transfers funds from available to reserved and creates the reservation and double-entry ledger records in the same transaction. Use an idempotency key to make retries safe. Store `expires_at` and use a background expiry worker, but re-check and transition the reservation under a transaction so expiration races with consumption safely. Publish downstream events using the transactional outbox pattern. Redis can be used for caching/rate limiting but never as the financial source of truth.

## 1. System Objective
Design a high-concurrency balance reservation engine achieving **20,000 TPS** while maintaining strict, mathematically inviolable financial invariants (`Available + Reserved = Total`). The system must act as the absolute source of truth for holds (e.g., ticket checkouts, flash sales) preventing over-spending, lost updates, and race conditions.

## 2. Core Architectural Philosophy
* **The Database is the Authority:** Do NOT make Redis, Kafka, or an asynchronous ledger the authority for whether a reservation succeeded. The reservation decision and the balance mutation must happen in exactly **one atomic transaction**.
* **Strict Double-Entry Modeling:** A reservation is not just a flag; it is a literal ledger transfer from a user's `Available Wallet` to their `Reserved Wallet`.
* **Horizontal Database Sharding:** To achieve 20K TPS without bottlenecking a single global lock manager, the PostgreSQL database is sharded by account ownership. The baseline routing strategy is consistent hashing on `account_id`, so adding or removing shards only moves a limited subset of accounts.

---

## 3. Data Model: Ledger vs Balance Table

There are two critical storage concepts that must be explicitly separated:

### The Immutable Historical Ledger
The Ledger represents the immutable historical truth. You **never** update an old ledger entry.
```sql
CREATE TABLE ledger_entries (
    entry_id         BIGSERIAL PRIMARY KEY,
    transaction_id   UUID NOT NULL,
    account_id       BIGINT NOT NULL,
    ledger_account   VARCHAR(50) NOT NULL,
    debit            DECIMAL(38, 18) DEFAULT 0,
    credit           DECIMAL(38, 18) DEFAULT 0,
    timestamp        TIMESTAMP NOT NULL
);
```

### The Materialized Account Balance
The Balance represents the current materialized state. This makes reads extremely fast without needing to sum millions of ledger rows per request.
```sql
CREATE TABLE account (
    account_id       BIGINT PRIMARY KEY,
    total_balance    DECIMAL(38, 18) NOT NULL,
    available        DECIMAL(38, 18) NOT NULL,
    reserved         DECIMAL(38, 18) NOT NULL,
    version          BIGINT NOT NULL,
    
    CONSTRAINT positive_available CHECK (available >= 0),
    CONSTRAINT positive_reserved CHECK (reserved >= 0),
    CONSTRAINT strict_invariant CHECK (available + reserved = total_balance)
);
```
**Reconciliation Invariant:** A background reconciliation process can periodically calculate:
`sum(ledger_entries) == account.available`
If these do not match perfectly, a serious consistency flaw has occurred in the API layer.

### The Reservation Entity
```sql
CREATE TABLE reservation (
    reservation_id   UUID PRIMARY KEY,
    account_id       BIGINT NOT NULL,
    amount           DECIMAL(38, 18) NOT NULL,
    status           VARCHAR(20) NOT NULL, -- ACTIVE, RELEASED, EXPIRED, CONSUMED
    expires_at       TIMESTAMP NOT NULL,
    created_at       TIMESTAMP NOT NULL,
    idempotency_key  VARCHAR(100) NOT NULL,
    
    UNIQUE(account_id, idempotency_key)
);
```
*(Note: We never physically `DELETE` reservations. Moving states to `EXPIRED` or `CONSUMED` preserves the audit trail and explicitly manages retries).*

---

## 4. The `Reserve` Operation (Atomic Execution)

When a User requests to reserve $100, we explicitly model a reservation as a transfer between two internal ledger accounts.

```text
User Available Wallet
        │
        │  Reserve $100
        ▼
User Reserved Wallet
```
**Ledger entries generated:**
* DEBIT User Available: 100
* CREDIT User Reserved: 100

**SQL Execution Block:**
```sql
BEGIN;

-- 1. Lock the specific Account Row
SELECT available FROM account WHERE account_id = :account_id FOR UPDATE;

-- Application Layer Check:
-- IF available < amount: ROLLBACK, return INSUFFICIENT_FUNDS

-- 2. Mutate the Account Balance
UPDATE account
SET available = available - :amount,
    reserved  = reserved + :amount,
    version   = version + 1
WHERE account_id = :account_id;

-- 3. Create the Immutable Reservation
INSERT INTO reservation (reservation_id, account_id, amount, status, expires_at, idempotency_key, created_at)
VALUES (:id, :account_id, :amount, 'ACTIVE', NOW() + INTERVAL '15 minutes', :idempotency_key, NOW());

-- 4. Append Immutable Double-Entry Ledger Details (The Transfer)
INSERT INTO ledger_entries (..., 'USER_AVAILABLE_WALLET', debit=100);
INSERT INTO ledger_entries (..., 'USER_RESERVED_WALLET', credit=100);

-- 5. Append Downstream Notifications (Outbox Pattern)
INSERT INTO outbox_events (event_type, payload) VALUES ('ReservationCreated', '...');

COMMIT;
```

### Why the `SELECT ... FOR UPDATE` Row Lock is Critical
If two simultaneous checkout requests (Request A: $80, Request B: $50) hit an account with a $100 balance concurrently, reading and updating without locks causes a classic **Lost Update (Overspending)**. Both read $100 available, both succeed, and the resulting state holds $130 reserved from $100.
By issuing `SELECT FOR UPDATE`, Request A acquires an exclusive lock. Request B is forced to wait at the database tier. When A commits (leaving $20 available), B unblocks, reads $20, and accurately fails!

---

## 5. Expiration & Race Conditions

Under no circumstances should the system rely purely on an external message queue firing exactly at 15 minutes. 
The database uses `expires_at` natively in the reservation table.

### The Expiry Worker
A background worker periodically scans for expired active holds:
```sql
SELECT reservation_id FROM reservation 
WHERE status = 'ACTIVE' AND expires_at <= NOW() LIMIT 1000;
```

For every reservation found, it executes the strict Release transaction:
```sql
BEGIN;
-- Lock the reservation row itself against Consumer racing
SELECT * FROM reservation WHERE reservation_id = :reservation_id FOR UPDATE;

-- IF status != 'ACTIVE' OR expires_at > NOW(): ROLLBACK!

-- Execute the Reversal
UPDATE account SET available = available + :amount, reserved  = reserved - :amount, version = version + 1 WHERE account_id = :account_id;
UPDATE reservation SET status = 'EXPIRED' WHERE reservation_id = :reservation_id;
INSERT INTO ledger_entries (... reversal logic ...);

COMMIT;
```

### The "Consume vs Expire" Race Condition
If a user hits "Pay" at exactly `12:15:00.000` (the exact millisecond the Expiry worker clicks over), the **Reservation Row** itself acts as the serialization barrier. The `SELECT FOR UPDATE` on the Reservation table ensures only one transaction obtains the lock! 
Either the User API gets the lock, transitions `ACTIVE -> CONSUMED`, and succeeds... OR the Expiry worker gets the lock, transitions `ACTIVE -> EXPIRED`, and the User API subsequently sees the new state and gracefully fails. 

### Consume / Seller Settlement

When a reservation is consumed, the money should no longer sit in the buyer's reserved balance. If the seller also has an internal wallet, the consume operation settles the reserved amount into the seller's available balance.

Conceptually:

```text
Reserve:
buyer available -> buyer reserved

Consume:
buyer reserved  -> seller available
```

If buyer and seller accounts are on the same shard, settlement is one local database transaction:

```text
BEGIN
  lock reservation row
  lock buyer and seller accounts in sorted account_id order

  if reservation.status != ACTIVE:
      rollback

  buyer.reserved    -= amount
  buyer.total       -= amount
  seller.available  += amount
  seller.total      += amount

  debit buyer reserved wallet
  credit seller available wallet

  reservation.status = CONSUMED
  write outbox event: ReservationConsumed
COMMIT
```

If buyer and seller accounts are on different shards, the settlement uses the same orchestration plus suspense pattern as cross-shard wallet transfers:

```text
Transfer Orchestrator
    |
    | leg 1 on buyer shard
    v
debit buyer reserved
credit outgoing settlement suspense
    |
    | leg 2 on seller shard
    v
debit incoming settlement suspense
credit seller available
```

The orchestrator records a durable `settlement_id`, retries each leg with stable idempotency keys, and exposes states such as:

```text
PENDING
BUYER_RESERVED_DEBITED
SELLER_CREDITED
COMPLETED
FAILED
COMPENSATING
```

The suspense accounts are local platform accounts on each shard. They keep every local journal balanced even though the full buyer-to-seller movement spans two database partitions.

---

## 6. Mathematical Absolute Invariants (At All Times)

You specifically require: `Available + Reserved = Total Ledger Balance`
This must be an explicit invariant of every transaction.

**For a Reserve:**
Available -= X
Reserved  += X
`(Available - X) + (Reserved + X) = Available + Reserved`

**For a Release (Cancel/Expire):**
Available += X
Reserved  -= X
`(Available + X) + (Reserved - X) = Available + Reserved`

**For Consume (Seller Settlement):**
If the seller wallet is internal:
Buyer Reserved -= X
Buyer Total    -= X
Seller Available += X
Seller Total     += X
The platform-wide sum remains unchanged; ownership moves from buyer to seller.

If the seller is external to the wallet system, consumption can instead reduce the buyer's reserved and total balance while creating an external settlement payable.

> [!CAUTION] 
> **"At All Times" defined for Financial Systems:**
> We explicitly define this as: **"Database transactionally consistent at all committed states."** 
> We do NOT define this as: "Globally consistent across every replica in real time." A read from a lagging replica might temporarily show old data. Therefore, never use an eventually consistent read replica to decide whether a reservation can be created. Writes and balance-critical reads **must strictly route to the authoritative primary** for that account/shard.

---

## 7. Architecture & Data Flow (The Critical Path)

```text
       [ Client App ]
             │
             ▼
     [ API Gateway ]
             │
             ▼
   [ Balance Service ]
             │
             │ consistent_hash(account_id)
             ▼
       [ DB Shard ]
             │
             ├── lock account row
             │
             ├── check idempotency constraint
             │
             ├── check available >= amount
             │
             ├── available -= amount
             │
             ├── reserved += amount
             │
             ├── create reservation
             │
             ├── write double-entry ledger
             │
             ├── write outbox event
             │
             └── COMMIT
             │
             ▼
        [ Response ]
```

Notice that Kafka, Analytics, and Notifications stay **completely outside** the critical synchronous path!

### Hitting 20,000 TPS via Sharding

To achieve 20K TPS using strict PostgreSQL locks, the architecture mandates **Horizontal Database Sharding**. We do NOT force 20,000 requests per second against a singular, un-partitioned master database. 

**How does the API know which database node to query?**
The Balance Service tier calculates the shard route before opening a SQL connection.

### Consistent Hashing for Account Ownership

Each database shard is placed on a logical hash ring with multiple virtual nodes. To route a request, the service hashes the `account_id`, walks clockwise on the ring, and picks the first shard owner.

```text
owner_shard = consistent_hash_ring.lookup(account_id)
```

The service then borrows a connection from that shard's pool and executes the reservation transaction only on that shard.

```text
reserveFunds(account_459)
    |
    | consistent_hash(account_459)
    v
pool-shard-2
    |
    v
PostgreSQL Shard 2
```

**Why use consistent hashing instead of `hash(account_id) % N`?**

Modulo hashing is simple, but when `N` changes from 8 shards to 9 shards, many account IDs map to different shards. That creates a painful migration because a large fraction of accounts must move at once.

Consistent hashing keeps account ownership stable. When a shard is added or removed, only the accounts near that shard's part of the ring need to move. This makes online resharding realistic.

**Why this is powerful:** Operations against the same account (`account_459`) deterministically funnel to the exact same shard, structurally serializing contention. Operations against different accounts run in parallel across horizontally separated hardware.

### Cross-Shard Transfer Routing

For a single-account reservation, only one shard is involved. For a transfer between two accounts, the service first resolves both owners:

```text
debit_owner  = consistent_hash_ring.lookup(debit_account_id)
credit_owner = consistent_hash_ring.lookup(credit_account_id)
```

If both accounts map to the same shard, the transfer can run as one local database transaction.

If the accounts map to different shards, the request goes through the Transfer Orchestrator. The orchestrator creates a durable global transfer record and coordinates the debit and credit legs idempotently. This keeps the common same-shard case fast while still supporting cross-shard movement safely.

---

## 8. Anti-Patterns Avoided in this Spec

### ❌ The "Redis-to-Kafka-to-DB" Illusion
A tempting pattern for heavy load is to decrement the balance fast in Redis, fire an event to Kafka, and asynchronously update the DB. This architecture catastrophically breaks strict financial consistency. It exposes the system to delayed Kafka events, DB replication lags, duplicated processing, and split-brain sync where Redis says $70 but the DB says $100. **The database transaction must be the final decider of success.** 

### ❌ The "DB Commit then Kafka Publish" Failure
Do NOT do:
* DB transaction -> Commit
* Kafka publish -> Network Failure
Because then the database succeeds but Kafka drops the notification payload forever.
**Solution:** The **Outbox Pattern**. You `INSERT` the `outbox_event` inside the exact same DB transaction `COMMIT`. Then a decoupled outbox publisher asynchronously reads the safe DB row and relays it to Kafka, ensuring zero message loss.

### ❌ Application-Layer Deduplication (Idempotency)
At 20,000 TPS, clients dropping connection and aggressively retrying `POST /reservations` is inevitable. Client doesn't know whether it succeeded, so it retries. You don't want $100 reserved twice.
Relying on an application-level RAM array to deduplicate is dangerous. 
By forcing a `UNIQUE(account_id, idempotency_key)` index tightly onto the `reservation` PostgreSQL table, every `POST` must contain an `Idempotency-Key` header. Duplicated retries fundamentally bounce off the database constraint instantly! This is significantly more robust than application memory checks.
