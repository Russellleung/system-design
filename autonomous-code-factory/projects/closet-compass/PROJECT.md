# Closet Compass

## Problem and target user

People accumulate clothes without a clear view of their existing style or which additions would create useful outfits. They may also want practical help taking a stronger photograph, understanding whether a photo communicates well on a dating profile, or reflecting on moments they intentionally record. A phone-first visitor needs useful guidance without opaque judgments or unnecessary storage of personal data.

## Demo journey

A visitor chooses one of four tabs. Wardrobe analysis inventories visible clothing and suggests three complementary pieces. Photo Coach reviews camera technique and offers an optional dotted retake guide. Rate Me scores dating-profile photo effectiveness without judging physical attractiveness. Digital Twin saves voluntary daily entries locally and exports a provisional Markdown self-reflection.

## Acceptance criteria

- [x] Capture or select an image from a phone.
- [x] Reject non-images and files above 10 MB.
- [x] Produce grounded structured analysis through a server-side vision call.
- [x] Provide an honest labelled demo path when live analysis is unavailable.
- [x] Let the visitor edit the visible garment inventory.
- [x] Open shopping searches for exactly three wardrobe gaps.
- [x] Coach a portrait using angle, pose, framing and lighting suggestions.
- [x] Display, hide and mirror a deterministic dotted pose guide.
- [x] Restrict Photo Coach to photographic technique rather than appearance or sensitive-trait judgments.
- [x] Score dating-profile photo effectiveness from 1–10 after explicit 18+ confirmation.
- [x] Base Rate Me on observable photographic factors rather than physical attractiveness or demographic preferences.
- [x] Persist Digital Twin entries and optional photos in browser-local IndexedDB.
- [x] Send only user-authored text, timestamps and photo filenames for reflection synthesis—not stored photo files.
- [x] Export the provisional Digital Twin reflection and source text as Markdown.
- [x] Build and run as a portable production container.
- [x] Pass local health and all product-page smoke tests.
- [x] Record and smoke-test the final public Render URL.

## Boundaries

One photo is not treated as the complete wardrobe. The system does not infer gender, age, body shape, attractiveness, weight, income, ethnicity, religion, health or identity. Photo Coach changes advice about the camera and composition, not the person. Rate Me evaluates the photograph, requires an 18+ confirmation and does not promise matches. Digital Twin stores voluntary entries and photos only in the user's browser; synthesis is provisional and based on authored words rather than appearance. Wardrobe and rating uploads are not persisted by the application. Shopping links are searches, not claims of live stock or price. Supabase remains unprovisioned until cross-device persistence or accounts are accepted scope.

## Current stack

Next.js/TypeScript provides the mobile UI and server endpoint in one deployable service. The app builds into an OCI-compatible Docker image and currently runs on Render's free web-service plan in Singapore. Gemini provides multimodal analysis by default through a provider adapter, with OpenAI retained as a fallback. Supabase configuration exists only as a future migration path.
