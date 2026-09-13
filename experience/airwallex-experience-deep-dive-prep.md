# Airwallex Deep-Dive Cheat Sheet

## How To Use

Do not memorize. Pick phrases.

Default structure:

```text
Problem -> Users -> Scale -> My role -> Hard part -> Tradeoff -> Impact -> Learning
```

Useful phrases:

* "I separated source of truth from projection."
* "I avoided claiming exactly-once across external systems."
* "At-least-once delivery plus idempotent writes."
* "The recovery paths made it production-safe."
* "I cared about operability, not just the happy path."
* "Strict correctness where it matters; eventual consistency where it is safe."

---

## 5-Minute Intro

```text
I am a backend engineer focused on financial workflows, state machines, idempotency, and reliable async systems.

Main project: RFQ blotter.
Problem: broker emails -> quote rows -> trader actions -> broker response.
Scale: ~40K quote rows/day, bursts ~2K rows, ~2 min SLA.
My role: ingestion, quote state, cache/WebSocket projection, completion, dispatch recovery.
Hard part: Outlook/SMTP/cache/WebSocket do not provide exactly-once semantics.
Solution: durable DB as source of truth, Hazelcast as projection, optimistic locking, Mongo active quote set, idempotent ingestion.
Learning: be honest about guarantees; design retries and reconciliation deliberately.

Why Airwallex: global financial infrastructure, spend workflows, issuing, payouts, reconciliation, APIs, webhooks.
```

Short version:

```text
My strongest experience is building backend workflows where money-adjacent state, retries, and external systems meet.
```

---

## Main Story: RFQ Blotter

### One-Liner

```text
I built a production RFQ workflow that turned bursty broker emails into a live trader blotter and completed broker response emails, with idempotent ingestion and recoverable state transitions.
```

### Problem

* Broker emails contained quote rows.
* Traders needed live status and fast actions.
* Manual tracking risked missed rows, stale status, duplicate processing.
* Outlook and SMTP are awkward for exactly-once.

Phrases:

* "The main problem was workflow correctness, not raw TPS."
* "Email and SMTP are not transactional systems."

### Users

* Traders: accept / deny / adjust quotes.
* Ops: know what is processed or stuck.
* Brokers: timely completed response.

### Scale

| Metric | Phrase |
| :--- | :--- |
| Rows/day | "~40K quote rows/day" |
| Burst | "~2K rows in a short burst" |
| SLA | "~2 min for straight-through RFQs" |
| Row size | "Raw row small; enriched UI object can be 5-10 KB" |

### Architecture

```text
Outlook/Broker Inbox
  -> Email Listener
  -> Email State DB + Quote DB
  -> CDC/internal events
  -> Hazelcast
  -> WebSocket Gateway
  -> Trader UI

Terminal quote events
  -> Mongo active_quote_ids
  -> Email complete
  -> Dispatch worker
  -> Broker response email
```

### My Contribution

* Idempotent email ingestion.
* Durable quote/email state.
* Trader action optimistic locking.
* Hazelcast UI projection.
* WebSocket update path.
* Mongo active quote set.
* Polling dispatch lock.
* Failure/retry design.

### Source Of Truth

```text
Quote DB + Email State DB = truth
Hazelcast = low-latency projection
WebSocket = delivery channel
Outlook state = convenience, not truth
```

Phrase:

```text
If Hazelcast was wrong, we rebuilt it. If the DB was wrong, we had a real incident.
```

### Idempotency

```text
email_thread_id = hash(Message-ID)
quote_row_id = hash(email_thread_id + row identity)
```

Phrase:

```text
Commit DB first, then mark Outlook processed.
```

### Broker Resends

```text
We deduped retries of the same message, not semantic broker resends.
```

Enhancement:

```text
row fingerprint = normalized row fields + content hash
```

### Trader Concurrency

```sql
UPDATE quotes
SET status = ?, version = version + 1
WHERE quote_id = ? AND version = ?;
```

Phrase:

```text
Optimistic locking was enough because conflicts were possible but not constant.
```

### Mongo Active Set

```javascript
active_quote_ids: ["Q1", "Q2", "Q3"]
$pull: { active_quote_ids: quoteId }
complete when active_quote_ids size = 0
```

Why:

* Avoid repeated sibling-count query.
* `$pull` is idempotent.
* Duplicate terminal events are safe.

