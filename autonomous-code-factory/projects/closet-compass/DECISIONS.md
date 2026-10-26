# Decisions

Record decisions that constrain later work.

| Date | Decision | Reason and evidence | Revisit when |
| --- | --- | --- | --- |
| 2026-10-25 | Use Render free web service and a portable Docker image | Fast managed deployment with a tested migration path to another OCI host | Cold starts harm the demo or usage justifies a paid plan |
| 2026-10-25 | Do not provision Supabase yet | The accepted journey is stateless; premature persistence adds cost and privacy surface | Saved wardrobes or accounts enter accepted scope |
| 2026-10-25 | Keep a labelled demo path | The UI remains testable without misrepresenting fabricated results as photo analysis | A reliable test fixture replaces it |
| 2026-10-25 | Connect Render MCP using OAuth | Private dashboard logs are otherwise unavailable to the coding agent | Automation requires a non-interactive credential |
| 2026-10-25 | Default vision analysis to Gemini behind a provider adapter | The OpenAI key had no remaining API credits; Gemini Flash-Lite has a continuing limited free tier and the user accepted its disclosed data-use trade-off | Free-tier limits, privacy requirements or analysis quality become unacceptable |
| 2026-10-25 | Use Gemini to select a fixed pose template and render the guide as local SVG | A deterministic overlay is fast, inspectable and does not synthesize or alter the photographed person | User research shows that fixed templates are too limiting |
| 2026-10-25 | Limit Photo Coach to camera, pose, framing and lighting technique | The product should help users improve a retake without scoring appearance or inferring sensitive traits | Never for appearance scoring; revisit only to tighten safeguards |
| 2026-10-26 | Interpret Rate Me as dating-photo effectiveness, not human attractiveness | Public app guidance supports evaluating clarity, face visibility, authenticity and profile usefulness; an attractiveness score would be subjective, harmful and misleading | Revisit the rubric when real opt-in outcome data is available, never to score human worth |
| 2026-10-26 | Keep Digital Twin local-first and synthesize only authored text | Photos and intimate journal entries create a large privacy surface; IndexedDB supports the single-device MVP without provisioning identity or a database | Cross-device sync becomes an explicit accepted requirement with authentication, deletion and retention controls |
| 2026-10-26 | Replace Rate Me's photo-only rubric with an explicitly subjective adult appearance review | The user rejected the safer interpretation and explicitly requested candid face and body ratings; the feature now requires adult consent and separates bluntness from humiliation or sensitive-trait inference | Revisit after observing whether users find the scores useful rather than harmful |
