# Movie Ticket Booking

## Question

Design a movie ticket booking system.

## Clarifying Questions

* Assigned seats or general admission?
* Temporary holds before payment?
* Hold expiry duration?
* Need payment integration?
* Is concurrency in scope?

## Core Objects

```text
Movie
Theater
Screen
Showtime
Seat
SeatHold
Booking
Payment
SeatLockService
```

## Main Operations

```text
getAvailableSeats(showtimeId)
holdSeats(userId, showtimeId, seatIds)
confirmBooking(holdId, paymentId)
expireHold(holdId)
cancelBooking(bookingId)
```

## Invariants

```text
A seat for a showtime can only be held or booked once.
Only the hold owner can confirm booking.
Expired holds cannot be confirmed.
Booked seats are final unless cancelled/refunded.
```

## AI Prompt

```text
Create a Java in-memory movie ticket booking system.
Support seat holds with expiry and booking confirmation.
Make SeatHold and Booking separate concepts.
Write tests for double booking and expired holds.
```

## Tests

```text
hold available seats
cannot hold already held seats
confirm booking from valid hold
expired hold cannot be confirmed
release expired hold
```

## Tradeoffs

```text
SeatHold protects payment window.
Booking is durable final ownership.
Concurrency needs atomic compare-and-set or DB lock.
For scale, shard by showtimeId.
```

## Strong Answer

> The key invariant is that one showtime seat cannot be sold twice. I would model a temporary SeatHold separately from a final Booking so payment can happen without permanently selling the seat before confirmation.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
Showtime
Seat
SeatStatus
SeatHold
Booking
Clock
BookingService
```

### Hard Part To Emphasize

```text
Seat key is showtimeId + seatId.
Hold is temporary; booking is final.
Expiry must be testable with injected Clock.
```

### Deeper Edge Cases

```text
wrong user confirms hold
hold expired before confirmation
partial seat availability in a multi-seat hold
confirm same hold twice
expire hold after booking should not release booked seats
```

### Production Extension

```text
atomic hold with DB row lock or Redis Lua
payment_in_progress state before payment provider call
idempotency key for confirm booking
expiry worker for stale holds
shard inventory by showtimeId or event/section
```

### 30-Minute Closing

> I would implement holds, expiry, and booking confirmation. The hard part is preventing double booking, so every operation checks the showtime-seat state before changing it. In production, I would make the hold operation atomic with a DB lock or Redis Lua.
