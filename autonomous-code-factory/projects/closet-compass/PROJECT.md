# Closet Compass

## Problem and target user

People accumulate clothes without a clear view of their existing style or which additions would create useful outfits. A phone-first visitor needs a quick, low-effort assessment grounded in what is visibly present.

## Demo journey

A visitor opens Closet Compass on a phone, photographs or selects a wardrobe image, receives a visible-item inventory and style summary, corrects the inventory, and opens shopping searches for three complementary pieces.

## Acceptance criteria

- [x] Capture or select an image from a phone.
- [x] Reject non-images and files above 10 MB.
- [x] Produce grounded structured analysis through a server-side vision call.
- [x] Provide an honest labelled demo path when live analysis is unavailable.
- [x] Let the visitor edit the visible garment inventory.
- [x] Open shopping searches for exactly three wardrobe gaps.
- [x] Build and run as a portable production container.
- [x] Pass local health and homepage smoke tests.
- [ ] Record and smoke-test the final public Render URL.

## Boundaries

One photo is not treated as the complete wardrobe. The system does not infer gender, age, body shape, income, ethnicity, religion, health or identity. Images and analysis results are not persisted. Shopping links are searches, not claims of live stock or price. Supabase remains unprovisioned until saved wardrobes are accepted scope.

## Current stack

Next.js/TypeScript provides the mobile UI and server endpoint in one deployable service. The app builds into an OCI-compatible Docker image and currently runs on Render's free web-service plan in Singapore. OpenAI provides multimodal analysis. Supabase configuration exists only as a future migration path.
