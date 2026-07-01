# web/src/app/api — Route Handlers (BFF)

Web-only server endpoints:
- `auth/callback/route.ts` — OAuth/magic-link code exchange (cookie session)
- `webhooks/fcm/route.ts` — FCM delivery receipts → prune dead device_tokens
- `og/route.ts` — dynamic OpenGraph images for profiles (SEO)

Privileged business logic that BOTH apps share lives in **Supabase Edge Functions**, not here.
Route Handlers are for web-specific concerns (SSR composition, browser webhooks).

**TODO:** implement handlers.
