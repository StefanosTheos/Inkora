# @inkora/web — SECONDARY

Next.js App Router. Purpose: **SEO + browsing + artist/studio management** — NOT full mobile parity.

## Structure

```
src/app/
  (marketing)/      # public landing, SEO — static/ISR
  (auth)/           # login, signup, onboarding
  (app)/            # authenticated browse: feed, discover, artists/[handle] (RSC+metadata = SEO engine), studios/[slug], messages
  (artist)/dashboard  # PRIMARY web use case — management
  (studio)/dashboard  # PRIMARY web use case — management
  (admin)/          # moderation console (moderator role)
  api/              # Route Handlers (BFF, webhooks)
src/features/        # mirrors mobile feature names; logic via shared hooks
src/lib/             # supabase server/browser clients (@supabase/ssr), query client, env
middleware.ts        # session refresh + role-gate redirects
```

Profiles are Server Components with `generateMetadata` (OpenGraph + JSON-LD). Filters live in `searchParams` (nuqs).
Paths mirror the mobile route table (`@inkora/domain/navigation`) for deep-link parity.

**TODO:** implement pages. Files are placeholders.
