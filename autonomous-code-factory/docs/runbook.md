# MVP runbook

Run `node scripts/preflight.mjs` before local work and `node scripts/preflight.mjs --release projects/<slug>` before release work. See `agent-onboarding.md` for the cross-agent capability and integration contract.

## New project

1. Run `node scripts/init-project.mjs <slug> "<name>"`.
2. Fill in the target user, problem, demo journey and observable acceptance criteria.
3. Set deadline, cloud/model budgets, allowed providers and external-action permissions.
4. Validate the contract with `node scripts/validate-project.mjs projects/<slug>`.
5. Research only decisions that block the demo journey. Record source, date, claim and uncertainty.
6. Deploy a thin end-to-end slice early, then iterate by acceptance value.

## Resume project

1. Read the five project handoff files.
2. Inspect Git status, current branch and recent commits without overwriting unrelated work.
3. Query the provider through its MCP/API/CLI and compare live state with `CHECKPOINT.md`.
4. Re-run the recorded local checks before trusting earlier results.
5. Continue the highest-value unblocked task and update the checkpoint.

## Using pstack

Use the installed pstack workflows for investigation, architecture review, TDD and project-specific verification when they improve the current task. `$poteto-mode` can guide a full implementation pass; `$create-verification-skill` and `$maintain-verification-skill` can capture UI verification once the app works.

Pstack is an engineering workflow, not the factory's state store, scheduler, budget enforcer or deployment provider. The project contract and observed evidence remain authoritative. Reinvoke a pstack skill when needed rather than assuming a mode persists across new agent threads.

## Verification and release

Verification must observe behaviour, not only compilation:

- lint/typecheck and relevant automated tests;
- container or production build;
- health endpoint;
- real local user journey;
- deployed smoke test against the public URL;
- one important failure path;
- database side effects when persistence exists.

Record the commit SHA, environment, command and outcome. Never fix a failing check by weakening its assertion unless the underlying requirement changed explicitly.

## Render path

Read the skill's `references/render.md` before a Render deployment. Prefer the official Render MCP OAuth connection for deploy status, logs and metrics. A browser dashboard link alone is not accessible to a coding agent.

## Stop conditions

Stop and request direction when a required decision materially changes the product, new authority is needed, a budget would be exceeded, or a destructive provider operation is proposed. A deadline or request to finish does not expand deployment permissions.

At the end of every run, list live/billable resources, update the checkpoint and complete the learning review.