Risk:

* Crash after `$pull`, before completion.

Mitigation:

* Sweeper finds `IN_PROGRESS + active_quote_ids=[]`.

### SMTP Dispatch

```text
poll COMPLETED
claim SENDING
send SMTP
mark DISPATCHED
```

Hard truth:

```text
SMTP is duplicate-suppressed, not exactly-once.
```

Failure case:

```text
SMTP succeeds, DB update fails, worker retries -> possible duplicate email.
```

### SQS Enhancement

```text
Email Poller -> SQS -> Email Ingestion Workers
```

Phrase:

```text
Kafka is great for event streams; SQS is simpler for long or bursty background jobs.
```

### Improvements

* SQS worker ingestion.
* DLQ for poison emails.
* Dashboards for stuck states.
* Row fingerprint for resends.
* Better replay tooling.

### Strong Close

```text
Financial state was durable. UI state was rebuildable. External systems were handled with idempotency and reconciliation.
```

---

## Agent Workflow Platform

### One-Liner

```text
I designed a decoupled multi-agent execution platform where gateways validate requests and executors run sandboxed tasks asynchronously, with inherited budgets for recursive sub-agents.
```

### Problem

* Long-running agent tasks.
* Tool/script sandboxing.
* Recursive sub-agents.
* Need RBAC, rate limits, token budgets, timeouts.

### Architecture

```text
Client
  -> Gateway: RBAC, rate limit, MCP validation
  -> Kafka request topic
  -> Executor
  -> sandboxed CLI scripts
  -> Kafka events/logs

Sub-agent:
Executor -> HTTPS Gateway 2 -> SSE progress stream
```

### Phrases

* "Gateway validates; executor runs."
* "No raw terminal execution; only approved CLI-wrapped scripts."
* "Recursive descendants inherit the parent's budget."
* "A child agent cannot escape the parent's rate limit or timeout."

### Hard Part

```text
Recursive execution control.
```

Guardrails:

* token budget
* timeout
* shared rate-limit bucket
* allowed tools
* trace context

### Why Kafka?

```text
To decouple public API ingestion from long-running execution.
```

### Risks

* runaway recursive agents
* unexpected cost
* privilege escalation
* stuck jobs
* sandbox escape

---

## DAG Graph Pricing Engine

### One-Liner

```text
I built a BigDecimal-based DAG calculation engine for pricing cascades, where input deltas propagate through memoized dependency graphs without rounding drift or redundant recomputation.
```

### Problem

* Pricing metrics depend on other metrics.
* Input delta cascades downstream.
* Need precision.
* Need reusable graph engine.

### Design

```text
dictionary 1: node -> children
dictionary 2: node -> update function
factory loads graph topology
memoized traversal updates affected nodes
```

### Phrases

* "Pricing cannot tolerate floating-point drift."
* "A cycle is a configuration error."
* "The core engine owned traversal; strategy code owned node math."
* "Memoization makes affected-subgraph evaluation O(V + E)."

### Validation To Mention

* cycle detection
* missing handler detection
* golden test cases
* precision policy tests

---

## Staleness Job

### One-Liner

```text
I built an in-memory staleness engine for around 6,000 RICs using binary search for validity windows and memoized DFS for dependency cascades.
```

### Scale Math

```text
6,000 RICs × 1 KB = 6 MB
```

```text
10 RICs/batch
6,000 / 10 = 600 batches
3,000 RPS × 10 = 30,000 RIC checks/sec
600 / 3,000 = 0.2 sec full universe scan
```

### Algorithms

```text
binary search over sorted validity windows = O(log K)
memoized DFS = O(V + E)
```

### Phrases

* "The working set was tiny, so the hot path should be memory-only."
* "The optimization was using the right algorithm, not exotic infrastructure."
* "Full-universe check in roughly 200 ms."

### Risks

* stale config
* bad market calendars
* false positives
* dependency graph cycles

---

## Tracing And Prometheus

### One-Liner

```text
I designed telemetry that avoids putting Prometheus/OpenTelemetry writes on the request hot path, using local buffers and async flushes.
```

### Design

```text
request thread -> in-memory counter/histogram buffer -> return
background flusher -> Prometheus/Otel collector every 1s or when full
```

Trace propagation:

