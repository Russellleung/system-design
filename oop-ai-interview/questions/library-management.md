# Library Management

## Question

Design an in-memory library that lends physical copies and supports title reservations.

## Clarifying Questions

* Are books titles or physical copies?
* Are reservations FIFO?
* What is the member borrowing limit?
* Are fines, notifications, and persistence in scope?

Assume FIFO reservations, a configurable loan limit, and no fine payment or persistence.

## Components To Implement

```text
Book, BookCopy
Member, Loan, Reservation
LibraryRepository, LoanRepository
InMemoryLibraryRepository, InMemoryLoanRepository
LibraryService
```

## Relationships And Services

```text
Book owns metadata; it does not contain active Loan objects.
BookCopy represents one physical copy and references bookId.
Loan stores memberId and copyId; Member does not hold a mutable loan list.
LibraryRepository stores Books, copies, Members, and reservation queues.
LoanRepository stores Loans.
LibraryService coordinates borrow and return; it does not own storage maps.
```

## Main Operations

```text
searchByTitle(query)
borrowCopy(memberId, bookId) -> Loan
returnCopy(copyId)
reserveBook(memberId, bookId)
```

## Invariants

```text
A BookCopy has at most one active Loan.
A member cannot exceed the loan limit.
The first eligible reservation has borrowing priority.
A returned Loan records its return time and cannot be returned twice.
```

## AI Prompt

```text
Implement an in-memory Java library using Book, BookCopy, Member, Loan,
Reservation, LibraryRepository, LoanRepository, in-memory implementations,
and LibraryService. Book contains title metadata; BookCopy is physical inventory.

Support search by title, borrow, return, and a FIFO reservation queue per book.
Enforce a configurable member loan limit and one active loan per copy. Use an
injected Clock.

Book must not hold Loans, and Member must not hold a mutable loan collection.
Loan stores memberId and copyId. LibraryRepository owns catalog, member, copy,
and reservation lookup; LoanRepository owns loans. Keep queries behind repositories;
LibraryService coordinates operations but must not own repository maps itself.

Use plain Java with no database, framework, notifications, or fine payment.
Add JUnit tests for availability, reservation priority, limits, and invalid return.
```

## Tests

```text
borrow an available physical copy
reject borrowing an already loaned copy
return makes the copy available
enforce member loan limit
first reservation gets priority
reject returning the same copy twice
```

## Tradeoffs And Follow-Ups

```text
Book is shared metadata; BookCopy is lendable inventory.
The service owns transitions; a replaceable FinePolicy can calculate fines later.
Production uses indexed search and a transaction for copy state plus Loan.
Keep Loan history immutable for audit.
```

## Strong Answer

> The key modeling choice is separating Book metadata from physical BookCopy inventory. Borrowing changes a copy and creates a loan; it never changes the abstract title. In production those changes belong in one transaction, while loan history remains immutable.
