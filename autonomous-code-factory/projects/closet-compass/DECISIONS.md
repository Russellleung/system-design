# Decisions

Record decisions that constrain later work.

| Date | Decision | Reason and evidence | Revisit when |
| --- | --- | --- | --- |
| 2026-10-25 | Use Render free web service and a portable Docker image | Fast managed deployment with a tested migration path to another OCI host | Cold starts harm the demo or usage justifies a paid plan |
| 2026-10-25 | Do not provision Supabase yet | The accepted journey is stateless; premature persistence adds cost and privacy surface | Saved wardrobes or accounts enter accepted scope |
| 2026-10-25 | Keep a labelled demo path | The UI remains testable without misrepresenting fabricated results as photo analysis | A reliable test fixture replaces it |
| 2026-10-25 | Connect Render MCP using OAuth | Private dashboard logs are otherwise unavailable to the coding agent | Automation requires a non-interactive credential |