```text
Gateway creates trace_id
HTTP/gRPC headers propagate it
Kafka headers propagate it
downstream services create child spans
```

### Phrases

* "Synchronous telemetry can become hidden latency."
* "Metrics can be best-effort. Financial audit events cannot."
* "Observability should answer: where is this customer's workflow stuck?"

Airwallex angle:

* webhook retries
* ERP sync failures
* payment transitions
* reconciliation delays

---

## Likely Questions

### Hardest Project?

```text
RFQ. The difficulty was coordinating state across Outlook, DB, cache, WebSocket, and SMTP without pretending there was exactly-once delivery.
```

### Biggest Tradeoff?

```text
We deduped same-message retries but did not do semantic broker-resend dedup in v1.
```

### Failure Handling?

```text
Duplicate email polling, stale cache, concurrent trader actions, completion races, ambiguous SMTP sends.
```

### Algorithmic Work?

```text
DAG: memoization reduced shared-subgraph recalculation to O(V + E).
Staleness: 6,000 RIC universe in ~200 ms with in-memory state.
```

### Observability?

```text
I avoid synchronous telemetry on hot paths. Metrics can be buffered; financial state changes need durable records.
```

### What Would You Do Differently?

```text
Build observability and stuck-state dashboards earlier.
```

### Ownership?

```text
I did not stop at the happy path. I pushed on partial commits, retries, stale projections, and external-system ambiguity.
```

---

## Airwallex Motivation

### Short Answer

```text
Airwallex builds global financial infrastructure through APIs. The hard problems are real: idempotency, reconciliation, accounting state, webhooks, customer integrations, and reliability.
```

### Spend Hooks

* Expenses and accounts payable.
* Card expenses, reimbursements, vendors, POs, bills.
* ERP sync workflows.
* Sync status prevents re-processing.
* Webhooks for spend events.
* Related: issuing, billing, payouts.

Phrase:

```text
Spend is not just CRUD; it is workflow state between Airwallex, customers, employees, finance teams, and ERPs.
```

### Why Engineer At Airwallex?

```text
I want to work on systems where API design, financial correctness, and customer workflow reliability all matter.
```

### Link To RFQ

```text
RFQ taught me how to design around at-least-once external systems. Airwallex has similar patterns with webhooks, ERP sync, spend status, and payment workflows.
```

---

## AI / Growth

### AI Workflow

```text
I use AI for design alternatives, edge-case checklists, test ideas, documentation, and code reading. I still verify with tests, logs, primary docs, and code.
```

### AI In Finance

```text
AI assists; deterministic systems decide; auditable records remain source of truth.
```

### Growth

```text
I want to own ambiguous systems end to end: clarify product problem, choose pragmatic architecture, ship, observe, iterate.
```

Reflection prompts:

* Did this solve the user problem?
* Did we over-engineer?
* What failure mode surprised us?
* Could another engineer operate this?
* What would I simplify now?

---

## Questions To Ask Airwallex

Pick 2-3.

1. "For Spend APIs, what are the hardest customer integration problems today: ERP data models, webhook reliability, permissions, or reconciliation?"
2. "How does Airwallex balance product velocity with correctness in money-moving or accounting-adjacent workflows?"
3. "What does strong backend ownership look like here after the first six months?"
4. "How are teams applying AI internally while preserving auditability and reliability?"

---

## Quick Phrase Bank

* "At-least-once delivery, idempotent writes, explicit reconciliation."
* "Durable DB for business state; cache for speed."
* "I did not want cache correctness to be a dependency for financial correctness."
* "External systems rarely give clean exactly-once semantics."
* "The design goal was not perfection; it was a recoverable production workflow."
* "I chose the simplest architecture that made failure modes explicit."
* "A slow or failed downstream system should degrade UX, not corrupt state."
* "Metrics are best-effort; audit state is durable."
* "The important thing is what happens after the retry."

---

## Sources

* Airwallex Spend overview: https://www.airwallex.com/docs/spend/overview
* Airwallex Spend model and sync concepts: https://www.airwallex.com/docs/spend/how-airwallex-spend-works
* Airwallex Spend webhooks: https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events/spend
* Airwallex Card Expenses API: https://www.airwallex.com/docs/spend/expenses/card-expenses-via-api
* Airwallex Reimbursements API: https://www.airwallex.com/docs/spend/expenses/reimbursements-via-api
