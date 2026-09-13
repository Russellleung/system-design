# RFQ Blotter: Bulk Quoting & Completion Engine

## Context

This was a production RFQ workflow for broker emails containing quote rows that needed to be parsed, surfaced to traders, actioned, and returned to the broker as a completed response email.

The system was optimized for bursty broker traffic rather than high steady-state throughput.

| Metric | Approximation | Notes |
| :--- | :--- | :--- |
| Quote rows/day | ~40,000 | Normal business-day volume |
| Email-to-quote ratio | ~10 quote rows/email average | Some broker emails contained hundreds or thousands of rows |
| Peak burst | ~2,000 quote rows in a short burst | There could also be quiet periods with no email for an hour |
| Quote row size | ~10 KB | Parsed row, enrichment fields, and UI state |
| SLA | ~2 min for straight-through-processable RFQs | Manual-touch RFQs were surfaced quickly, but final broker response depended on trader action |

The goal was not a perfect greenfield architecture. The goal was a pragmatic system that got reliable RFQ processing to market quickly while protecting the source-of-truth database from duplicate ingestion and conflicting trader actions.

---

## High-Level Flow

```text
Broker Inbox
    |
    | poll + parse
    v
Email Listener
    |
    +--> Email State Engine / DB
    |       email_threads table
    |
    +--> Quote State Engine / DB
            quotes table
                |
                | CDC / internal event stream
                v
            Cache Publisher
                |
                v
            Hazelcast Grid
                |
                v
            WebSocket Gateway
                |
                v
            Trader UI

Quote State Engine
    |
    | terminal quote updates via CDC
    v
Email State Engine
    |
    | status = COMPLETED / PENDING_DISPATCH
    v
Email Dispatch Service
    |
    | polling job
    v
Broker Response Email
```

---

## Ingestion & Record Creation

### Broker Inbox & Listener

The Email Listener polled the broker inbox, parsed incoming RFQ emails, and created initial records:

* one parent record in `email_threads`
* many child rows in `quotes`

Logical ownership was separated between the Email State Engine and Quote State Engine. In the simple deployment, initial creation could use one local transaction because both records were created inside the same durable database boundary. If the engines were split physically, the same design still worked with idempotent upserts plus reconciliation.

The important point was avoiding duplicate logical records during ingestion.

```text
BEGIN
  UPSERT email_threads (...)
  UPSERT quotes (...) -- one row per parsed quote
COMMIT
```

### Idempotent Ingestion

The ingestion goal was idempotent processing of the same email, not semantic deduplication of broker RFQs.

```text
email_thread_id = SHA256(Message-ID or normalized email identity)
quote_row_id    = SHA256(email_thread_id + line_index)
```

If the same inbox message was reprocessed, the idempotency keys prevented duplicate records.

If a broker resent a modified email, the system treated it as new operational input unless the broker workflow explicitly marked it as a replacement. This was an intentional time-to-market tradeoff: business-level quote deduplication was not the responsibility of the ingestion layer.

### Crash Recovery

If the listener crashed mid-processing, the email was re-discovered by polling/reconciliation using `Message-ID` and idempotency keys. Reprocessing was safe because writes were idempotency-protected.

### Potential Enhancement: SQS + Worker-Based Email Ingestion

The original listener directly polled the broker inbox and parsed messages. A later enhancement would be to split mailbox discovery from parsing work:

```text
Email Poller
    |
    | discover unread / unprocessed broker message
    v
SQS email-ingestion queue
    |
    | at-least-once job delivery
    v
Email Ingestion Workers
    |
    | fetch email by Message-ID, parse rows, idempotent upsert
    v
Email State DB + Quote DB
```

SQS fits this better than Kafka if the problem is background work dispatch rather than event-stream replay. Email parsing is bursty and job-like: there may be no email for an hour, then a short burst of large RFQ emails. SQS gives visibility timeout, retry, worker scaling from queue depth, and DLQ handling without forcing one slow email parse to block a Kafka partition.

The important correctness rule remains the same: SQS is at-least-once, so workers must be idempotent by `Message-ID` / `email_thread_id`. Duplicate SQS delivery should re-fetch the same email and hit the same idempotent upserts, not create duplicate quote rows.

