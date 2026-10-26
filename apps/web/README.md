# Inkora web

The secondary client uses Next.js 14 App Router, React, TypeScript, Supabase SSR/client integration and shared domain/data-access packages. It provides a subset of the mobile experience.

## Implemented and incomplete areas

| Area | Status |
| --- | --- |
| Authentication/onboarding | Implemented pages |
| Feed, discovery, artist/studio profiles | Implemented consumer-facing pages |
| Booking requests, bookings and messaging | Implemented consumer-facing pages |
| Notifications/rewards/preview history | Existing consumer UI; do not infer complete mobile parity |
| Marketing `/` | Minimal landing page, not a finished marketing site |
| Artist/studio management | Dashboard routes remain scaffold-only in several places; route-group collisions and middleware path assumptions require restructuring |
| Moderation | Scaffold route; not an implemented operational console |
| Generative AI | No model-backed generation; the preview surface does not turn the mock service into an inference implementation |

The `src/app/(artist)/dashboard/page.tsx`, `src/app/(studio)/dashboard/page.tsx` and moderation scaffold files still have no default page component. Removing all placeholder warnings would therefore be inaccurate. Inspect route exports and [the roadmap](../../docs/ROADMAP.md) before extending these areas.

## Development

Complete [shared setup](../../docs/SETUP.md), then create `apps/web/.env.local` from `.env.example` and set your own `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:web
```

Open `http://localhost:3000`. Configure Supabase auth redirects for your development URL. `NEXT_PUBLIC_*` values are visible to browsers; never use the service-role key there.

The CI workflow runs lint, TypeScript checks and configured tests. It does not currently run `next build`; typecheck success is not proof that unfinished route groups form a production-ready build. Resolve those routes and validate a full build before deployment.
