# In-Memory Payment And Refund Engine

## Question

Design an in-memory engine that creates payments, captures them, and issues refunds.

## Clarifying Questions

* Is authorization separate from capture?
* Are partial and multiple refunds allowed?
* Can a refund be retried?
* Is one currency used per payment?
* Are concurrency and persistence implemented or discussed?

Assume CREATED -> AUTHORIZED -> CAPTURED, partial refunds, one currency per payment, and single-threaded execution.

## Components To Implement

~~~text
Money
Payment, PaymentStatus
Refund, RefundStatus
PaymentService
PaymentRepository, RefundRepository
~~~

## Relationships And Services

~~~text
Payment owns payment state and captured/refunded totals.
Refund is an immutable record referencing paymentId.
Repositories store Payments and Refunds and index idempotency request IDs.
PaymentService coordinates transitions; it does not own storage maps.
Customer is represented by customerId and does not hold payment history.
~~~

## Main Operations

~~~text
createPayment(requestId, customerId, amount) -> Payment
authorize(paymentId)
capture(paymentId)
refund(refundRequestId, paymentId, amount) -> Refund
getPayment(paymentId)
~~~

## Invariants

~~~text
Payment and refund IDs are unique.
The same request ID returns the original result.
Only AUTHORIZED payments can be captured.
Only CAPTURED or PARTIALLY_REFUNDED payments can be refunded.
Total successful refunds cannot exceed the captured amount.
Currency must match and amounts must be positive.
Terminal transitions cannot be reversed.
~~~

## AI Prompt

~~~text
Implement a single-threaded in-memory Java payment and refund engine using Money,
Payment, Refund, status enums, repositories, and PaymentService.

Support create, authorize, capture, and partial refund. Use BigDecimal with a
currency code. Make createPayment idempotent by requestId and refund idempotent
by refundRequestId: a repeated request returns the original object. Reject invalid
state transitions and refunds whose cumulative total exceeds the captured amount.

Payment owns its state and totals. Refund is immutable and stores paymentId.
Repositories own object storage and request-ID indexes. PaymentService coordinates
operations but must not own maps. Customer remains customerId only and must not
contain payment or refund collections.

Validate before mutation. Use plain Java with no HTTP, database, payment gateway,
threads, or framework. Add focused JUnit tests for transitions, money, retries,
partial refunds, and over-refunds.
~~~

## Tests

~~~text
create, authorize, and capture payment
reject capture before authorization
duplicate create request returns same payment
partial refunds update refundable amount
multiple refunds may equal but never exceed captured amount
duplicate refund returns same refund without changing totals
reject currency mismatch, zero, and negative amounts
~~~

## Tradeoffs And Follow-Ups

~~~text
Single-threaded code avoids simultaneous races but still needs idempotent retries.
Production protects refund check-and-update with a transaction or row lock.
Store an immutable transaction ledger rather than only mutable totals.
Gateway calls need durable attempts, idempotency keys, and reconciliation.
~~~

## Strong Answer

> I model payment as a state machine and refunds as separate immutable records. The two key guarantees are idempotent commands and cumulative refunds never exceeding the capture. Single-threaded execution removes races here; production would enforce the refund check and ledger write atomically.
