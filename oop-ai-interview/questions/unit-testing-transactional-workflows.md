# Unit Testing Transactional Workflows

## Question

Implement and unit test a transactional wallet transfer workflow:

~~~text
transfer(requestId, fromAccountId, toAccountId, amount)
~~~

The workflow debits one account, credits another, records a transfer, and sends a notification after commit.

## Clarifying Questions

* Is the transaction local to one database?
* How are duplicate request IDs handled?
* What failures must be simulated?
* Should notification failure roll back money movement?
* Are concurrent transfers implemented or discussed?

Assume one local transaction, idempotent request IDs, single-threaded unit tests, and notification after commit.

## Components To Implement

~~~text
Account
Transfer, TransferStatus
TransferService
AccountRepository
TransferRepository
TransactionRunner
NotificationSender
~~~

## Relationships And Services

~~~text
Account owns its balance rules but not Transfer history.
Transfer is the immutable workflow record referencing account IDs.
Repositories own Accounts, Transfers, and request-ID lookup.
TransferService coordinates the transaction; it does not own storage maps.
NotificationSender is a post-commit boundary and stores no transfer state.
~~~

## Main Operation

~~~text
transfer(requestId, fromAccountId, toAccountId, amount) -> Transfer
~~~

## Invariants

~~~text
requestId uniquely identifies one transfer command.
A duplicate request returns the original Transfer.
Amount is positive and source differs from destination.
Source balance cannot become negative.
Debit, credit, and Transfer record commit together or all roll back.
Notification occurs only after commit and does not change transaction outcome.
~~~

## AI Prompt

~~~text
Implement a single-threaded Java wallet TransferService and unit tests using
AccountRepository, TransferRepository, TransactionRunner, and NotificationSender.

transfer must be idempotent by requestId. Validate both accounts and funds before
mutation. Debit, credit, and Transfer creation must run in one transaction.
Schedule notification only after a successful commit; notification failure must
not roll back a committed transfer.

Account owns balance behavior but no Transfer list. Transfer references account
IDs. Repositories own storage and the requestId index. TransferService coordinates
the transaction but must not own maps. NotificationSender stores no domain state.

Use plain Java and JUnit. Build controllable fakes that can fail at debit, credit,
transfer insert, commit, or notification. Do not use Spring, Mockito, a real
database, threads, or distributed transactions.
~~~

## Tests

~~~text
successful transfer debits, credits, records, then notifies
duplicate request returns original transfer and makes no new writes
insufficient funds performs no writes
credit failure rolls back debit
transfer-record failure rolls back both balances
commit failure sends no notification
notification happens after commit
notification failure leaves committed balances unchanged and is observable
~~~

## Testing Technique

~~~text
Use state assertions for final balances and stored Transfer.
Use an event-log fake to assert: begin, writes, commit, notify.
Inject one failure point into the fakes per test.
Assert both what happened and what must not happen.
Keep one failure reason per test.
~~~

## Tradeoffs And Follow-Ups

~~~text
Unit tests prove orchestration, not the real database transaction.
Integration tests must prove database rollback and locking.
Single-threaded tests do not prove race safety; add concurrent integration tests.
Reliable notification uses a transactional outbox, not an in-memory callback.
~~~

## Strong Answer

> I test a transaction by forcing failure at every boundary, then proving both the final state and forbidden side effects. Unit fakes verify orchestration quickly; database integration tests must still prove real rollback and concurrency. Notification is post-commit, so it cannot invalidate a successful money transfer.
