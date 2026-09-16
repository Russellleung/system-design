# OOP AI Coding Interview Guide

## Goal

Show that you can drive the design, use AI safely, test behavior, and explain tradeoffs.

Do not let AI become the driver. You are the engineer; AI is the fast typist/pair programmer.

---

## Step-by-Step Workflow

### 1. Restate The Problem

Say:

> Let me restate the problem and confirm the scope before coding.

Clarify:

* core users / actors
* main operations
* in-memory or persistent storage
* single machine or concurrent system
* required edge cases
* expected extensibility

Example:

```text
For parking lot, I assume this is in-memory, supports park/release,
multiple vehicle types, and we do not need payment unless requested.
```

---

### 2. Identify Objects

List nouns and responsibilities.

Use:

```text
Entity objects: represent domain data.
Service/manager objects: coordinate operations.
Strategy objects: allow replaceable logic.
Repository objects: hide storage if needed.
```

Say:

> I will separate domain objects from orchestration logic so the model stays testable.

---

### 3. Define Invariants

Before coding, state the rules that must never break.

Examples:

```text
A parking spot cannot hold two vehicles.
A library copy cannot be borrowed by two users.
An elevator cannot be in two floors at once.
A split expense must balance to zero.
```

Say:

> The important invariant is...

---

### 4. Create Minimal Files

Do not create a giant project unless required.

Default structure:

```text
src/main/java/.../domain/
src/main/java/.../service/
src/test/java/.../
```

For a short interview, this is enough:

```text
Model classes
One service/manager class
One test file
```

Avoid:

```text
Spring Boot setup
database config
Docker
too many interfaces
```

Unless the interviewer asks.

---

### 5. Write Tests Or Examples First

Tests prove you are not blindly trusting AI.

Start with 3-5 tests:

```text
happy path
invalid input
capacity / unavailable case
state transition
idempotent/repeated action if relevant
```

Say:

> I will add a few tests first so we have a safety net while using AI.

---

### 6. Prompt AI In Small Chunks

Bad prompt:

```text
Build the whole system.
```

Good prompt:

```text
Create simple Java classes for ParkingLot, Floor, ParkingSpot, Vehicle, and Ticket.
Keep it in-memory. Do not use frameworks. Make it easy to unit test.
```

Then:

```text
Now implement parkVehicle and releaseVehicle.
Respect this invariant: one occupied spot has exactly one active ticket.
```

---

### 7. Review AI Output

Check:

```text
Does each class have one clear responsibility?
Are there hidden global variables?
Are edge cases handled?
Are names clear?
Are there unnecessary abstractions?
Can tests prove behavior?
```

Say:

> I am checking the generated code against the invariants, especially state transitions.

---

### 8. Run Tests And Fix

Do:

```text
run tests
read failure
fix smallest issue
run again
```

Say:

> I prefer tests to drive the correction rather than guessing.

---

### 9. Refactor Only After It Works

Improve:

```text
names
method boundaries
strategy extraction
validation
error handling
```

Do not refactor unrelated code.

Say:

> Now that behavior is covered, I would clean up naming and extract a strategy only where it removes real branching.

---

### 10. Explain Extension Points

End with:

```text
What I built
Main invariant
Tradeoff
How to extend
What I would test next
```

Example:

> This version is in-memory and optimized for clarity. If this became production, I would add persistence, concurrency control, metrics, and idempotency around commands.

---

## What To Say When Using AI

Use:

```text
I will use AI for boilerplate, but I will own the object model and edge cases.
```

```text
I will keep prompts narrow so the generated code is reviewable.
```

```text
I will verify with tests before trusting the implementation.
```

```text
I will avoid over-engineering until the requirement appears.
```

---

## Default Design Checklist

Ask:

```text
Who are the actors?
What are the main operations?
What is the core invariant?
What state transitions exist?
What can fail?
What must be unique?
What should be extensible?
Is concurrency in scope?
Is persistence in scope?
```

Design:

```text
Entities
Value objects
Services/managers
Strategies
Repositories only if storage matters
Tests
```

Avoid:

```text
Too many patterns
Premature microservices
Framework setup
Unreviewed AI code
No tests
```

