# Current checkpoint

Updated: 2026-10-26T22:13:37+08:00

## Working now

- Mobile capture/upload, analysis, editable inventory and recommendations are implemented.
- The standard Next.js production build and the existing Vinext/Sites build pass.
- The production Docker image builds and passes `/api/health` and homepage smoke tests.
- Render deployment succeeded from `feature/closet-compass-deployment`.
- Render's official MCP server is connected to Codex through OAuth.
- Render CLI access is configured as a fallback for deployment and runtime logs.
- Vision failures now return a safe request reference and log structured provider diagnostics without logging the photo or API key.
- Vision analysis is provider-neutral: Gemini is the default and OpenAI remains a configurable fallback.
- Gemini uses `gemini-3.5-flash-lite`, structured output and server-side semantic validation.
- Rate Me has been rolled back exactly to its last pre-regression implementation from commit `433a31b`. The later per-feature numeric scores and physical-versus-controllable presentation split are intentionally absent.
- The photo-ready UI discloses Gemini free-tier data use before submission.
- A second `/photo-coach` tab provides technique-only angle, pose, framing and lighting advice.
- Photo Coach can display, hide and mirror a deterministic dotted SVG pose guide selected from validated templates.
- A new `/rate-me` tab scores visible face presentation, body presence, style, photo quality and dating appeal after explicit adult consent. It surfaces concrete first impressions, attractive and less-attractive visible features, possible positive and negative reactions from women, and explanations under every score.
- Rate Me generates three non-identifying image-search references for grooming/face presentation, outfit/body pose and setting/composition. Search providers receive only the text query after the user opens a link, not the uploaded photo.
- Rate Me also gives tentative face-shape, body-silhouette, colour and haircut direction, then produces searchable shirt/top, pants/bottoms, palette and haircut upgrades with reasons.
- Rate Me now separates camera capture from Photos/local-file selection and opens an optional client-side cropper with 4:5 or square framing, zoom and horizontal/vertical focal-position controls. The user can also keep the original.
- Rate Me now requires a feature-by-feature explanation of facial balance, eyes/brows, nose/midface, mouth/lips, jaw/chin/face shape, ears, skin appearance, hair/grooming, facial expression/tension, shoulder structure, torso/proportions, silhouette, body pose and clothing fit. Every visible feature carries a calibrated score plus an Attractive, Mixed or Unattractive badge and colloquial friend take; obscured features must be marked Not judgeable with no fake score.
- Rate Me displays separate physical-attractiveness and dating-photo-effectiveness scores with separate verdicts. Its prompt explicitly treats smiling, neutral, serious and moody expressions as potentially attractive when they work, rather than rewarding smiles by default.
- Rate Me gives a broad apparent-age range with visible presentation reasons and labels it as how old the adult looks in this photo, not their actual age.
- A new `/digital-twin` tab stores voluntary thoughts and optional photos in browser-local IndexedDB, sends only written entries and photo filenames for provisional synthesis, and exports Markdown.
- Navigation and smoke coverage include all four product tabs.
- Rollback commit `28e9bda` is deployed to the existing Render production service as deploy `dep-dbflv4u7bikc73e2lk6g`.

## In progress

- Re-test the rolled-back Rate Me with the consenting adult portrait that previously failed.

## Blocked or awaiting decisions

- Saved wardrobes, authentication and Supabase provisioning are intentionally out of scope pending a product decision.
- Cross-device Digital Twin sync remains intentionally out of scope; the current local-first store can be erased with browser data.

## Verification evidence

