# Food Delivery / Restaurant Ordering

## Question

Design the in-memory order lifecycle for a food delivery marketplace.

## Clarifying Questions

* Is this a marketplace or one restaurant?
* Which order states and cancellation rules are required?
* Are payment and courier assignment fully in scope?
* Can menu prices change while an item is in the cart?

Assume a marketplace; payment and courier systems are external boundaries.

## Components To Implement

```text
Restaurant, MenuItem, Cart
OrderItem, Order, OrderStatus
RestaurantRepository, InMemoryRestaurantRepository
OrderRepository, InMemoryOrderRepository
OrderStateMachine, OrderService
```

## Relationships And Services

```text
Restaurant owns menu information only; it does not hold Order objects.
Cart owns mutable selections before checkout.
Order owns immutable OrderItems, restaurantId, customerId, total, and status.
OrderRepository stores and queries Orders, including by restaurantId.
RestaurantRepository stores restaurants and current menus.
OrderService coordinates commands and authorization; it does not own storage.
```

## Main Operations

```text
addToCart(item, quantity)
placeOrder(cart) -> Order
acceptOrder(restaurantId, orderId)
rejectOrder(restaurantId, orderId)
cancelOrder(customerId, orderId)
updateStatus(orderId, nextStatus)
```

## Invariants

```text
OrderItem stores the checkout name and price snapshot.
A placed Order cannot be edited.
Only the owning restaurant can accept or reject it.
Only defined state transitions are allowed.
A terminal Order cannot transition again.
```

## AI Prompt

```text
Implement an in-memory Java ordering model using Restaurant, MenuItem, Cart,
OrderItem, Order, OrderStatus, OrderStateMachine, OrderRepository,
InMemoryOrderRepository, RestaurantRepository, InMemoryRestaurantRepository,
and OrderService.

placeOrder must copy item name and price into immutable OrderItems. Support
restaurant accept/reject, customer cancellation before preparation, and valid
transitions through PREPARING, OUT_FOR_DELIVERY, and DELIVERED. Verify restaurant
ownership.

Restaurant owns menu information only and must not contain a collection of
orders. Each Order stores restaurantId and customerId. Store and query orders
through OrderRepository. Store restaurants and menus behind RestaurantRepository.
OrderService coordinates operations and authorization
but does not own an order Map or List.

Use plain Java. Model payment and courier assignment only as IDs or statuses.
Do not add APIs, persistence, or messaging. Add JUnit transition and snapshot tests.
```

## Tests

```text
place order and calculate total from checkout snapshots
menu price change does not alter placed order
owning restaurant accepts pending order
wrong restaurant cannot accept order
reject invalid state transition
reject cancellation after preparation
```

## Tradeoffs And Follow-Ups

```text
OrderItem is a snapshot; MenuItem is the current catalog entry.
An explicit state machine keeps transition rules in one place.
Production needs idempotent placeOrder, a persisted audit trail, and an outbox.
Payment and courier workflows remain separate service boundaries.
```

## Strong Answer

> I centered the design on immutable OrderItem snapshots and an explicit order state machine. Payment and courier dispatch are boundaries, not extra domain models for this exercise. In production, placeOrder needs idempotency and persisted transitions should publish through an outbox.
