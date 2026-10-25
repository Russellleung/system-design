# Autonomous MVP Factory agent instructions

These instructions apply to this directory and every project beneath it.

## Start or resume correctly

1. Read `README.md` and the relevant project files before changing code.
2. For a new MVP, run `node scripts/init-project.mjs <slug> "<name>"` and complete the generated contract before implementation.
3. For an existing MVP, read `project.json`, `PROJECT.md`, `CHECKPOINT.md`, `DECISIONS.md`, and `LESSONS.md`; then reconcile them with Git status and live provider state.
4. Do not treat a previous agent's completion claim as evidence. Re-run the checks named in the project contract.
5. Update `CHECKPOINT.md` after a material milestone and before ending a turn that leaves work unfinished.

## Operating constraints

- Optimize for one demonstrable user journey, not feature count.
- Keep provider-neutral application code in a portable container where practical.
- Never commit credentials. Prefer OAuth for interactive provider access and scoped secrets for automation.
- Stay within `project.json` budgets and permissions. A recorded budget is not technical enforcement; configure provider controls too.
- Do not create paid resources, replace secrets, publish externally, or delete infrastructure without authority for that action.
- Bind verification evidence to the source commit and deployed release. Test the public service after deployment.
- Record unexpected provider behaviour as evidence in `LESSONS.md`; do not immediately turn one incident into a universal rule.

## Finish the learning loop

Classify reusable outcomes using `docs/learning-loop.md`:

- deterministic repeated operation -> script;
- stable project structure -> template;
- non-obvious contextual judgment -> skill;
- explicit user choice -> preference in the project contract.

Promote a lesson only with evidence and a validation method. Project-specific IDs, secrets, transcripts and temporary workarounds must not enter reusable assets.