This would improve operational elasticity:

* Poller stays simple and only discovers work.
* Parsing workers scale out during bursts.
* Poison emails go to DLQ for manual review.
* Worker crashes are retried automatically after visibility timeout.

It is an enhancement, not a required baseline. For the observed volume, direct polling plus idempotent DB writes was acceptable and faster to ship.

### Outlook Polling Note

For Outlook/Microsoft Graph polling, the poller should only mark the message processed after durable DB work succeeds:

```text
poll Outlook inbox
    -> claim message_id in DB
    -> parse email
    -> idempotent upsert email_thread + quote rows
    -> commit DB
    -> mark Outlook message processed / move folder / add category
```

If the DB commit succeeds but the Outlook update fails, the message may be seen again on the next poll. That is acceptable because ingestion is at-least-once and DB writes are idempotent by `Message-ID` / `email_thread_id`.

Outlook state is not the source of truth; it is only a convenience to reduce repeat polling.

---

## Trader Execution & Cache Refresh

### Trader Action Backend

The Trader Action Backend received trader commands from the UI:

* `ACCEPT`
* `DENY`
* `ADJUST`

It validated the request and committed state changes through the Quote State Engine.

Quote updates used optimistic locking:

```sql
UPDATE quotes
SET status = ?,
    version = version + 1,
    updated_at = NOW()
WHERE quote_id = ?
  AND version = ?;
```

If `rows_affected = 0`, another trader or process had already changed the row, and the UI received a `409 Conflict`.

### Hazelcast Projection

The durable Quote DB remained the source of truth. Hazelcast was a low-latency projection for live trader UI state.

Quote state mutations were propagated asynchronously via CDC or internal event streams:

```text
Quote DB commit
    |
    v
Cache Publisher
    |
    v
Hazelcast quotesIMap
    |
    v
WebSocket Gateway
```

If the DB commit succeeded but Hazelcast update failed, the UI could be temporarily stale, but the source of truth was still correct. Hazelcast could be repaired by replaying events or rehydrating active rows from the durable Quote DB.

---

## WebSocket Streaming

The WebSocket Gateway streamed quote deltas to connected Trader UIs.

### Hazelcast Usage

Hazelcast stored active quote instances in memory:

```text
quotesIMap
backup-count: 1
IEventJournal enabled
```

The gateway subscribed to Hazelcast entry updates and routed payloads to WebSocket sessions mapped by `email_thread_id`.

### Connection Safety

To avoid traders acting on stale UI state:

* Ping/pong heartbeat every 5 seconds
* Drop session after 3 missed pongs
* UI enters `Connection Stale` mode and disables action buttons

### Reconnect & Delta Sync

On reconnect, the client sent `last_seen_sequence_id`.

The gateway attempted to replay missed deltas from Hazelcast `IEventJournal`. If the event journal no longer contained the missed range, the gateway fell back to the Quote Engine snapshot for that email thread.

The journal was treated as a bounded replay buffer, not the source of truth.

---

## Quote-to-Email Completion

When quote rows reached terminal states, the Email State Engine needed to know when the parent email was complete.

Terminal quote states:

```text
ACCEPTED
DENIED
EXPIRED
```

Quote terminal updates flowed into the Email State Engine via CDC/internal event stream.

The Email State Engine stored the parent thread in MongoDB with the still-active quote IDs:

```javascript
{
  email_thread_id: "EML-101",
  status: "IN_PROGRESS",
  active_quote_ids: ["Q1", "Q2", "Q3"],
  dispatched: false
}
```

On each terminal quote event, the Email State Engine removed that quote from the active set:

```javascript
db.email_threads.updateOne(
  { email_thread_id: "EML-101", status: "IN_PROGRESS" },
  {
    $pull: { active_quote_ids: "Q1" },
    $set: { updated_at: new Date() }
  }
);
```

Then it attempted a guarded completion update:

```javascript
db.email_threads.updateOne(
  {
    email_thread_id: "EML-101",
    status: "IN_PROGRESS",
    active_quote_ids: { $size: 0 }
  },
  {
    $set: {
      status: "COMPLETED",
      completed_at: new Date(),
      updated_at: new Date()
    }
  }
);
```

