# @inkora/data-access

The only package that imports `@supabase/supabase-js`. Apps NEVER call Supabase directly — they use the hooks exported here.

## Layers (top consumes bottom)

```
hooks/         # app-facing: useArtist, useFeed, useSendMessage, useAiPreview …  (TanStack Query)
services/      # business orchestration interfaces (BookingService, RewardsService …)
repositories/  # pure data access interfaces over the RLS-scoped client
realtime/      # channel names + RealtimeManager (writes events INTO the query cache)
client/        # platform-injected Supabase client FACTORY contract
db/            # generated database.types.ts (pnpm gen:types)
```

## Platform injection

The Supabase client is created by a **platform-injected factory** so the same code
serves both apps with identical behavior:

- **mobile** → SecureStore/AsyncStorage session, AppState-aware refresh
- **web** → `@supabase/ssr` cookie sessions (server + browser clients)

Each app calls `createDataAccess(config)` once at startup and passes the platform client in.

## Rules
- Reads/simple writes go direct to PostgREST (RLS-gated).
- Privileged ops (accept-offer, rewards, signed uploads) call Edge Functions/Route Handlers — never tables.
- Realtime is a fast-path: on reconnect, refetch to backfill. Never a parallel store.

**TODO:** implement factory, repositories, hooks. Interfaces only for now (no business logic).
