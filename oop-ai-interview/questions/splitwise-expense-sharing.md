# Splitwise / Expense Sharing

## Question

Design an in-memory expense-sharing system for one currency.

## Clarifying Questions

* Equal, exact, or percentage splits?
* Are groups required?
* Are editing, deletion, and debt simplification required?
* Is multi-currency in scope?

Assume groups, equal and exact splits, one currency, and no editing or debt simplification.

## Components To Implement

```text
User, Group
Expense, Split
SplitStrategy
BalanceSheet, Settlement
GroupRepository, InMemoryGroupRepository
ExpenseRepository, InMemoryExpenseRepository
ExpenseService
```

## Relationships And Services

```text
Group stores member IDs, not each member's Expenses.
GroupRepository stores Groups and performs group lookup.
Expense owns immutable Splits and references groupId and payerId.
ExpenseRepository stores the audit records.
BalanceSheet stores the derived pairwise balance projection.
ExpenseService validates and coordinates; it does not own storage maps.
```

## Main Operations

```text
addExpense(groupId, paidBy, amount, participants, strategy)
getBalances(groupId)
settleUp(groupId, fromUser, toUser, amount)
```

## Invariants

```text
Split amounts equal the Expense amount exactly.
Signed balance changes for every Expense sum to zero.
Only group members participate.
Settlement reduces an existing debt and cannot exceed it.
Expense is immutable.
```

## AI Prompt

```text
Implement an in-memory Java expense-sharing system using User, Group, Expense,
Split, SplitStrategy, EqualSplitStrategy, ExactSplitStrategy, BalanceSheet,
Settlement, ExpenseRepository, InMemoryExpenseRepository, and ExpenseService.
Also use GroupRepository and InMemoryGroupRepository.

Use BigDecimal with two decimal places. Adding an expense must validate group
membership and make all signed balance changes sum to zero. Divide remainder
cents deterministically. Support settleUp but reject over-settlement. Keep
Expense immutable.

Group stores member IDs only and is stored through GroupRepository. Expense owns immutable Splits and is stored through
ExpenseRepository. BalanceSheet owns the derived pairwise balances. ExpenseService
coordinates validation and updates but must not contain expense or balance maps.

Do not implement editing, multi-currency, persistence, or debt simplification.
Add JUnit tests for totals, rounding, zero-sum balances, and settlement.
```

## Tests

```text
equal split among three users allocates remainder cents deterministically
exact split rejects totals that do not equal the expense
balances for an expense sum to zero
reject non-member participant
settlement reduces debt
reject over-settlement
```

## Tradeoffs And Follow-Ups

```text
Pairwise balances are fast to query; immutable Expenses provide audit history.
Strategies isolate equal and exact calculation.
Production saves Expense and balance projection in one transaction.
Edits reverse the old Expense before creating a replacement.
Multi-currency requires an FX-rate snapshot.
```

## Strong Answer

> Every expense must net to zero, including remainder cents. I keep Expense immutable and maintain balances as a projection for fast reads. In production, the expense and projection update belong in one transaction; edits would reverse the old event before adding a replacement.
