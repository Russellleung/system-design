# Parking Lot

## Question

Design an in-memory parking lot that assigns compatible spots and releases them using tickets.

## Clarifying Questions

* Which vehicle and spot types are required?
* What is the compatibility and preference order?
* Is payment or reservation in scope?
* Is concurrency in scope, or should we explain it only?

Assume motorcycles, cars, and trucks; no payment, persistence, or reservations.

## Components To Implement

```text
VehicleType, SpotType
Vehicle, ParkingSpot, Ticket, ParkingLot
TicketRepository, InMemoryTicketRepository
ParkingLotService
SpotAssignmentStrategy
```

## Relationships And Services

```text
ParkingLot owns its ParkingSpots.
ParkingSpot owns only its current occupancy state.
Ticket stores vehicleId and spotId; Vehicle does not hold Ticket history.
TicketRepository stores and finds Tickets.
ParkingLotService coordinates assignment and release; it does not own storage.
```

## Main Operations

```text
parkVehicle(vehicle) -> Ticket
releaseVehicle(ticketId)
getAvailability(spotType)
```

## Invariants

```text
One spot holds at most one vehicle.
One vehicle has at most one active ticket.
One active ticket maps to one occupied spot.
A released ticket cannot be reused.
The vehicle must fit the spot type.
```

## AI Prompt

```text
Implement an in-memory Java parking lot with VehicleType, SpotType, Vehicle,
ParkingSpot, ParkingLot, Ticket, TicketRepository, InMemoryTicketRepository,
ParkingLotService, and SpotAssignmentStrategy.

Support parkVehicle and releaseVehicle. A car may use compact or large; a
motorcycle prefers motorcycle, then compact or large. Prevent the same vehicle
from parking twice and prevent a released ticket from being reused. Keep spot
selection deterministic.

ParkingLot owns the spots. Ticket stores vehicleId and spotId. Vehicle must not
contain ticket history. Store tickets behind TicketRepository. ParkingLotService
coordinates assignment and release but must not contain a ticket Map.

Use plain Java with no frameworks or persistence. Add JUnit tests for the
required behavior. Do not add payment, reservations, controllers, or APIs.
```

## Tests

```text
park car in compatible spot
reject parking when lot is full
release makes spot available again
reject invalid or already released ticket
reject same vehicle parking twice
motorcycle uses preferred compatible spot
```

## Tradeoffs And Follow-Ups

```text
Linear scan is enough here; production can index free spots by type.
Strategy separates assignment policy from parking state.
Concurrent gates require ticket creation and spot occupation to be atomic.
Production can use a DB transaction or row lock plus a unique active plate.
```

## Strong Answer

> I centered the model on one invariant: a spot has at most one active vehicle, represented by one active ticket. The strategy isolates placement policy from parking state. In production, ticket creation and spot occupation would be one transaction so two gates cannot assign the same spot.
