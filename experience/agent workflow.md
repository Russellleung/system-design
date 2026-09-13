Agent

"I designed a decoupled, multi-agent platform separating API ingestion from execution. Gateways handle RBAC, rate-limiting, and MCP function validation, while Executors run sandboxed CLI scripts asynchronously via Kafka. For sub-agent delegation, an Executor issues an HTTPS call to a downstream Gateway and consumes progress over SSE, passing an inherited execution context that strictly enforces shared rate limits, token budgets, and timeouts across all recursive descendants."




1. A Request Arrives at the Gatekeeper (Gateway Ingestion) A client or upstream service sends a task to the platform. Gateway 1 (g1) acts as the security checkpoint: it checks the agent's identity (RBAC), ensures the user hasn't hit speed limits (rate limiting), and verifies that the requested action maps to an allowed tool (MCP function validation).
2. Handing Off the Work (Kafka Queue) Instead of doing heavy computing on the spot, g1 packages the approved request—along with a "wallet" containing token budgets and time limits—and drops it into request kafka. This decouples the public API from the heavy execution engine.
3. Execution in the Sandbox (Executor 1) Executor 1 (E1) picks up the job from Kafka. To prevent destructive behavior, E1 runs the task inside a locked-down, isolated container. It doesn't run raw terminal commands; it strictly invokes pre-approved CLI-wrapped Python scripts (via Cyclopts). As it runs, E1 streams logs back to g1 over events kafka.
4. Calling in a Specialist (Recursive Sub-Task via HTTPS/SSE) Mid-job, Agent 1 realizes it needs a specialist (e.g., a data analyst agent). It makes an HTTPS POST call to Gateway 2 (g2) to spawn the sub-agent and holds open a Server-Sent Events (SSE) stream to listen for real-time progress.
5. Enforcing the Inherited Guardrails Crucially, when E1 calls g2, it passes its execution context downstream. g2 enforces that Sub-Agent 2 (e2) shares E1's remaining token budget, timeout window, and rate-limit bucket. If e2 tries to go rogue or run indefinitely, it burns through the parent's shared budget and gets terminated instantly—protecting the system from runaway recursive loops or unexpected costs.