This avoided a repeated sibling-count query against the quote table. `$pull` was idempotent, so duplicate terminal events for the same quote were safe. Multiple terminal quote updates could race, but only one guarded update could move the email from `IN_PROGRESS` to `COMPLETED`.

A small reconciliation job also checked for threads with `status = IN_PROGRESS` and `active_quote_ids = []`. This covered the crash window where the quote ID had been pulled from the set, but the completion update had not yet run.

---

## Email Dispatch

The final broker response email was sent by a periodic dispatch worker.

The system did not use Kafka/outbox for dispatch in the final design. A polling worker directly queried the Email State Engine database.

### Dispatch Flow

```text
Email Dispatch Service
    |
    | poll COMPLETED rows
    v
lock row as SENDING
    |
    | fetch final quote states
    v
render response email
    |
    | SMTP send
    v
mark DISPATCHED
```

### Dispatch Lock

The worker claimed a completed email with a guarded update:

```javascript
db.email_threads.findOneAndUpdate(
  {
    email_thread_id: "EML-101",
    status: "COMPLETED",
    dispatched: false
  },
  {
    $set: {
      status: "SENDING",
      dispatch_attempt_id: "ATTEMPT-123",
      locked_until: new Date(Date.now() + 120000),
      updated_at: new Date()
    }
  },
  { returnDocument: "after" }
);
```

After successful SMTP send:

```javascript
db.email_threads.updateOne(
  {
    email_thread_id: "EML-101",
    dispatch_attempt_id: "ATTEMPT-123"
  },
  {
    $set: {
      status: "DISPATCHED",
      dispatched: true,
      smtp_message_id: "SMTP-456",
      dispatched_at: new Date(),
      updated_at: new Date()
    }
  }
);
```

### SMTP Ambiguity

SMTP was not perfectly idempotent.

The awkward failure case was:

```text
SMTP send succeeds
DB update to DISPATCHED fails
poller retries later
broker may receive duplicate response email
```

The system reduced this risk with:

* dispatch row lock
* stable outbound `Message-ID`
* `smtp_message_id` tracking
* reconciliation for stale `SENDING` rows
* broker-visible duplicate detection where supported

This was an intentional tradeoff. Duplicate outbound email was possible in rare ambiguous SMTP cases, but quote state corruption was not: the durable Quote DB and Mongo-backed Email State DB remained the sources of truth.

---

## Rehydration

Hazelcast was disposable.

If the Hazelcast cluster restarted or lost data, the Quote State Engine rehydrated active state by first reading active thread IDs from the Email State DB:

```javascript
db.email_threads.find(
  { status: { $in: ["IN_PROGRESS", "COMPLETED", "SENDING"] } },
  { email_thread_id: 1 }
);
```

The service then loaded matching quote rows for those `email_thread_id` values from the Quote DB.

Cold rehydration was acceptable because only active RFQ threads needed to be loaded, not historical records.

---

## Tradeoffs

| Decision | Tradeoff |
| :--- | :--- |
| Durable DBs as source of truth | Slower than pure in-memory, but simple and recoverable |
| Hazelcast projection | Fast UI updates, but eventual consistency versus DB |
| CDC/internal streams for cache/email completion | Decoupled services, but propagation can lag briefly |
| Polling dispatch worker | Simpler than Kafka/outbox for this volume, but requires careful dispatch locking |
| No semantic quote deduplication | Faster time to market, but broker resends may create new operational input |
| Optimistic locking for trader actions | Simple conflict prevention, occasional 409s under concurrent edits |

---

## Interview Framing

The clean way to describe the system:

```text
The durable Quote DB and Mongo-backed Email State DB were the sources of truth.
Hazelcast was a disposable low-latency projection.
Ingestion was idempotent for repeated email processing.
Quote actions used optimistic locking.
Email completion used a Mongo active-quote set plus a guarded state transition.
SMTP dispatch was best-effort duplicate-suppressed, not perfectly exactly-once.
```

This was a pragmatic production design: reliable enough for the business workflow, fast to ship, and honest about the places where external systems like inbox polling and SMTP do not provide perfect exactly-once guarantees.
