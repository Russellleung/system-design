# Autonomous MVP Factory

A reusable workflow for turning a hackathon brief into a deployed, verified MVP and improving the workflow from evidence after each run.

The factory is currently interactive: Codex, Claude Code, Cursor or another capable coding agent runs the shared workflow; project files preserve state; deterministic scripts enforce repeatable mechanics; and optional provider integrations expose live deployment evidence. It is not yet an unattended scheduler or self-healing production platform.

## Start here

Any fresh Codex, Claude Code or Cursor agent should begin with [`docs/agent-onboarding.md`](./docs/agent-onboarding.md). Vendor entry files (`AGENTS.md`, `CLAUDE.md` and `.cursor/rules/factory.mdc`) all point to the same protocol, tool matrix and handoff format.

Run a capability check before starting:

```sh
node scripts/preflight.mjs
# Before deployment/release:
node scripts/preflight.mjs --release projects/<slug>
```

### New project

```sh
cd autonomous-code-factory
node scripts/init-project.mjs my-project "My Project"
```

Complete the generated `projects/my-project/PROJECT.md` and `project.json`, then validate them:

```sh
node scripts/validate-project.mjs projects/my-project
```

In a client that supports repository skills, start with:

```text
$run-hackathon-mvp Read projects/my-project and build the smallest complete
demo journey. Preserve checkpoints, verify the production artifact, and do not
exceed the recorded budgets or external-action permissions.
```

The skill source is versioned in this repository. If `$run-hackathon-mvp` is not present in a fresh agent's skill catalogue, tell it to read `skills/run-hackathon-mvp/SKILL.md` directly or install/import that folder using the client's supported skill mechanism, then start a new thread if the client requires discovery at startup. The scoped repository instructions remain effective even when the named skill is not installed globally.

### Resume a project

Ask the agent to use `$run-hackathon-mvp` and name the project directory. The agent must read the handoff files, reconcile them with Git and provider state, and rerun recorded verification before continuing.

## Documentation map

| File | Purpose |
| --- | --- |
| [`AGENTS.md`](./AGENTS.md) | Mandatory protocol for every agent entering this directory |
| [`docs/architecture.md`](./docs/architecture.md) | System boundary, durable state and evolution path |
| [`docs/agent-onboarding.md`](./docs/agent-onboarding.md) | Cross-agent startup, tools, plugins, credentials and handoff contract |
| [`docs/runbook.md`](./docs/runbook.md) | New, resume, verification, deployment and stopping procedures |
| [`docs/learning-loop.md`](./docs/learning-loop.md) | Turn evidence into reviewed scripts, templates, skills or preferences |
| [`skills/run-hackathon-mvp/SKILL.md`](./skills/run-hackathon-mvp/SKILL.md) | Reusable judgment for executing a factory run |
| [`templates/project/`](./templates/project/) | Standard handoff contract for every MVP |

## Project contract

Every project has five files:

- `project.json`: machine-readable budget, provider, permission and verification contract.
- `PROJECT.md`: user problem, demo journey, acceptance criteria and boundaries.
- `CHECKPOINT.md`: working state, evidence, live resources and next action.
- `DECISIONS.md`: choices that constrain later implementation.
- `LESSONS.md`: evidence and candidates for reusable improvements.

These files, Git and live provider state are authoritative. Chat history alone is not a resumable checkpoint.

## Reuse model

Use the smallest artifact that solves the demonstrated problem:

- **Script:** deterministic operation with stable inputs and outputs.
- **Template:** stable files or infrastructure shape copied into new projects.
- **Skill:** non-obvious contextual judgment an agent should apply.
- **Preference:** an explicit user choice with a defined scope.

One incident remains a project lesson until it is reproduced or has a safety reason for immediate promotion. Every promoted artifact needs a validation method and must exclude secrets, personal data and project-specific identifiers.

## First project: Closet Compass

[Closet Compass](./apps/wardrobe-advisor/README.md) is the first completed vertical slice:

1. Take or select a wardrobe photo on a phone.
2. Send it to a server-side vision endpoint.
3. Review visible clothing inventory.
4. Explain the visible style and three wardrobe gaps.
5. Open Australian shopping searches for complementary pieces.

It has a portable Docker image, Render Blueprint, health endpoint, deployment smoke test, cost policy and optional Supabase migration structure. It does not persist photos or analysis results. Live analysis defaults to Gemini behind a provider adapter and needs a server-side `GEMINI_API_KEY`; OpenAI remains an optional fallback and a clearly labelled demo path works without either key.

The successful run established the first reusable lessons: test the exact container, include health and public smoke checks, delay database provisioning until required, connect provider MCP through OAuth, and push deployment work through an explicit feature branch.

## Current status

Implemented:

- project initializer and contract validator;
- cross-agent entry points for Codex, Claude Code and Cursor plus a capability preflight;
- resumable handoff templates;
- factory run skill with conditional Render guidance;
- Closet Compass local and Render deployment packaging;
- Render MCP OAuth access for deploy/log debugging.

Not implemented:

- unattended scheduler and operation ledger;
- automatic preview expiry enforcement;
- centralized telemetry-to-ticket loop;
- automated evaluation and promotion of learning candidates;
- multi-worker isolation and integration queue.

Those capabilities should be added only when repeated runs demonstrate their value.
