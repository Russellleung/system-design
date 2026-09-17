# Elevator System

## Question

Design a deterministic in-memory elevator simulator with multiple elevators.

## Clarifying Questions

* How many elevators and floors?
* Is the destination selected inside or outside the elevator?
* Optimize for wait time, throughput, or fairness?
* Are emergency and maintenance modes required?

Assume inside selection, nearest-elevator assignment, and maintenance mode only.

## Components To Implement

```text
Direction, ElevatorState
Request, Elevator
ElevatorController
SchedulingStrategy
```

## Relationships And Services

```text
Elevator owns its current floor, direction, state, door state, and stop queue.
ElevatorController owns the fixed collection of Elevators for this simulation.
Request contains request data only; it does not control an Elevator.
SchedulingStrategy selects an elevator but does not mutate or store elevators.
No repository is needed because this is one in-memory simulation aggregate.
```

## Main Operations

```text
requestPickup(floor, direction)
requestDestination(elevatorId, floor)
assignRequest(request)
tick()
```

`assignRequest(request)` selects the elevator. `tick()` moves each elevator by at most one floor, keeping time deterministic.

## Invariants

```text
An elevator has one current floor and one movement direction.
Doors must be closed before movement.
An out-of-service elevator receives no requests.
The stop queue contains no duplicate floors.
```

## AI Prompt

```text
Implement a deterministic in-memory elevator simulator in Java using Direction,
ElevatorState, Request, Elevator, ElevatorController, and SchedulingStrategy.

Support pickup requests, destination requests, and tick(), where one tick moves
an elevator at most one floor. Use a deterministic nearest-elevator strategy,
ignore out-of-service elevators, deduplicate stops, and require doors to be
closed before movement.

Each Elevator owns its stop queue and movement state. ElevatorController owns the
fixed elevator collection and delegates selection to SchedulingStrategy. The
strategy must not mutate or store elevators. Do not introduce repositories for
this in-memory simulation.

Use no threads, timers, UI classes, frameworks, or hardware integration. Add
JUnit tests for assignment, movement, arrival, door state, and invalid assignment.
```

## Tests

```text
pickup assigned to nearest eligible elevator
elevator moves one floor per tick toward target
door opens on arrival and closes before moving again
out-of-service elevator is skipped
duplicate requests do not duplicate stops
```

## Tradeoffs And Follow-Ups

```text
Nearest elevator is simple but can be unfair and shortsighted.
LOOK/SCAN reduces direction changes by serving stops along the current path.
Destination dispatch can group riders but needs destinations before boarding.
Production adds capacity, hardware events, fail-safe modes, and wait metrics.
```

## Strong Answer

> I separated elevator movement from request assignment and used tick() instead of real threads, making each transition testable. The controller delegates selection to a scheduling strategy, so nearest-elevator can later become LOOK without changing the elevator model.
