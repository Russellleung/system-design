# Refactoring A Legacy API Handler

## Question

Refactor this legacy order handler without changing its observable behavior:

~~~java
Response createOrder(Request request) {
    if (request.customerId() == null || request.items().isEmpty()) {
        return Response.badRequest();
    }

    Customer customer = database.findCustomer(request.customerId());
    BigDecimal total = BigDecimal.ZERO;
    for (ItemRequest item : request.items()) {
        Product product = database.findProduct(item.productId());
        total = total.add(product.price().multiply(BigDecimal.valueOf(item.quantity())));
        database.decrementStock(product.id(), item.quantity());
    }

    database.insertOrder(customer.id(), request.items(), total);
    emailClient.sendConfirmation(customer.email(), total);
    return Response.created();
}
~~~

The handler mixes validation, business rules, persistence, and email. It can decrement some stock before a later item fails.

## Clarifying Questions

* Which responses and side effects are contractual?
* Are characterization tests available?
* Must database calls be transactional?
* Should email failure fail the order?
* May public request and response types change?

Assume the public API stays unchanged, stock and order writes are transactional, and email occurs only after commit.

## Components To Implement

~~~text
OrderHandler: HTTP mapping only
CreateOrderCommand: validated input
OrderService: workflow orchestration
PricingService: price calculation
OrderRepository, ProductRepository: persistence boundaries
TransactionRunner: transaction boundary
ConfirmationSender: post-commit side effect
~~~

## Relationships And Services

~~~text
Order stores customerId, immutable line snapshots, total, and status.
Customer and Product do not hold Order collections.
Repositories own persistence and queries.
OrderService coordinates the transaction; it does not own storage collections.
OrderHandler owns only HTTP translation and no business state.
~~~

## Refactoring Steps

~~~text
1. Add characterization tests around current responses.
2. Extract request validation without changing behavior.
3. Introduce repositories around existing database calls.
4. Move product and stock validation before mutation.
5. Wrap stock decrement and order insert in one transaction.
6. Move email behind ConfirmationSender and invoke after commit.
7. Keep the handler as mapping -> service -> response.
~~~

## Invariants

~~~text
Public request and response behavior remains compatible.
All products and quantities are validated before writes.
Stock decrement and order creation both commit or both roll back.
Email is never sent for a rolled-back order.
Business rules do not depend on HTTP types.
Dependencies can be replaced by fakes in tests.
~~~

## AI Prompt

~~~text
Refactor the supplied Java createOrder handler incrementally without changing
its public Request or Response contract.

Create OrderHandler, CreateOrderCommand, OrderService, repository interfaces,
TransactionRunner, and ConfirmationSender. Validate all products and stock before
writing. Put stock decrements and order insertion in one transaction. Send the
confirmation only after a successful commit.

Order stores customerId and immutable line snapshots. Customer and Product must
not contain Order collections. Repositories own storage; OrderService owns the
workflow but no maps; OrderHandler performs only HTTP translation.

First add characterization tests, then perform the extraction. Use plain Java
and JUnit with small fakes; no Spring, database implementation, HTTP framework,
or broad rewrite. Show final code and tests, and identify each safe step.
~~~

## Tests

~~~text
invalid request returns the existing bad-request response
unknown product or insufficient stock performs no writes
valid request decrements all stock and inserts one order
failure during second stock update rolls back every write
email is sent once after commit
email is not sent after rollback
handler delegates business behavior to OrderService
~~~

## Tradeoffs And Follow-Ups

~~~text
Characterization tests protect behavior before structural change.
Extract in small steps so failures reveal which move changed behavior.
A real database transaction provides write atomicity.
Reliable email delivery needs an outbox; direct post-commit sending can be lost.
Do not introduce patterns unrelated to observed problems.
~~~

## Strong Answer

> I would not start by rewriting the handler. I would capture its contract with characterization tests, then separate one responsibility at a time. The critical correction is validating before mutation and placing stock plus order writes in one transaction. Email is post-commit; production reliability would require an outbox.
