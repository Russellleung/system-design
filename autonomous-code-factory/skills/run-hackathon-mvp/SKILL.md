---
name: run-hackathon-mvp
description: Run or resume a time-bounded MVP from product brief through verified deployment, preserving project state and promoting evidence-backed improvements. Use for projects inside the Autonomous MVP Factory; do not use for ordinary isolated code edits.
---

# Run a hackathon MVP

Read the factory `README.md`, `AGENTS.md` and the target project's five handoff files. If the project is new, initialize it with `node scripts/init-project.mjs`; do not improvise a different state format.

Optimize for the smallest compelling end-to-end demo journey. Turn product statements into observable acceptance criteria before implementation. Research only decisions that materially affect that journey, and record dated evidence for unstable claims.

Maintain a truthful `CHECKPOINT.md`. Reconcile it with Git and live provider state when resuming. Treat previous completion claims as hypotheses until their recorded checks pass.

Prefer portable application code and deterministic scripts for repeatable operations. Deploy early enough to expose provider integration failures, but respect the contract's budgets and external-action permissions. A permission to build does not imply authority to create paid resources, modify secrets or publish production changes.

Verify the production build, health endpoint, primary user journey and one important failure path. After deployment, test the public URL and bind evidence to the deployed commit.

Before finishing, update checkpoint, decisions, resources and lessons. Classify reusable outcomes using `docs/learning-loop.md`; promote only validated improvements.

## Provider guidance

When the selected application provider is Render, read [references/render.md](references/render.md) before configuring or debugging deployment. Do not load that reference for other providers.
