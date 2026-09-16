# Food Delivery / Restaurant Ordering

## Question

Design a food delivery ordering system.

## Clarifying Questions

* Marketplace or single restaurant?
* Delivery assignment in scope?
* Payment in scope?
* Can orders be cancelled?
* Need menu updates?

## Core Objects

```text
Restaurant
Menu
MenuItem
Cart
Order
OrderItem
Customer
Courier
Payment
OrderStateMachine
```

## Main Operations

```text
addToCart(item, quantity)
placeOrder(cart)
acceptOrder(restaurantId, orderId)
assignCourier(orderId)
updateOrderStatus(orderId, status)
cancelOrder(orderId)
```

## Invariants

```text
Order price is calculated from menu snapshot at checkout.
Cannot modify order after it is placed unless explicitly supported.
Invalid state transitions are rejected.
Payment should not be captured twice.
```

## AI Prompt

```text
Create a Java in-memory food ordering system.
Use Order, OrderItem, Restaurant, MenuItem, and OrderStatus.
Implement placeOrder, acceptOrder, cancelOrder, and status transitions.
Use tests to verify invalid transitions.
```

## Tests

```text
place order from cart
price uses checkout snapshot
restaurant accepts pending order
cannot cancel delivered order
cannot transition directly from pending to delivered
```

## Tradeoffs

```text
Snapshot price to avoid menu price changes affecting existing orders.
State machine protects invalid transitions.
Payment and delivery can be separate services.
Use idempotency key for placeOrder in production.
```

## Strong Answer

> I would center the design around the order state machine. Food ordering has many invalid transitions, so making state transitions explicit is more important than adding many classes early.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
Restaurant
MenuItem
Cart
Order
OrderItem
OrderStatus
OrderService
OrderStateMachine
```

### Hard Part To Emphasize

```text
OrderItem is a checkout snapshot of MenuItem.
Order state transitions must be explicit.
Payment/delivery can be external boundaries, not fully implemented.
```

### Deeper Edge Cases

```text
menu price changes after order placed
restaurant rejects order
cancel after restaurant accepts
invalid status transition
item becomes unavailable while in cart
duplicate placeOrder retry
```

### Production Extension

```text
idempotency key for placeOrder
DB transaction for order + payment attempt
outbox event to restaurant/courier dispatch
state machine persisted with audit trail
inventory/menu availability cache
```

### 30-Minute Closing

> I would implement cart-to-order conversion with immutable OrderItems and a small order state machine. The important production concern is idempotent order placement because retries must not create two paid orders.
