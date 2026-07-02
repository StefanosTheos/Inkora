# supabase/functions — Edge Functions (Deno)

Privileged, server-only logic shared by BOTH apps (run with the service_role key).
These hold secrets and 3rd-party integrations; clients invoke them, never tables.

Note: offer acceptance ships as the `respond_offer` SECURITY DEFINER RPC (see
migration 0030), not an Edge Function — clients call it directly under RLS.

Implemented:
- `become-artist/`, `create-studio/` — self-service role elevation (service_role).
- `notify-dispatch/` — push fan-out via FCM HTTP v1, honoring notification_preferences
  + active device_tokens (dead tokens auto-disabled). In-app inbox rows are written
  by DB triggers (migration 0030); this adds PUSH.

Planned:
- `apply-reward/` — wraps the apply_reward_transaction RPC (award/redeem)
- `storage-upload-url/` — mint signed upload URLs (validate bucket/role/path)
- `moderate/` — moderation decisions on UGC

`_shared/` holds CORS + a service-role client factory + zod re-exports (from @inkora/domain).

## Activating push (notify-dispatch)
The function is complete; it needs infra to run end-to-end:
1. **Firebase**: create a project + Android app; add `google-services.json` to the
   mobile build (app.config plugin) so `getDevicePushTokenAsync()` returns real FCM
   tokens (currently `registerPushToken` no-ops without it).
2. **Secret**: `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"`.
3. **Deploy**: `supabase functions deploy notify-dispatch`.
4. **Webhook**: Dashboard → Database → Webhooks → on `public.notifications` INSERT,
   POST to the function URL with the service_role key as an `Authorization: Bearer` header.

Until then, in-app notifications + local reminders work; remote push is a no-op.
