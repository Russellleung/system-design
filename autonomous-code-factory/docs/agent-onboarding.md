# Agent onboarding and capability contract

This is the portable entry point for a fresh Codex, Claude Code, Cursor agent or another coding agent. The factory must not depend on one vendor's conversation history, private memory or plugin catalogue.

## First five minutes

From `autonomous-code-factory/`:

1. Read `AGENTS.md`, this file and `README.md`.
2. Run `node scripts/preflight.mjs` for local planning/implementation or `node scripts/preflight.mjs --release projects/<slug>` before a release.
3. For a new MVP, run `node scripts/init-project.mjs <slug> "<name>"` and complete the generated contract.
4. For an existing MVP, read `project.json`, `PROJECT.md`, `CHECKPOINT.md`, `DECISIONS.md` and `LESSONS.md`.
5. Inspect Git status and recent commits. Preserve unrelated work.
6. Reconcile `CHECKPOINT.md` with the live provider before making external changes.
7. Re-run the project's recorded checks. Previous prose is not verification.

Use this portable opening prompt when named skills or slash commands are unavailable:

```text
Read AGENTS.md, docs/agent-onboarding.md and the five handoff files under
projects/<slug>. Run the preflight, reconcile Git and live provider state,
then continue the smallest complete demo journey. Respect project budgets and
permissions, verify the production artifact and public service, and update the
checkpoint and lessons before stopping.
```

## Required capabilities

Plugins are not required to edit or test the factory. A capable agent needs these primitives:

| Capability | Why | Minimum path |
| --- | --- | --- |
| Repository file read/write and search | Inspect contracts and make scoped edits | Agent-native filesystem tools; `rg` is recommended |
| Shell/process execution | Run deterministic scripts, builds and tests | Agent terminal with approval controls |
| Git | Reconcile state and bind evidence to commits | `git`; remote credentials only when push/PR is authorized |
| Node.js 22.13+ | Run factory scripts and the current Next.js project | Local Node or the project's Node 22 Docker build stage |
| Docker-compatible runtime for release work | Test the exact portable production artifact | Docker Desktop/Engine, Podman compatibility if proven by the project |
| Network/research access | Verify unstable technical and provider claims | Browser/search using primary documentation |
| Browser or HTTP access | Exercise the user journey and public smoke tests | Browser automation where visual behaviour matters; HTTP client for APIs |

`node scripts/preflight.mjs --release projects/<slug>` checks the locally observable portion of this contract. It cannot prove provider authorization, secrets or an agent's ability to inspect a visual UI.

## Plugins, MCP servers and CLIs

Install integrations only when the selected project/provider needs them. Every integration must have a documented CLI or manual fallback; absence of an optional plugin must not block local engineering.

| Integration | Status | When needed | Preferred route | Fallback |
| --- | --- | --- | --- | --- |
| `run-hackathon-mvp` repository skill | Recommended | Running or resuming a full factory project | Use/install `skills/run-hackathon-mvp/` if the client supports skills | Read `skills/run-hackathon-mvp/SKILL.md` directly and follow it |
| pstack / Poteto workflows | Optional | Structured investigation, TDD or verification adds value | Install the client-compatible pstack package | Apply the runbook directly; pstack is not a state store |
| GitHub integration | Conditional | Reading private repository state, opening PRs or checking CI | Official GitHub plugin/MCP or `gh` | Authenticated `git` plus the GitHub web UI |
| Render integration | Conditional | Current project deploys, logs and metrics | Official Render MCP through OAuth | Authenticated Render CLI; dashboard for the human owner |
| Google/Gemini access | Conditional | A project uses Gemini | Server-side `GEMINI_API_KEY` in the hosting provider | Labelled demo fixture; never expose a key to browser code |
| OpenAI developer integration | Conditional | A project uses OpenAI models or needs current OpenAI docs | OpenAI Developers plugin or official Docs MCP | Official developer documentation and a server-side key |
| Supabase integration | Conditional | Persistence, auth or object storage enters accepted scope | Supabase MCP/CLI with least privilege | SQL migrations and Supabase dashboard |
| Browser automation | Recommended for UI | Responsive, camera, upload or visual behaviour is accepted scope | Playwright/browser MCP/tool | Manual device check recorded in `CHECKPOINT.md` |
| Ticket/observability integration | Future/conditional | The project actually has issues, traces and an operating loop | Provider API/MCP (for example Linear plus telemetry provider) | Record work and evidence in project files |

Never install every integration pre-emptively. Each connection increases permissions, secret surface and maintenance cost.

## Client discovery

| Client | Automatically discovered repository entry point | How to start |
| --- | --- | --- |
| Codex | `AGENTS.md` | Open the factory directory; invoke `$run-hackathon-mvp` if installed, otherwise use the portable prompt |
| Claude Code | `CLAUDE.md`, which imports the shared contract | Start Claude from `autonomous-code-factory/`; confirm loaded memory if uncertain |
| Cursor | `.cursor/rules/factory.mdc`; Cursor CLI also recognizes repository instruction files | Open the factory folder/workspace and use Agent mode; use the portable prompt |
| Other agents | No discovery assumption | Explicitly attach `AGENTS.md`, this file and the target project contract |

Vendor entry files intentionally point to one shared protocol. Do not copy the complete rules into each file because duplicated rules drift.

## Credentials and external authority

The repository contains variable names and resource identifiers, never secret values. A new agent may inspect public state and run local checks, but must obtain or use explicit authorization for private providers and mutations.

Before deployment, confirm all of the following:

- the project contract permits the action and expected cost;
- the target account, service, branch and region are explicit;
- authentication works through OAuth or a least-privilege credential;
- secrets live in the provider or ignored local environment, not prompts, logs or commits;
- the exact source commit and production artifact have passed recorded checks;
- rollback/cleanup and live-resource ownership are recorded.

If private provider access is missing, stop only the provider-dependent step. Continue safe local implementation and verification, then record the exact blocked capability in `CHECKPOINT.md`.

## Handoff definition of done

A different agent should be able to resume using repository state alone. Before stopping:

- update acceptance progress and the next concrete action;
- record verification as commit + environment + command/journey + result;
- record live/billable resources and cleanup actions;
- record unresolved decisions and credential/provider blockers without secrets;
- add evidence-backed lessons and promotion candidates;
- leave the working tree understandable and preserve unrelated user changes.
