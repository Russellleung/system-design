# OOP Question Answer Bank

Use this as the index. Each question has its own focused file.

Every file is scoped as one complete 30-minute exercise: clarify briefly, implement the listed model and service, prove the main invariant with focused tests, then discuss production extensions verbally.

## Questions

* [Parking Lot](questions/parking-lot.md)
* [Elevator System](questions/elevator-system.md)
* [Library Management](questions/library-management.md)
* [Food Delivery / Restaurant Ordering](questions/food-delivery.md)
* [Movie Ticket Booking](questions/movie-ticket-booking.md)
* [Splitwise / Expense Sharing](questions/splitwise-expense-sharing.md)
* [Deck Of Cards / Blackjack](questions/deck-blackjack.md)
* [RPN Calculator With Undo And Reset](questions/rpn-calculator.md)
* [In-Memory Payment And Refund Engine](questions/payment-refund-engine.md)
* [Modular Todo-List Application](questions/modular-todo-list.md)
* [Refactoring A Legacy API Handler](questions/refactoring-legacy-api-handler.md)
* [Unit Testing Transactional Workflows](questions/unit-testing-transactional-workflows.md)

## Common OOP Patterns To Mention

Use only when useful:

```text
Strategy: assignment, pricing, splitting, scheduling
State machine: order, booking, elevator, payment
Repository: storage boundary
Factory: object creation when construction varies
Observer/pub-sub: notifications, UI updates
```

Avoid saying:

```text
I will use all design patterns.
```

Say:

> I will introduce a pattern only where it removes branching or protects a changing requirement.

## Common Closing Answer

```text
I kept the first version in-memory and focused on the core invariant.
The design separates domain state from orchestration logic.
I added tests for happy path and invalid transitions.
For production, I would add persistence, concurrency control,
idempotency for commands, metrics, and access control.
```