| Commit | Environment | Command or journey | Result |
| --- | --- | --- | --- |
| `85700a5` | Local Node | lint, portable build, Vinext build | Passed |
| `85700a5` | Local Docker | container health and homepage smoke | Passed |
| `85700a5` | Render | Blueprint deploy | Reported working by user; public URL not yet recorded |
| `7cb3e24` | Local Docker / Node 22 | production Docker build and ESLint | Passed |
| `7cb3e24` | Render | deploy `dep-dbetliu7bikc73bf37vg` | Live |
| `7cb3e24` | Render public URL | `/api/health` and `/` smoke test under Node 22 | Passed |
| `7efb85f` | Local Docker / Node 22 | Gemini production build, TypeScript and ESLint | Passed |
| `7efb85f` | Local Docker | `/api/health` and missing-Gemini-key error path | Passed |
| `7efb85f` | Render | deploy `dep-dbett47b9u1s73auliv0` | Live |
| `7efb85f` | Render public URL | `/api/health` and `/` smoke test under Node 22 | Passed |
| `e731f16` | Local Docker / Node 22 | production build, TypeScript, ESLint, `/api/health`, `/` and `/photo-coach` | Passed |
| `e731f16` | Local Docker | missing-Gemini-key Photo Coach error path | Passed with safe `503` and request reference |
| `e731f16` | Render | deploy `dep-dbf1o1navr4c73cgmumg` | Live |
| `e731f16` | Render public URL | `/api/health`, `/` and `/photo-coach` smoke test under Node 22 | Passed |
| working tree 2026-10-26 | Local Node 23 | ESLint and portable Next.js production build | Passed |
| working tree 2026-10-26 | Local Docker / Node 22 | Production image build; `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `b971708` | Render | deploy `dep-dbfas3e7bikc73cqvl8g` | Live |
| `b971708` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `b971708` | Render public API | Synthetic, non-personal `/api/digital-twin` synthesis through configured Gemini provider | Passed with validated structured response |
| `fab8789` | Local Node 23 / Docker Node 22 | ESLint, production build, image build and all five route smoke tests | Passed |
| `fab8789` | Render | deploy `dep-dbfb5aks728c73ep4ha0` | Live |
| `fab8789` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `aa78dc5` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `aa78dc5` | Render | deploy `dep-dbfb9atg1s2s73f576p0` | Live |
| `aa78dc5` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `81a8bb0` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `81a8bb0` | Render | deploy `dep-dbfeuso473hc73cu3nhg` | Live |
| `81a8bb0` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `046d65a` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `046d65a` | Render | deploy `dep-dbff194s728c73f6s4e0` | Live |
| `046d65a` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `a22db96` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `a22db96` | Render | deploy `dep-dbffa9favr4c73duh1u0` | Live |
| `a22db96` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `99a1135` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `99a1135` | Render | deploy `dep-dbffe5vb9u1s73cod3og` | Live |
| `99a1135` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `2865bbe` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `2865bbe` | Render | deploy `dep-dbffpi7b9u1s73cplapg` | Live |
| `2865bbe` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `433a31b` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `433a31b` | Render | deploy `dep-dbfg20gae00c73fv6nl0` | Live |
| `433a31b` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `17c0562` | Local Node 23 / Docker Node 22 | Project validation, ESLint, production build, image build and all five route smoke tests | Passed |
| `17c0562` | Render | deploy `dep-dbfl9v8m7kps739ho2dg` | Live |
| `17c0562` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `cde9e72` | Local Node 23 / Docker Node 22 | Release preflight, ESLint, production build, image build and all five route smoke tests | Passed |
| `cde9e72` | Render | deploy `dep-dbflih0m7kps739ijigg` | Live |
| `cde9e72` | Render public URL | `/api/health`, `/`, `/photo-coach`, `/rate-me` and `/digital-twin` smoke tests | Passed |
| `cde9e72` | Render public API | Synthetic non-person and illustrated-person `/api/rate-me` probes | Gemini accepted the reduced schema; both intentionally non-photographic inputs reached server validation but returned `502` as incomplete, so a real consenting-adult photo remains the end-to-end check |
| `1fb574f` | Local Node 23 / Docker Node 22 | Release preflight, ESLint, production build, image build and all five route smoke tests | Passed |
| `1fb574f` | Render | deploy `dep-dbflnqgu01pc73bnvo1g` | Live, then superseded |
| `1fb574f` | Render public API | Fictional illustrated-adult `/api/rate-me` probe plus privacy-safe validation log | Located the remaining mismatch: one genuine attractive feature versus an artificial minimum of two |
| `7a573c6` | Local Node 23 / Docker Node 22 | ESLint, production build, image build and all five route smoke tests | Passed |
| `7a573c6` | Render | deploy `dep-dbflpvajnfac73crp23g` | Live |
| `7a573c6` | Render public URL and API | All five route smoke tests and fictional illustrated-adult `/api/rate-me` probe | Passed; complete validated rating returned |
| `28e9bda` | Local Node 23 / Docker Node 22 | Release preflight, ESLint, production build, image build and all five route smoke tests | Passed |
| `28e9bda` | Render | deploy `dep-dbflv4u7bikc73e2lk6g` | Live |
| `28e9bda` | Render public URL and API | All five route smoke tests and fictional illustrated-adult `/api/rate-me` probe | Passed; HTTP 200 with complete rating |

## Live resources

| Provider | Resource ID | URL | Plan/cost | Cleanup action |
| --- | --- | --- | --- | --- |
| Render | `srv-dbetdd67bikc73be7o2g` | `https://closet-compass.onrender.com` | Free web service | Delete or suspend when no longer needed |

## Next action

Retry the previously failing consenting-adult portrait and confirm Rate Me returns a validated result. Then use consenting adult-owned smiling and non-smiling portraits to verify that the live model keeps physical traits separate from controllable presentation, does not turn anatomy into corrective advice, keeps physical attractiveness separate from photo effectiveness, and gives plausible feature scores and a broad apparent-age range. Also complete the outstanding phone crop, generated-search and Digital Twin persistence/export/clear checks.
