# Closet Compass

## Problem and target user

People accumulate clothes without a clear view of their existing style or which additions would create useful outfits. They may also want practical help taking a stronger photograph, understanding whether a photo communicates well on a dating profile, visualising a fictional partner beside them, or reflecting on moments they intentionally record. A phone-first visitor needs useful guidance without opaque judgments or unnecessary storage of personal data.

## Demo journey

A visitor chooses one of five tabs. Wardrobe analysis inventories visible clothing and suggests three complementary pieces. Photo Coach reviews camera technique and offers an optional dotted retake guide. Rate Me gives a consenting adult a deliberately blunt, subjective review of visible face, body presentation, style and dating-profile appeal. Visual Match adds one fictional adult woman to a consenting adult's portrait using either AI direction or fixed-choice controls. Digital Twin saves voluntary daily entries locally and exports a provisional Markdown self-reflection.

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
- [x] Score visible face, body presence, style, photo quality and dating appeal from 1–10 after explicit adult consent.
- [x] Show separate physical-attractiveness and dating-photo-effectiveness scores so poor photography does not silently become a judgment of the person.
- [x] Give a broad apparent-age range with visible reasons, never an exact or claimed real age.
- [x] Judge whether an expression works without treating smiling or showing teeth as inherently more attractive.
- [x] Let Rate Me users take a photo or choose one from Photos/local files, then crop it to portrait or square with adjustable zoom and focal position.
- [x] Make Rate Me candid and colloquial about both genuine strengths and weaknesses without protected-trait inference, sexualisation, humiliation or claims about universal preferences.
- [x] Explain concrete first impressions such as hair, smile, clothing, posture, lighting and visible skin presentation instead of returning only scores or generic praise.
- [x] Require feature-by-feature observations for facial balance, eyes/brows, nose, mouth/lips, jaw/face shape, ears, skin, hair, facial expression, shoulder structure, proportions, silhouette, body pose and clothing fit.
- [x] Give every visible face/body feature an explicit attractive, mixed or unattractive verdict followed by a plainspoken, opinionated friend take rather than clinical filler.
- [x] Give every visible face/body feature its own calibrated 1–10 attraction score; use N/A instead of inventing a score when it cannot be judged.
- [x] Split physical traits from controllable presentation so anatomy and skin are not framed as instant fixes, while expression, haircut, grooming, posture, pose and clothing receive actionable retake advice.
- [x] Add a separate Visual Match tab with camera/library upload, client-side cropping and explicit adult consent.
- [x] Let the user either delegate all partner/scene choices or tune height, build, appearance, adult age, style, energy, pose and setting through fixed selections.
- [x] Label the generated woman as fictional and avoid claims that visual composition predicts romantic, racial or psychological compatibility.
- [x] Use Cloudflare FLUX.2 Klein 4B and its hard-stopping free daily allocation by default; keep paid Gemini image generation as an explicit fallback only.
- [x] Explain visible attractive and less-attractive features plus possible positive and negative reactions from adult women without claiming universal preferences.
- [x] Generate three non-identifying reference-image searches for grooming, styling/pose and setting; send only search text when the user opens a provider link.
- [x] Give tentative face-shape, body-silhouette, colour and haircut direction plus searchable shirt, pants, palette and haircut upgrades.
- [x] Persist Digital Twin entries and optional photos in browser-local IndexedDB.
- [x] Send only user-authored text, timestamps and photo filenames for reflection synthesis—not stored photo files.
- [x] Export the provisional Digital Twin reflection and source text as Markdown.
- [x] Build and run as a portable production container.
- [x] Pass local health and all five product-page smoke tests.
- [x] Record and smoke-test the final public Render URL.

## Boundaries

One photo is not treated as the complete wardrobe or a complete account of a person. Photo Coach does not infer attractiveness or sensitive traits. Rate Me may directly judge a consenting adult's visible face, body presentation, physical attractiveness, style and dating appeal in that image, and may estimate only a broad apparent-age band; it does not claim the person's real or exact age, infer protected traits, exact weight, health or identity, sexualise the person, recommend dangerous bodily changes, promise matches, or claim all women share a preference. Reference searches use generic visible descriptors and never upload the user's photo to a search provider or attempt identity/lookalike matching. Digital Twin stores voluntary entries and photos only in the user's browser; synthesis is provisional and based on authored words rather than appearance. Wardrobe and rating uploads are not persisted by the application. Shopping links are searches, not claims of live stock or price. Supabase remains unprovisioned until cross-device persistence or accounts are accepted scope.

## Current stack

Next.js/TypeScript provides the mobile UI and server endpoint in one deployable service. The app builds into an OCI-compatible Docker image and currently runs on Render's free web-service plan in Singapore. Gemini provides multimodal analysis by default through a provider adapter, with OpenAI retained as a fallback. Supabase configuration exists only as a future migration path.
