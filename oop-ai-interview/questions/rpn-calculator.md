# RPN Calculator With Undo And Reset

## Question

Design an in-memory Reverse Polish Notation calculator with undo and reset.

~~~text
2 3 +       -> 5
5 2 * 4 +   -> 14
undo        -> restores state before the previous command
reset       -> clears the calculator
~~~

## Clarifying Questions

* Which operators are required?
* Does undo reverse operands as well as operators?
* Is reset itself undoable?
* What happens on invalid input or division by zero?
* Should numbers support decimals?

Assume decimal numbers, +, -, *, /, one-level-at-a-time undo, and undoable reset.

## Components To Implement

~~~text
Calculator
Command
PushNumberCommand
BinaryOperationCommand
ResetCommand
Operator
~~~

## Relationships And Services

~~~text
Calculator owns the operand stack and undo history.
Command represents one operation but does not own global history.
Operator performs arithmetic without storing calculator state.
No repository or service is needed for one in-memory calculator session.
~~~

## Main Operations

~~~text
input(token) -> current stack
undo() -> current stack
reset()
result() -> number
~~~

## Invariants

~~~text
An operator requires at least two operands.
Operands use RPN order: "5 2 -" equals 3.
A failed command leaves the stack unchanged.
Undo restores the exact stack before the last successful command.
Reset clears the stack and can itself be undone.
result() is valid only when exactly one value remains.
~~~

## AI Prompt

~~~text
Implement an in-memory Java RPN calculator using BigDecimal. Support numeric
tokens, +, -, *, /, undo, reset, and result.

Model each successful input as a command or store an immutable stack snapshot
before each command. Undo must restore the exact previous stack, including after
reset. Validate operand count and division by zero before mutating state. Failed
commands must not enter history.

Calculator exclusively owns the operand stack and history. Commands may mutate
only that Calculator through its API. Operator is stateless. Do not introduce a
repository, service layer, singleton, or global stack.

Use plain Java with no parser framework, UI, or persistence. Add JUnit tests for
operand order, chained operations, invalid input, undo, reset, and division by zero.
~~~

## Tests

~~~text
"2 3 +" returns 5
"5 2 -" returns 3
chained operations use the previous result
operator with too few operands leaves stack unchanged
division by zero leaves stack and history unchanged
undo restores operands consumed by an operator
undo after reset restores the previous stack
result rejects zero or multiple values
~~~

## Tradeoffs And Follow-Ups

~~~text
Stack snapshots are simplest and safest for a short exercise.
Inverse commands use less memory but are harder to make correct.
Command pattern is useful if commands gain richer behavior.
Bound history size in a long-running production application.
~~~

## Strong Answer

> The hard part is not arithmetic; it is restoring the exact previous state. I only record successful commands, validate before mutation, and use BigDecimal for deterministic decimal arithmetic. A stack snapshot makes undo and reset behavior straightforward and testable.
