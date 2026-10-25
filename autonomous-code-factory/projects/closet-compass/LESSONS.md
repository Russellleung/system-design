# Lessons and promotion candidates

| Date | Observation and evidence | Root-cause category | What worked | Scope/confidence | Candidate artifact |
| --- | --- | --- | --- | --- | --- |
| 2026-10-25 | Host build passed, but deployment path still needed container-level proof | Process | Build the exact Dockerfile, run it and smoke-test health/homepage | High; all container web projects | Runbook/template requirement |
| 2026-10-25 | Render doubled monorepo paths when Docker paths repeated `rootDir` | Provider | Use `./Dockerfile` and `.` relative to the configured service root | Render-specific; one confirmed run | `run-hackathon-mvp/references/render.md` |
| 2026-10-25 | Dashboard URL could not be read outside the user's browser session | Tool/access | Connect official Render MCP through OAuth | High for private Render state | Provider access runbook |
| 2026-10-25 | An unqualified `git push` updated more than the intended branch | Process/safety | Set `push.default=current` and push explicit feature refs | High; Git deployment work | Run skill safety invariant |
| 2026-10-25 | A generic upstream error made a mobile vision failure impossible to diagnose after the request completed | Observability | Return an app request reference and log the provider status, code, message and request ID without logging user images or credentials | High; external API integrations | API error-handling template |
| 2026-10-25 | Local lint failed because the shell used Node 16 while the project requires Node 22 | Environment | Run verification in the production Docker toolchain when the host runtime is below `package.json#engines` | High; containerized projects | Verification runbook |
