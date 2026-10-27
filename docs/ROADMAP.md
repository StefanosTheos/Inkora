# Inkora roadmap

This is the maintained entry point for current work. Detailed findings and completed/deferred audit entries formerly in root `fixes.md` are preserved in [audit history](development/AUDIT_HISTORY.md). Historical completion labels are not proof that a fresh deployment has received every migration or service configuration.

## Public showcase and deployment

- [x] Update root/mobile/web documentation to match implemented role-aware mobile screens, existing CI and actual web gaps.
- [x] Separate on-device try-on from mock model-generated previews.
- [x] Document local Supabase, app-specific environment files, storage and native builds.
- [x] Preserve the owner's proprietary code terms and separate third-party material.
- [x] Replace screenshot placeholders with nine cropped demo captures covering seeker, artist and studio flows.
- [ ] Complete [asset rights/provenance review](../THIRD_PARTY_NOTICES.md), including tattoo-style imagery and historic assets.
- [ ] Validate a fresh local migration/seed/storage setup end to end.
- [ ] Separate demo-account/data migrations before any production deployment. Some committed migrations, as well as `seed.sql`, insert demonstration users with known passwords.
- [ ] Verify hosted RLS, storage policies, custom auth hook, redirects, push credentials and webhook/Edge Function configuration.
- [ ] Confirm all migrations have reached the intended environment, including notification preference cleanup.
- [ ] Replace the author's EAS public connection/ownership settings for independent builds.
- [ ] Add full Next.js/native-build and end-to-end coverage; current CI runs lint, typecheck and configured unit tests.

## Current product backlog

| Work | Prior finding | Scope |
| --- | --- | --- |
| Rewards clarity | #30 | Explain earning rules, tiers, referral behavior and voucher availability. |
| Voucher idempotency | #70 | Replace a new `Date.now()`-based redemption key on each invocation with a stable logical-request key. |
| Rewards empty state | #71 | Avoid an empty redemption heading when no vouchers exist. |
| Rewards role guard | #73 | Include studio owners in seeker-only route protection. |
| Inspiration collections | #9 | Saves are flat; boards/grouping/sharing remain absent. |
| Production analytics | #80 | Mobile currently uses the console tracker; wire an actual adapter deliberately. |
| Web business dashboards | #81 | Implement artist/studio dashboards after resolving route groups and middleware paths. Several routes remain scaffold-only. |
| Studio co-managers | #82 | Make manager/delegation semantics reachable through supported RPCs before presenting this as a capability. |

These entries preserve the previously open findings. They have not been newly fixed by the documentation revamp; verify current code before implementation.

## Deliberate limitations and deferred work

- Model-generated tattoo previews have no inference implementation. Keep their interface/mock boundary explicit.
- Try-on is intentionally limited to artist flash designs; it composites existing images rather than generating new artwork (prior #79).
- Payments/deposits are not integrated; reconcile product copy with actual behavior (#3).
- Post-onboarding role elevation is not implemented (#5).
- Account deletion is surfaced under Legal/Help; review discoverability (#7).
- Solo owner-operator workflows require separate artist identity (#33).
- Moderation remains incomplete; RLS alone is not a moderation service (#34).
- Email confirmation/notification behavior and push delivery depend on actual service configuration; do not infer production readiness from UI or schema alone.

## Completed audit work

The [historical audit](development/AUDIT_HISTORY.md) retains the original IDs and descriptions for booking transitions/overlap guards, reviews, roster/calendar/insights, messaging, onboarding, notification paging and other completed changes. Keep new implementation work here and move verified completions into a dated entry with its change/test reference.
