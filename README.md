# Inkora — Monorepo

Tattoo discovery, inspiration, visualization & booking marketplace.

**Mobile is the PRIMARY experience** (React Native + Expo). **Web is SECONDARY** (SEO, browsing, artist/studio management).

## Layout

```
apps/
  mobile/      # ⭐ PRIMARY — Expo + Expo Router (React Native)
  web/         #   SECONDARY — Next.js App Router (SEO, browse, dashboards)
packages/
  domain/        # pure TS: types, enums, zod schemas, navigation route table, state machines (NO React, NO Supabase)
  data-access/   # Supabase client factory + repositories + TanStack Query hooks + realtime
  design-tokens/ # single source of truth for colors/spacing/type — feeds Tailwind (web) + NativeWind (mobile)
  ui-native/     # 📱 React Native component library (MOBILE ONLY)
  ui-web/        # 🖥️ shadcn/ui component library (WEB ONLY)
  analytics/     # typed PostHog event catalog
  config/        # shared tsconfig / eslint / tailwind preset
supabase/        # database migrations, edge functions, seed (source of truth for schema)
ai/              # 🤖 AI tattoo-preview PLACEHOLDER — interfaces + mock ONLY. No ML, no inference.
```

## Sharing principle

Share everything that **isn't pixels**: types, validation, data access, business logic, design tokens, navigation routes.
Build the **rendered UI twice** (`ui-native` vs `ui-web`) — shadcn (Radix) cannot render in React Native, and that's by design.

Dependency direction (never violated):
`domain` ← `data-access` ← `ui-*` ← `apps`. `domain` depends on nothing. Apps never import other apps.

## Getting started

```bash
pnpm install
pnpm gen:types        # generate DB types from local Supabase
pnpm dev:mobile       # Expo (primary)
pnpm dev:web          # Next.js (secondary)
```

> TODO: add CONTRIBUTING.md, CI workflow, and EAS/Vercel deploy docs.
