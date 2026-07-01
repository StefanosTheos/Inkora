# supabase/functions — Edge Functions (Deno)

Privileged, server-only logic shared by BOTH apps (run with the service_role key).
These hold secrets and 3rd-party integrations; clients invoke them, never tables.

Planned functions:
- `accept-offer/` — booking state machine: validate transition, insert appointment, notify, audit_log
- `apply-reward/` — wraps the apply_reward_transaction RPC (award/redeem)
- `notify-dispatch/` — in-app insert + FCM fan-out honoring preferences/quiet hours
- `storage-upload-url/` — mint signed upload URLs (validate bucket/role/path)
- `moderate/` — moderation decisions on UGC

`_shared/` holds CORS + a service-role client factory + zod re-exports (from @inkora/domain).

**TODO:** implement. Placeholders only — no business logic yet.
