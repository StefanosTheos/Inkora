# Inkora development setup

Run workspace commands from the repository root. This guide describes the committed configuration; a complete fresh-database/native/production-build verification is still tracked in [the roadmap](ROADMAP.md).

## 1. Toolchain

- Node.js 20+ and pnpm **9.12.0**, matching `package.json` and CI. If Corepack is available, use `corepack enable` and `corepack prepare pnpm@9.12.0 --activate`; otherwise install that pnpm version using its official installation instructions.
- Docker running and the [Supabase CLI](https://supabase.com/docs/guides/local-development) available for the local stack. The CLI is not a workspace dependency.
- Android Studio/SDK/JDK and an emulator or USB device for Android. iOS native builds need macOS and Xcode.

```bash
pnpm install --frozen-lockfile
```

Keep `pnpm-lock.yaml`; do not regenerate it merely to run the project.

## 2. Local Supabase

The committed `supabase/config.toml` enables the API, PostgreSQL 15, realtime, storage, local Studio, email/password sign-up and a custom access-token hook.

```bash
supabase start
supabase status
```

For a **disposable local database**, apply the full migration history and seed:

```bash
pnpm db:reset
```

This invokes `supabase db reset`, destroys local database data, applies `supabase/migrations/` in order and loads `supabase/seed.sql`. Do not run it against data you need to retain. The committed migrations themselves also include demo accounts/data: this history must be separated/reviewed before applying it to production. `pnpm db:push` targets a linked remote project and is not the local-start command.

The initial extensions migration requests PostGIS, pgcrypto, citext, pg_trgm and btree_gist; later migrations also use pg_cron. If a fresh reset fails, retain its exact migration error and resolve that prerequisite/schema problem before declaring bootstrap successful. Existing CI does not run these migrations.

Typical configured local addresses are API `http://127.0.0.1:54321`, database port `54322`, and Studio `http://127.0.0.1:54323`. Get the actual public anon key and server-only service-role key from your local CLI status; do not publish status output containing server credentials.

The local seed includes demonstration identities such as `maya@inkora.dev` (seeker), `aria@inkora.dev` / `leo@inkora.dev` (artists) and `theo@inkora.dev` (studio owner), with the explicit demo password in `supabase/seed.sql`. These are development fixtures, not production accounts. Prefer newly created controlled accounts for screenshots.

## 3. Environment files belong to each application

The root `.env.example` is a variable reference, not a promise that both frameworks automatically load a root `.env`. Create these files:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/web/.env.example apps/web/.env.local
```

PowerShell equivalents:

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env.local
Copy-Item apps/web/.env.example apps/web/.env.local
```

Do not overwrite an existing configured file. Fill in your local values:

| Application | Variables | Local URL |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Usually `http://127.0.0.1:54321` |
| Android emulator | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Usually `http://10.0.2.2:54321` |
| USB Android phone | Same mobile variables | With `adb reverse tcp:54321 tcp:54321`, use `http://127.0.0.1:54321` on the device |
| LAN mobile device | Same mobile variables | A reachable development-computer address, with local port access configured |

The anon key is public client configuration; RLS and storage policies must enforce access. Never substitute a service-role key in an `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variable. Client values are bundled into the application.

Keep Apple sign-in flags false until its provider, credentials and redirect behavior are configured. Mobile image transforms are optional; leave `EXPO_PUBLIC_IMAGE_TRANSFORM=false` unless your Supabase deployment supports them. Production analytics is not wired merely by supplying a PostHog key; mobile currently uses the console adapter.

Restart the development server after changing environment values. Rebuild a native binary when its compiled configuration or native dependencies change.

## 4. Auth roles, storage and service integrations

The migration history defines RLS, the role/permission model and `custom_access_token_hook`. For a hosted Supabase project, configure the custom access-token hook to use that database function; a local `config.toml` entry does not configure the hosted dashboard for you. Review schema/function grants and renew sessions after changing JWT role behavior.

Configure allowed auth callback URLs for the actual clients: the web callback route is `/api/auth/callback`, and mobile uses `inkora://auth/callback`. The local config currently allows `http://localhost:3000`; add the exact callback/redirect URLs your flow requires and restart the local stack if its configuration changes. Apple and email-link flows require their own provider setup.

Storage bucket/policy migrations create the application buckets. SQL setup does not upload the ten style-image files staged under `supabase/storage/styles/`. Follow [asset locations](ASSETS.md) and [the storage guide](../supabase/storage/README.md). For example, in a shell with server credentials set **for your own local development project**:

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_SERVICE_ROLE_KEY="your_local_service_role_key"
node supabase/storage/upload.mjs styles
```

```powershell
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY = 'your_local_service_role_key'
node supabase/storage/upload.mjs styles
```

The uploader reads process environment variables directly; it does not load root `.env` automatically. Use the actual server key only in your private terminal/session, never in client files or committed shell scripts. Confirm redistribution rights before using the supplied tattoo imagery in a public demo. Missing style images have an application fallback; do not misdiagnose them as missing database migrations.

Hosted push is additional infrastructure: the `notify-dispatch` Edge Function reads `FCM_SERVICE_ACCOUNT` and needs the relevant database webhook/service setup; an old `FCM_SERVER_KEY` variable alone does not configure it. Mobile Firebase platform files are ignored and must belong to your own app. Email dispatch uses separate service credentials, including `RESEND_API_KEY` where that function is deployed. Do not claim push/email works merely because a notification table or UI exists.

## 5. Database types and application startup

With local Supabase running and migrations applied:

```bash
pnpm gen:types
```

This writes `packages/data-access/src/db/database.types.ts`. It requires the **local** database, not an arbitrary linked hosted project, and can produce a diff. Review generated changes against migrations and keep the build-required types tracked.

For Android:

```bash
pnpm --filter @inkora/mobile android
```

This runs `expo run:android`, creates/builds the native project and starts the app. Generated `android/` and `ios/` directories are intentionally ignored in this Expo repository. On macOS, use `pnpm --filter @inkora/mobile ios` for the iOS build.

MMKV and Skia need a compatible native binary; a standard Expo Go installation is insufficient. Once a compatible binary is installed, `pnpm dev:mobile` starts Metro for it. Do not present `developmentClient: true` in EAS configuration as proof the matching development-client dependency is installed: inspect and configure that build path if choosing EAS rather than the local native command above.

For web, in another terminal:

```bash
pnpm dev:web
```

Open `http://localhost:3000`. Web business-dashboard/moderation routes remain incomplete. The current typecheck/CI does not establish a successful production Next.js build; resolve the documented route scaffolds/collisions before deploying.

## 6. EAS and hosted deployment

`apps/mobile/app.config.ts` contains the author's Expo owner/project ID, application IDs and link host. `apps/mobile/eas.json` contains public Supabase URL/anon values for that environment. They are not server secrets, but they are **not your independent deployment**. Replace/reconfigure ownership, identifiers and public environment values before building your own application. Native app registration and Firebase credentials must agree with those identifiers.

Review actual EAS environment/profile precedence and supply only client-safe values to the mobile bundle. Keep service-role and push-service credentials in their appropriate server secret stores. Configure a compatible development-client build explicitly if using that profile.

For a hosted web build, configure the app's root/build settings and client-safe environment values on the hosting service. Deployment/editor caches are ignored; lockfiles, migrations and required generated source remain versioned. No completed Vercel/EAS production deployment is claimed by this guide.

## 7. Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

These match the existing CI workflow. They do not test native compilation, a full Next.js production build, fresh database/bootstrap, RLS correctness or end-to-end user journeys. See [the roadmap](ROADMAP.md) and [third-party notices](../THIRD_PARTY_NOTICES.md) for remaining release work.
