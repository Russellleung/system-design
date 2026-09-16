# Splitwise / Expense Sharing

## Question

Design an expense sharing system.

## Clarifying Questions

* Equal split only or custom percentages?
* Groups or direct expenses?
* Multi-currency?
* Need settle-up optimization?
* Can expenses be edited/deleted?

## Core Objects

```text
User
Group
Expense
Split
BalanceSheet
Settlement
SplitStrategy
```

## Main Operations

```text
addExpense(paidBy, participants, amount, splitStrategy)
getBalances(groupId)
settleUp(fromUser, toUser, amount)
simplifyDebts(groupId)
```

## Invariants

```text
Sum of splits equals expense amount.
Group balances sum to zero.
Settlement reduces debt.
Expense edits must reverse old balance impact before applying new one.
```

## AI Prompt

```text
Create a Java in-memory Splitwise-style expense system.
Support equal split and exact split strategies.
Maintain pairwise balances.
Add tests that balances sum to zero.
```

## Tests

```text
equal split among three users
exact split validates total amount
settlement reduces balance
balances across group sum to zero
simplify debts produces fewer payments
```

## Tradeoffs

```text
Pairwise balances are easy to query.
Ledger of expenses is better for audit.
Use strategies for equal/exact/percentage splits.
Multi-currency requires FX snapshot.
```

## Strong Answer

> The core invariant is that every expense nets to zero across users. I would store expenses as immutable events and maintain balances as a projection. That gives auditability and fast balance reads.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
User
Group
Expense
Split
SplitStrategy
BalanceSheet
Settlement
ExpenseService
```

### Hard Part To Emphasize

```text
Sum of splits must equal expense amount.
Balances must net to zero.
Use immutable expenses plus balance projection.
```

### Deeper Edge Cases

```text
exact split does not sum to amount
payer is not in participant list
settlement amount exceeds debt
expense edit requires reversing old effect
rounding cents for percentage split
multi-currency needs FX snapshot
```

### Production Extension

```text
ledger-style expense events
idempotency key for addExpense
DB transaction for expense + balance projection
debt simplification job
audit trail for edits/deletes
```

### 30-Minute Closing

> I would implement equal and exact splits first, then maintain pairwise balances. The key invariant is that every expense nets to zero. For production, I would keep immutable expense events and treat balances as a derived projection.
