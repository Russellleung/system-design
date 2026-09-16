# Elevator System

## Question

Design an elevator control system.

## Clarifying Questions

* How many elevators and floors?
* Passenger destination selected outside or inside elevator?
* Optimize for wait time, throughput, or fairness?
* Is simulation enough?
* Emergency/maintenance mode needed?

## Core Objects

```text
Elevator
ElevatorController
Request
FloorButton
ElevatorButton
SchedulingStrategy
Direction
ElevatorState
```

## Main Operations

```text
requestPickup(floor, direction)
requestDestination(elevatorId, floor)
step() / tick()
assignRequest(request)
```

## Invariants

```text
Elevator has one current floor.
Elevator moves one direction at a time.
Elevator cannot serve requests while out of service.
Door open/close state must be valid before movement.
```

## AI Prompt

```text
Create an in-memory elevator simulator in Java.
Use Elevator, ElevatorController, Request, and SchedulingStrategy.
Support pickup and destination requests. Keep implementation simple.
```

## Tests

```text
pickup request is assigned to an elevator
elevator moves toward requested floor
elevator opens door when reaching target
out-of-service elevator is not assigned
multiple requests are served in direction order
```

## Tradeoffs

```text
Nearest elevator is simple but may be unfair.
SCAN/look algorithm reduces direction switching.
Destination dispatch is more efficient but more complex.
Simulation clock makes tests deterministic.
```

## Strong Answer

> I would separate elevator state from scheduling policy. The controller accepts requests and delegates assignment to a strategy. That lets me start with nearest-elevator logic and later replace it with SCAN or destination dispatch without changing the elevator domain model.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
Direction enum
ElevatorState enum
Request
Elevator
ElevatorController
SchedulingStrategy
NearestElevatorStrategy or LookStrategy
```

### Hard Part To Emphasize

```text
Separate elevator movement from request assignment.
Make time deterministic with tick()/step().
Do not mix UI buttons with scheduling logic.
```

### Deeper Edge Cases

```text
elevator is out of service
request is in opposite direction
multiple requests on the same floor
door must close before movement
no duplicate stops in elevator queue
```

### Production Extension

```text
LOOK/SCAN scheduling instead of nearest only
capacity limit per elevator
emergency/maintenance mode
metrics: average wait time, max wait time
hardware integration events separated from controller logic
```

### 30-Minute Closing

> I would implement a deterministic simulator rather than real threads. The controller owns request assignment, each elevator owns movement state, and the scheduling strategy can evolve from nearest-elevator to LOOK without rewriting the domain model.
