# Library Management

## Question

Design a library management system.

## Clarifying Questions

* Are books unique titles or physical copies?
* Can users reserve books?
* Loan duration and overdue fines?
* Search by title, author, category?
* Is persistence required?

## Core Objects

```text
Book
BookCopy
Member
Loan
Reservation
LibraryCatalog
LoanService
FinePolicy optional
```

## Main Operations

```text
searchBooks(query)
borrowCopy(memberId, bookId)
returnCopy(copyId)
reserveBook(memberId, bookId)
getMemberLoans(memberId)
```

## Invariants

```text
A physical copy can have at most one active loan.
A member cannot borrow beyond limit.
Reserved copy should not be borrowed by another member.
Returned loan must have return time.
```

## AI Prompt

```text
Create a Java in-memory library system.
Distinguish Book from BookCopy.
Implement borrow, return, reserve, and simple search.
Add tests for copy availability and member borrowing limits.
```

## Tests

```text
borrow available copy
cannot borrow already loaned copy
return makes copy available
member borrowing limit enforced
reservation blocks other borrowers
```

## Tradeoffs

```text
Book is metadata; BookCopy is inventory.
LoanService owns state transitions.
FinePolicy should be replaceable.
Search can start simple and later use an index.
```

## Strong Answer

> The important modeling choice is separating Book from BookCopy. A title can have many physical copies, and borrowing applies to a copy, not the abstract book. That keeps availability and loans precise.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
Book
BookCopy
Member
Loan
Reservation
LibraryService
FinePolicy optional
```

### Hard Part To Emphasize

```text
Borrowing applies to a physical BookCopy, not a Book title.
Loan state transition must be guarded.
Member borrowing limits must be enforced.
```

### Deeper Edge Cases

```text
copy already loaned
member has reached loan limit
reserved copy borrowed by wrong member
return unknown copy
return same copy twice
overdue loan triggers fine calculation
```

### Production Extension

```text
indexed catalog search
DB transaction around copy status + loan row
reservation queue per book
immutable loan history for audit
notification job for due/overdue loans
```

### 30-Minute Closing

> I would implement borrow, return, and reserve around BookCopy state. The main invariant is one active loan per physical copy. For production, I would move state transitions into a database transaction and keep loan history immutable.
