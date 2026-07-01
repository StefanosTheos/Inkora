# data-access/providers

Shared React providers consumed by BOTH apps (mounted at each app's root).

- **AuthProvider** — wraps Supabase `onAuthStateChange`, exposes `AuthContext` (userId + `app_roles`). Drives query enablement and role routing.
- **QueryProvider** — TanStack `QueryClient`; on mobile, wires the MMKV persister (offline cache).
- **RealtimeProvider** — owns the `RealtimeManager` lifecycle; resubscribes on reconnect.

**TODO:** implement. These are the only React components in data-access; everything else is hooks/interfaces.
