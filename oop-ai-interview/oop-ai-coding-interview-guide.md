# OOP AI Coding Interview Guide

## Goal

Show that you can drive the design, use AI safely, test behavior, and explain tradeoffs.

Do not let AI become the driver. You are the engineer; AI is the fast typist/pair programmer.

---

## Step-by-Step Workflow

### 1. Restate The Problem

Say:

> Let me restate the problem and confirm the scope before coding.

Clarify:

* core users / actors
* main operations
* in-memory or persistent storage
* single machine or concurrent system
* required edge cases
* expected extensibility

Example:

```text
For parking lot, I assume this is in-memory, supports park/release,
multiple vehicle types, and we do not need payment unless requested.
```

---

### 2. Define Components And Relationships

List the components, their relationships, who owns state, and which service coordinates the use case.

Use:

```text
Entity objects: represent domain data.
Service/manager objects: coordinate operations.
Strategy objects: allow replaceable logic.
Repository objects: hide storage if needed.
```

State ownership:

```text
Entity: owns its own fields and valid state transitions.
Aggregate: owns its contained child objects when they share one lifecycle.
Repository: owns storage and query collections.
Service: coordinates a use case; it should not become the storage container.
Related objects usually reference IDs instead of holding growing object lists.
```

Example:

```text
Restaurant owns its menu, not a List<Order>.
Order stores restaurantId and customerId.
OrderRepository stores and queries orders.
OrderService loads, validates, changes, and saves an Order.
```

Say:

> I will separate domain objects from orchestration logic so the model stays testable.

---

### 3. Define Invariants

Before coding, list the rules that must never break. Pick only the ones relevant to the question.

* **Unique ID:** Give each resource a stable identity. Use compound identity when needed, such as `showtimeId + seatId`. No two active records should claim the same resource.
* **Idempotency:** Decide what happens when a command is repeated. A repeated `confirmBooking(holdId)` should return the existing booking, not create another. Single-threaded code avoids simultaneous races, but duplicate retries still exist.
* **State transition:** Define allowed transitions and reject invalid or terminal-state changes. Examples: `AVAILABLE -> HELD -> BOOKED` and `PENDING -> ACCEPTED -> PREPARING`.
* **Authorization:** Check who owns or may change the resource. Only the hold owner confirms a booking; only the owning restaurant accepts an order.
* **Capacity:** Do not exceed inventory, loan, or occupancy limits. Validate compatibility and make multi-resource operations all-or-nothing when required.
* **Arithmetic:** Use `BigDecimal` for money, define rounding, ensure splits equal the original amount, and keep balances at zero-sum. Snapshot prices at checkout.
* **Expiry:** Inject `Clock`, define the exact expiry boundary, reject expired actions, and ensure expiry cannot undo a later successful state such as `BOOKED`.

Say:

> The main invariant is that one showtime-seat can have only one owner. This exercise is single-threaded, so there is no simultaneous race, but I still keep check-and-update together. In production that operation would need an atomic database lock or Redis script.

---

### 4. Create Minimal Files

Do not create a giant project unless required.

Default structure:

```text
src/main/java/.../domain/
src/main/java/.../service/
src/test/java/.../
```

For a short interview, this is enough:

```text
Model classes
One service/manager class
One test file
```

Avoid:

```text
Spring Boot setup
database config
Docker
too many interfaces
```

Unless the interviewer asks.

---

### 5. Write Tests Or Examples First

Tests prove you are not blindly trusting AI.

Start with 3-5 tests:

```text
happy path
invalid input
capacity / unavailable case
state transition
idempotent/repeated action if relevant
```

Say:

> I will add a few tests first so we have a safety net while using AI.

---

### 6. Prompt AI In Small Chunks

Bad prompt:

```text
Build the whole system.
```

Good prompt:

```text
Components:
- ParkingLot, ParkingSpot, Vehicle, Ticket
- TicketRepository and InMemoryTicketRepository
- ParkingLotService and SpotAssignmentStrategy

Relationships:
- ParkingLot owns ParkingSpots.
- Ticket references vehicleId and spotId.
- Vehicle does not hold a ticket history.

Service and storage:
- TicketRepository owns ticket storage.
- ParkingLotService coordinates park/release but owns no storage map.
- SpotAssignmentStrategy selects a compatible spot without storing state.

Behavior:
- Implement parkVehicle and releaseVehicle.
- One occupied spot has exactly one active ticket.
- Reject duplicate parking and repeated release.

Constraints:
- Plain Java, in-memory, deterministic, no frameworks or payment.
- Add focused JUnit tests for the listed behavior.
```

The prompt should always specify:

```text
Components to create
Relationships between components
Entity/aggregate ownership
Service responsibilities
Repository/storage responsibilities
Operations and invariants
Explicitly excluded scope
Tests to generate
```

---

### 7. Review AI Output

Check:

```text
Does each class have one clear responsibility?
Are component relationships implemented as specified?
Does the service coordinate rather than store all state?
Are collections held by the correct aggregate or repository?
Are there hidden global variables?
Are edge cases handled?
Are names clear?
Are there unnecessary abstractions?
Can tests prove behavior?
```

Say:

> I am checking the generated code against the invariants, especially state transitions.

---

### 8. Run Tests And Fix

Do:

```text
run tests
read failure
fix smallest issue
run again
```

Say:

> I prefer tests to drive the correction rather than guessing.

---

### 9. Refactor Only After It Works

Improve:

```text
names
method boundaries
strategy extraction
validation
error handling
```

Do not refactor unrelated code.

Say:

> Now that behavior is covered, I would clean up naming and extract a strategy only where it removes real branching.

---

### 10. Explain Extension Points

End with:

```text
What I built
Main invariant
Tradeoff
How to extend
What I would test next
```

Example:

> This version is in-memory and optimized for clarity. If this became production, I would add persistence, concurrency control, metrics, and idempotency around commands.

---

## What To Say When Using AI

Use:

```text
I will use AI for boilerplate, but I will own the object model and edge cases.
```

```text
I will keep prompts narrow so the generated code is reviewable.
```

```text
I will verify with tests before trusting the implementation.
```

```text
I will avoid over-engineering until the requirement appears.
```

---

## Default Design Checklist

Ask:

```text
Who are the actors?
What are the main operations?
What is the core invariant?
What state transitions exist?
What uniquely identifies each resource?
What happens if the same command is repeated?
Which operation must be all-or-nothing?
Who owns or may change each resource?
Are money, rounding, or expiry involved?
What can fail?
What must be unique?
What should be extensible?
Is concurrency in scope?
If single-threaded, what production race would still need protection?
Is persistence in scope?
```

Design:

```text
Entities
Value objects
Services/managers
Strategies
Repositories only if storage matters
Tests
```

Avoid:

```text
Too many patterns
Premature microservices
Framework setup
Unreviewed AI code
No tests
```
