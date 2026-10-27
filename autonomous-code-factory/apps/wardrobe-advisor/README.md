# Closet Compass

Mobile-first wardrobe, photography and reflection prototype. Visitors can photograph a wardrobe, review an AI-generated visible inventory, understand the style detected in the image, and open shopping searches for complementary pieces. The `/photo-coach` tab gives technique-only advice with a deterministic dotted pose guide. `/rate-me` gives a consenting adult blunt, subjective face, body-presence, style, photo-quality and dating-appeal scores. `/visual-match` edits a consenting adult's portrait to add one fictional adult woman, with AI-directed or fixed-choice creative controls. `/digital-twin` keeps intentional daily entries and photos in browser-local IndexedDB, sends only written evidence for synthesis, and exports an editable Markdown reflection.

Live analysis defaults to Google Gemini and requires a server-side `GEMINI_API_KEY`. Without it, the upload and results experience can be tested through the clearly labelled demo path. Images are sent directly to the selected provider and are not stored by this application. The free Gemini tier may use analysis submissions to improve Google's products; the UI discloses this before use. Visual Match defaults separately to Cloudflare Workers AI with FLUX.2 Klein 4B. A free Cloudflare account receives a daily allowance and stops at its limit rather than billing overage; Gemini image editing remains an optional paid fallback.

Product boundaries: one photo is evidence rather than a complete wardrobe or person; users can correct the inventory; Photo Coach does not infer protected or sensitive traits; Rate Me requires adult consent and may judge visible appearance in that image but cannot identify the person, infer protected traits, sexualise them, prescribe dangerous bodily changes or represent universal attraction; Visual Match accepts explicit appearance selections but does not infer racial or romantic compatibility and labels its partner as fictional; Digital Twin is a provisional summary of words the user intentionally records and never infers personality from stored photos; recommendations link to shopping searches rather than claiming live stock or prices.

## Portable deployment: Render + Supabase

The application now has two independent deployment paths:

- The existing Vinext/Sites path remains available for local preview and Sites hosting.
- `Dockerfile` builds an ordinary standalone Next.js server for Render or any OCI-compatible host.

The root [`render.yaml`](../../../render.yaml) creates a free Render web service in Singapore. It deliberately marks secrets `sync: false`, so Render asks for them rather than reading them from the repository. The free service may sleep; change `plan` only after explicitly accepting the ongoing cost.

Supabase is prepared under `supabase/`, but the current product does not need a database and does not store uploaded photographs or results. This avoids provisioning a resource before a persistence requirement exists. When saved wardrobes become part of the product, link a Supabase project, add a migration with row-level security, and connect it through the variables in `.env.example`.

### Local portable build

```sh
npm ci
PORTABLE_DOCKER_BUILD=1 npm run build:portable
docker build -t closet-compass .
docker run --rm -p 10000:10000 \
  -e VISION_PROVIDER=gemini \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  -e VISUAL_MATCH_PROVIDER=cloudflare \
  -e CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  closet-compass
APP_URL=http://127.0.0.1:10000 npm run smoke
```

The demo path works without a provider key. Live photo analysis defaults to `VISION_PROVIDER=gemini` and requires `GEMINI_API_KEY`; keep it server-side. Set `VISION_PROVIDER=openai` to use the retained `OPENAI_API_KEY` fallback. Visual Match defaults to `VISUAL_MATCH_PROVIDER=cloudflare` and requires `CLOUDFLARE_ACCOUNT_ID` plus a narrowly scoped `CLOUDFLARE_API_TOKEN`; its browser path resizes references below 512×512 before upload. Set `VISUAL_MATCH_PROVIDER=gemini` and `GEMINI_IMAGE_MODEL` only to opt into paid Gemini image editing. The Supabase service-role key is reserved for migrations or trusted server jobs and must never be exposed through a `NEXT_PUBLIC_` variable.

### First deployment

1. Push the repository to a Git provider supported by Render.
2. In Render, create a Blueprint from the repository's root `render.yaml`.
3. Enter `GEMINI_API_KEY`. Leave the optional OpenAI and Supabase variables blank for the current MVP.
4. Wait for `/api/health` to become healthy.
5. Run `APP_URL=https://<render-hostname> npm run smoke` locally.
6. Confirm the camera/upload journey on a real phone and verify that demo mode remains clearly labelled when live analysis is unavailable.

Before making the service paid or creating another database, review [`factory.project.yaml`](./factory.project.yaml). It sets a USD 7 target, USD 10 hard monthly platform limit, 48-hour preview lifetime, and approval gates for paid plans, extra database projects and GPUs. The file records policy for the future factory runner; provider-side budget alerts are still required because YAML alone cannot enforce spending.

## Vinext starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run build:portable`: build the standalone Next.js artifact used by Docker/Render
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run smoke`: check the deployed health endpoint, homepage, Photo Coach, Rate Me, Visual Match and Digital Twin pages (`APP_URL` defaults to `http://127.0.0.1:10000`)
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
