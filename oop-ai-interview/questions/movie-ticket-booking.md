# Movie Ticket Booking

## Question

Design an in-memory assigned-seat booking system with temporary holds.

## Clarifying Questions

* Are seats assigned?
* How long does a hold last?
* Is payment integration required?
* Must a multi-seat hold be all-or-nothing?
* Is concurrent booking implemented or explained?

Assume assigned seats, five-minute holds, all-or-nothing selection, and no payment provider.

## Components To Implement

```text
Showtime, Seat, SeatStatus
SeatHold, Booking
SeatInventory, HoldRepository, BookingRepository
Clock, BookingService
```

A seat's identity is `showtimeId + seatId`. User can remain a `userId`; it does not need a large mutable object.

## Relationships And Services

```text
SeatInventory owns seat state keyed by showtimeId + seatId.
SeatHold stores userId and selected seat keys; User does not hold bookings.
HoldRepository and BookingRepository store workflow records.
BookingService coordinates hold, expiry, and confirmation; it owns no maps.
```

## Main Operations

```text
getAvailableSeats(showtimeId)
holdSeats(userId, showtimeId, seatIds) -> SeatHold
confirmBooking(userId, holdId) -> Booking
expireHold(holdId)
```

## Invariants

```text
A showtime-seat is AVAILABLE, HELD, or BOOKED.
A multi-seat hold succeeds completely or not at all.
Only the hold owner can confirm it.
An expired hold cannot be confirmed.
Expiry never releases a booked seat.
```

## AI Prompt

```text
Implement an in-memory Java movie booking system using Showtime, Seat,
SeatStatus, SeatInventory, SeatHold, Booking, HoldRepository, BookingRepository,
their in-memory implementations, Clock, and BookingService.

Support atomic all-or-nothing holds for multiple seats, hold expiry, and
idempotent booking confirmation by holdId. Only the hold owner may confirm, and
expiry must never release a booked seat. Use an injected Clock.

SeatInventory owns seat state keyed by showtimeId + seatId. SeatHold stores
userId and seat keys. User is represented only by userId and must not hold a
booking list. Store holds and bookings behind repositories. BookingService
coordinates operations and must not own storage maps.

Use plain Java with no payment provider, database, Redis, API, or background
thread. Add JUnit tests for ownership, expiry, partial availability, and retries.
```

## Tests

```text
hold available seats
multi-seat hold fails without changing any seat when one is unavailable
reject confirmation by the wrong user
reject an expired hold and release its seats
confirming the same hold twice returns the same Booking
expiry after confirmation does not release booked seats
```

## Tradeoffs And Follow-Ups

```text
SeatHold is temporary ownership; Booking is final ownership.
Injected Clock makes expiry deterministic.
Production uses a DB row lock or Redis Lua for atomic holds.
Add payment-in-progress, idempotency keys, and an expiry worker in production.
Shard inventory by showtime or independent section.
```

## Strong Answer

> The invariant is one owner per showtime-seat key. A SeatHold models temporary ownership during payment, while Booking models final ownership. Injecting Clock keeps expiry deterministic; production would make the multi-seat hold atomic with a database lock or Redis Lua.
