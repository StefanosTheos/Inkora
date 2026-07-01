// Edge Function: accept-offer (Deno). PRIVILEGED (service_role).
// Contract: { offerId: string, idempotencyKey: string } -> { appointment }
// Steps (TODO, no business logic yet):
//   1. validate input (zod from @inkora/domain)
//   2. authz: caller is the request's client
//   3. legal transition check (OFFER_TRANSITIONS / REQUEST_TRANSITIONS)
//   4. insert appointment (service_role; no client RLS insert path)
//   5. mark offer accepted + request converted
//   6. notify-dispatch + audit_log write + analytics (booking_accepted)
// Deno.serve(async (req) => { ... })
export {};
