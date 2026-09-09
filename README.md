# Financial System Design & Algorithm Specifications (Java Edition)

Each problem is organized into its own self-contained, nested directory under `dsa/` and `system-design/`, containing both its markdown specification and a clean, single standalone Java source file.

---

## 📁 Repository Structure

```text
system design/
├── README.md
├── dsa/
│   ├── 1.1-out-of-order-transaction-stream/
│   │   ├── spec-1.1-out-of-order-transaction-stream.md
│   │   └── TransactionLedger.java
│   ├── 1.2-arbitrary-fx-currency-conversion-engine/
│   │   ├── spec-1.2-arbitrary-fx-currency-conversion-engine.md
│   │   └── FXConverter.java
│   ├── 1.3-in-memory-multi-attribute-transaction-store/
│   │   ├── spec-1.3-in-memory-multi-attribute-transaction-store.md
│   │   └── TransactionStore.java
│   ├── 1.4-banking-identifier-validator-iban-mod-97/
│   │   ├── spec-1.4-banking-identifier-validator-iban-mod-97.md
│   │   └── IBANValidator.java
│   └── 1.5-sliding-window-rate-limiter/
│       ├── spec-1.5-sliding-window-rate-limiter.md
│       └── SlidingWindowRateLimiter.java
└── system-design/
    ├── 2.1-multi-currency-digital-wallet/
    │   └── spec-2.1-multi-currency-digital-wallet.md
    ├── 2.2-cross-border-payment-reconciliation/
    │   └── spec-2.2-cross-border-payment-reconciliation.md
    ├── 2.3-idempotent-payment-ingestion/
    │   └── spec-2.3-idempotent-payment-ingestion.md
    ├── 2.4-real-time-fx-rate-streaming/
    │   └── spec-2.4-real-time-fx-rate-streaming.md
    └── 2.5-high-concurrency-balance-reservation/
        └── spec-2.5-high-concurrency-balance-reservation.md
```

---

## 📑 Specification & Code Index

### Part 1: Data Structures & Algorithms (DSA)

| Problem Folder | Specification Document | Standalone Java Source File |
| :--- | :--- | :--- |
| **`dsa/1.1-out-of-order-transaction-stream/`** | [`spec-1.1-out-of-order-transaction-stream.md`](dsa/1.1-out-of-order-transaction-stream/spec-1.1-out-of-order-transaction-stream.md) | [`TransactionLedger.java`](dsa/1.1-out-of-order-transaction-stream/TransactionLedger.java) |
| **`dsa/1.2-arbitrary-fx-currency-conversion-engine/`** | [`spec-1.2-arbitrary-fx-currency-conversion-engine.md`](dsa/1.2-arbitrary-fx-currency-conversion-engine/spec-1.2-arbitrary-fx-currency-conversion-engine.md) | [`FXConverter.java`](dsa/1.2-arbitrary-fx-currency-conversion-engine/FXConverter.java) |
| **`dsa/1.3-in-memory-multi-attribute-transaction-store/`** | [`spec-1.3-in-memory-multi-attribute-transaction-store.md`](dsa/1.3-in-memory-multi-attribute-transaction-store/spec-1.3-in-memory-multi-attribute-transaction-store.md) | [`TransactionStore.java`](dsa/1.3-in-memory-multi-attribute-transaction-store/TransactionStore.java) |
| **`dsa/1.4-banking-identifier-validator-iban-mod-97/`** | [`spec-1.4-banking-identifier-validator-iban-mod-97.md`](dsa/1.4-banking-identifier-validator-iban-mod-97/spec-1.4-banking-identifier-validator-iban-mod-97.md) | [`IBANValidator.java`](dsa/1.4-banking-identifier-validator-iban-mod-97/IBANValidator.java) |
| **`dsa/1.5-sliding-window-rate-limiter/`** | [`spec-1.5-sliding-window-rate-limiter.md`](dsa/1.5-sliding-window-rate-limiter/spec-1.5-sliding-window-rate-limiter.md) | [`SlidingWindowRateLimiter.java`](dsa/1.5-sliding-window-rate-limiter/SlidingWindowRateLimiter.java) |

### Part 2: System Design Specifications

| System Design Folder | Specification Document |
| :--- | :--- |
| **`system-design/2.1-multi-currency-digital-wallet/`** | [`spec-2.1-multi-currency-digital-wallet.md`](system-design/2.1-multi-currency-digital-wallet/spec-2.1-multi-currency-digital-wallet.md) |
| **`system-design/2.2-cross-border-payment-reconciliation/`** | [`spec-2.2-cross-border-payment-reconciliation.md`](system-design/2.2-cross-border-payment-reconciliation/spec-2.2-cross-border-payment-reconciliation.md) |
| **`system-design/2.3-idempotent-payment-ingestion/`** | [`spec-2.3-idempotent-payment-ingestion.md`](system-design/2.3-idempotent-payment-ingestion/spec-2.3-idempotent-payment-ingestion.md) |
| **`system-design/2.4-real-time-fx-rate-streaming/`** | [`spec-2.4-real-time-fx-rate-streaming.md`](system-design/2.4-real-time-fx-rate-streaming/spec-2.4-real-time-fx-rate-streaming.md) |
| **`system-design/2.5-high-concurrency-balance-reservation/`** | [`spec-2.5-high-concurrency-balance-reservation.md`](system-design/2.5-high-concurrency-balance-reservation/spec-2.5-high-concurrency-balance-reservation.md) |

---

## 🚀 Execution Instructions

Compile and run directly inside each nested folder:

```bash
# Spec 1.1
cd "dsa/1.1-out-of-order-transaction-stream" && javac TransactionLedger.java && java TransactionLedger && cd ../..

# Spec 1.2
cd "dsa/1.2-arbitrary-fx-currency-conversion-engine" && javac FXConverter.java && java FXConverter && cd ../..

# Spec 1.3
cd "dsa/1.3-in-memory-multi-attribute-transaction-store" && javac TransactionStore.java && java TransactionStore && cd ../..

# Spec 1.4
cd "dsa/1.4-banking-identifier-validator-iban-mod-97" && javac IBANValidator.java && java IBANValidator && cd ../..

# Spec 1.5
cd "dsa/1.5-sliding-window-rate-limiter" && javac SlidingWindowRateLimiter.java && java SlidingWindowRateLimiter && cd ../..
```
