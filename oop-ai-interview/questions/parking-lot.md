# Parking Lot

## Question

Design a parking lot system.

## Clarifying Questions

* Is this in-memory or persistent?
* Vehicle types: motorcycle, car, truck?
* Spot types: small, compact, large, EV, disabled?
* Do we need payment?
* Do we need reservations?
* Is concurrency in scope?

## Core Objects

```text
ParkingLot
Floor
ParkingSpot
Vehicle
Ticket
SpotAssignmentStrategy
PaymentService optional
```

## Main Operations

```text
parkVehicle(vehicle) -> ticket
releaseVehicle(ticketId)
findAvailableSpot(vehicleType)
getAvailability()
```

## Invariants

```text
One spot can hold at most one vehicle.
One active ticket maps to exactly one occupied spot.
A released ticket cannot be used again.
Vehicle must fit the spot type.
```

## AI Prompt

```text
Create simple Java classes for a parking lot.
Use ParkingLot, Floor, ParkingSpot, Vehicle, Ticket, and SpotAssignmentStrategy.
Keep it in-memory and testable. No frameworks.
```

## Tests

```text
park car into available compact spot
reject car when lot is full
release spot and make it available again
reject release with invalid ticket
motorcycle can use motorcycle or compact spot if allowed
```

## Tradeoffs

```text
Simple scan is fine for small lots.
For scale, maintain available spot indexes by spot type.
Strategy pattern helps swap nearest-spot vs cheapest-spot assignment.
Concurrency needs locking around park/release.
```

## Strong Answer

> I would model the parking lot around the invariant that a spot has at most one active vehicle and a ticket represents that active occupancy. The first version can be in-memory with a spot assignment strategy. I would add tests for park, release, full lot, and invalid ticket. If concurrency is in scope, park and release need atomic locking around spot assignment.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
VehicleType enum
SpotType enum
Vehicle
ParkingSpot
Ticket
ParkingLotService
NearestAvailableSpotStrategy
```

### Hard Part To Emphasize

```text
Spot assignment must be atomic.
Ticket and spot state must not drift.
Vehicle-to-spot compatibility must be explicit.
```

### Deeper Edge Cases

```text
same vehicle tries to park twice
release already released ticket
compact spot unavailable, car can use large spot
motorcycle uses motorcycle spot first, then compact if policy allows
payment required before exit, if payment is in scope
```

### Production Extension

```text
DB transaction around ticket creation + spot update
unique active ticket per vehicle plate
availability index by lot/floor/spot type
distributed lock or row lock for concurrent entry gates
event stream for display boards
```

### 30-Minute Closing

> For the interview version I would implement in-memory spot assignment and release, with tests around full lot, wrong spot type, and invalid ticket. In production I would protect the same invariant with a database transaction or row lock so two gates cannot assign the same spot.
