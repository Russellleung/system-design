# Evidence-based learning loop

The factory should improve between hackathons without allowing one noisy run to rewrite its operating rules.

## Capture

At the end of a run, record in `LESSONS.md`:

- the observed event or failure;
- supporting logs, commands, diffs or user correction;
- root-cause category: requirement, assumption, tool, code, provider or process;
- the intervention that worked;
- scope and confidence;
- a proposed reusable artifact, if any.

Do not copy secrets, personal data, proprietary source material or raw transcripts into reusable assets.

## Classify

| Outcome | Promote to | Test |
| --- | --- | --- |
| Repeatable operation with exact inputs/outputs | Script | Execute against success and failure fixtures |
| Stable directory or configuration shape | Template | Generate a fresh project and validate it |
| Non-obvious judgment that varies by context | Skill | Apply to a realistic new request and inspect behaviour |
| Explicit user preference | Project/user preference | Confirm scope and preserve exact wording |
| One-off provider quirk | Project lesson first | Reproduce or observe again before wider promotion |

Prefer a script over prose when determinism matters. Prefer a skill when the agent must weigh product context. Do not encode generic engineering knowledge that Codex already knows.

## Promote

A candidate is promoted only when:

1. it is supported by evidence rather than hindsight alone;
2. its intended scope and exclusions are clear;
3. a regression or behavioural validation passes;
4. it contains no project-specific credentials or identifiers;
5. it improves completion, correctness, cost or human effort on another representative task.

Version reusable artifacts in Git. The active run keeps its pinned version; new versions normally apply to the next run. Retain rollback when changing scripts, templates or skills.

## Lessons from Closet Compass

- Build and smoke-test the exact production container before provider deployment.
- Add a health endpoint and a public-URL smoke test to every web template.
- Do not provision a database before the accepted journey requires persistence.
- Provider path semantics must be verified from an actual deploy, not documentation interpretation alone. With the current Render Blueprint, Docker paths are relative to the configured `rootDir`.
- Connect the official provider MCP through OAuth before expecting an agent to inspect private logs.
- Push deployment work to a feature branch and configure Git to push only the current branch. Review the explicit ref before every external push.

The first three are strong template/script candidates. The Render path observation belongs in a provider-specific reference. The Git incident is a safety invariant for the run skill.
