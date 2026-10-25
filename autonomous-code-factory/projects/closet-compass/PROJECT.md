# Closet Compass

## Problem and target user

People accumulate clothes without a clear view of their existing style or which additions would create useful outfits. They may also want practical help taking a stronger photograph without having their appearance judged. A phone-first visitor needs quick, low-effort guidance grounded in what is visibly present.

## Demo journey

A visitor chooses one of two tabs. Wardrobe analysis inventories visible clothing and suggests three complementary pieces. Photo Coach reviews a portrait's camera angle, pose, framing and light, then offers an optional dotted guide for a retake.

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
- [x] Build and run as a portable production container.
- [x] Pass local health, homepage and Photo Coach smoke tests.
- [ ] Record and smoke-test the final public Render URL.

## Boundaries

One photo is not treated as the complete wardrobe. The system does not infer gender, age, body shape, attractiveness, weight, income, ethnicity, religion, health or identity. Photo Coach changes advice about the camera and composition, not the person. Images and analysis results are not persisted. Shopping links are searches, not claims of live stock or price. Supabase remains unprovisioned until saved wardrobes are accepted scope.

## Current stack

Next.js/TypeScript provides the mobile UI and server endpoint in one deployable service. The app builds into an OCI-compatible Docker image and currently runs on Render's free web-service plan in Singapore. Gemini provides multimodal analysis by default through a provider adapter, with OpenAI retained as a fallback. Supabase configuration exists only as a future migration path.
