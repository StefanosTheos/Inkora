# Inkora — UX Fixes & Improvements

A prioritized backlog from a full-app audit of the three roles (seeker, artist, studio owner)
covering navigation, onboarding, the booking flow, the studio application/roster ecosystem,
studio statistics, and discovery/messaging/rewards.

> Point-in-time findings from a code audit — a few items may be intentional product choices.
> Tackle section by section; check items off as you go. File pointers are starting points, not exhaustive.

## Role scope (reference)
- **Seeker** — consumer: discover artists/ideas, collect inspiration, book, chat, review, earn rewards, AI try-on.
- **Artist** — provider: portfolio/flashes, requests → offers → appointments → reviews; apply to studios.
- **Studio owner** (`studio_admin`) — business/manager: public studio page, roster (apply/invite/suspend), KPI dashboard. Business-only (no Discover/Create tabs).

---

## Tier 1 — Broken loops & dead-ends (do first)

- [x] **1. Bookings never auto-complete; only the artist can complete.** ✅ Auto-complete cron (`20260716120000_auto_complete_appointments.sql`) + seeker can mark completed + completion card nudges both to review.
  - Problem: if the artist never taps "Mark completed," the appointment stays `scheduled` forever — it never leaves the seeker's *Upcoming* tab and the **seeker can never review** (review UI gated on `status==="completed"`). Strangles the whole ratings system.
  - Fix: date-based auto-complete (daily cron past end time), allow the **seeker** to confirm completion, prompt both sides to review.
  - Files: `apps/mobile/src/features/booking/BookingDetailScreen.tsx` (~:248), `packages/data-access/src/booking/index.ts` (`completeAppointment` ~:518), new migration/cron.

- [x] **2. Declining a proposed reschedule cancels the entire appointment.** ✅ New `decline_reschedule` RPC (`20260716130000_decline_reschedule.sql`) keeps the original time; UI now has "Keep original time" / "Withdraw request" separate from "Cancel appointment".
  - Problem: `declineFully → cancelAppointment` — rejecting the *new* time kills the *original* booking; no "keep the original" option. High foot-gun; label reads "Decline appointment" but users read it as "decline the new time."
  - Fix: decline should reject only the proposal and retain the existing time.
  - Files: `BookingDetailScreen.tsx` (~:134-140, :237-243).

- [ ] **3. Deposits are threatened but never collected.**
  - Problem: reschedule UX warns "requires a new deposit," but there's no payment step anywhere; `deposit_paid` always false. Nagging about a fee that can't be charged.
  - Fix: remove deposit language until payments exist, or wire payments.
  - Files: `BookingRequestFlow.tsx` (~:283-288), `BookingDetailScreen.tsx` (~:154-160, :265-277).

- [ ] **4. Studio stats mutate retroactively when the roster changes.**
  - Problem: `studio_overview` / `studio_artist_stats` only count `active` members, so suspending/removing an artist instantly erases their historical revenue/bookings/visits from studio totals.
  - Fix: base historical aggregates on who performed the work at the time, not current membership status.
  - Files: `supabase/migrations/20260714180000_studio_stats_ext.sql` (~:27, :73).

- [ ] **5. No post-onboarding role elevation.**
  - Problem: `becomeArtist`/`createStudio` only reachable during onboarding; a "Find a tattoo" user can never become an artist/studio later. `SELF_GRANTABLE` defined but unused.
  - Fix: add "Become an artist / Register a studio" entry in Account Settings.
  - Files: `packages/data-access/src/auth/profile.ts` (:52-72), `packages/data-access/src/auth/roles.ts` (:54), `AccountSettingsScreen.tsx`.

- [ ] **6. Rewards are stranded for artists & studios.**
  - Problem: every signup gets 100 welcome points and artists keep the seeker grant, but rewards UI lives only on the seeker dashboard → artists/studios can never see/spend points.
  - Fix: surface rewards for all roles, or stop granting where unreachable.
  - Files: `handle_new_user()` (`20260629121500_auth_integration.sql:20-25`), `UserDashboardScreen.tsx`, `RewardsScreen.tsx`.

- [ ] **7. Delete account is buried in Help center, not Account Settings** (GDPR / App-Store risk).
  - Files: `DeleteAccountScreen` reached via `LegalScreen.tsx:113`; add to `AccountSettingsScreen.tsx`.

---

## Tier 2 — High-value functionality & engagement

### Discovery → collection loop
- [ ] **8. Idea search is title-only** (many ideas have null titles → feels broken); **ideas aren't searchable in Discover** (Artists/Studios only), yet the home search bar implies styles/designs.
  - Fix: full-text search over title/description/style/artist; add an Ideas scope to Discover.
  - Files: `home/queries.ts` (`fetchIdeaFeedPage` ~:221), `DiscoverScreen.tsx` (`SCOPES` :25).
- [ ] **9. No boards/collections** — saves are a flat, unorganizable list; can't share a collection with an artist.
  - Files: `UserDashboardScreen.tsx` (~:198), `favorites` table.
- [ ] **10. `save_count` is fully wired but never displayed** — free social proof unused.
  - Files: `IdeaTile`, `IdeaDetailScreen.tsx`.
- [ ] **11. No Share and no "Message artist" from ideas/portfolio** — missing organic-growth + contact shortcuts (Share exists only for referral code).
  - Files: `IdeaDetailScreen.tsx`, `PortfolioDesignScreen.tsx`.
- [ ] **12. Style-filtered feed silently truncates at ~500 ideas** → popular styles hide most content behind a false "you've seen everything."
  - Files: `home/queries.ts` (~:207-209).

### Reliability & re-engagement
- [ ] **13. Push may be silently inactive.** Uses raw FCM `getDevicePushTokenAsync`; `notify-dispatch` no-ops without `FCM_SERVICE_ACCOUNT`. Offers/messages/bookings may generate no push at all.
  - Fix: verify FCM pipeline end-to-end; add "enable in Settings" nudge when permission blocked.
  - Files: `apps/mobile/src/lib/notifications.ts`, `supabase/functions/notify-dispatch/index.ts`.
- [ ] **14. Offers and requests never expire.** Stale offer stays "Accept"-able forever (even past dates); ignored request leaves seeker on "Pending" with no timeout/re-routing.
  - Fix: offer `expires_at` + expiry cron; nudge/auto-expire idle requests.
  - Files: `OfferComposerSheet.tsx` (~:105-134), `ArtistOfferComposer` in `BookingDetailScreen.tsx` (~:663-682), `booking_flow.sql`.

### Notifications & navigation intent
- [ ] **15. Several notifications dead-end at `/notifications`** (application-expired, invite accepted/declined, new-artist-joined, suspend/reactivate) — payloads lack slug/id.
  - Fix: include deep-link targets (roster/studio/booking).
  - Files: `packages/domain/src/models/notification.ts` (`notificationHref` ~:45-64), studio RPC notification payloads (`20260714190000_studio_roster_mgmt.sql`).
- [ ] **16. "See all" throws away rail intent**; **Recommended silently == Featured** when user has no style prefs.
  - Fix: carry the rail's sort/filter through; add a "take the style quiz" CTA for empty recs.
  - Files: `HomeScreen.tsx` (~:81, :148), `home/queries.ts` (~:104).
- [ ] **17. Location dead-ends in discovery** — "Nearest"/distance filters disable silently, nearby rail vanishes, no inline "set your city" action.
  - Files: `DiscoverScreen.tsx` (~:126), `FilterSheet.tsx` (~:42), `HomeScreen.tsx` (~:146).

---

## Tier 3 — Studio dashboard depth

- [ ] **18. No time ranges anywhere** — every number is all-time; can't answer "how did we do this month?" Add period selector (30d/MTD/YTD) + trend arrows.
- [ ] **19. `no_show` is invisible** in every stat (and never set anywhere in the app) — real revenue-loss signal counted nowhere. Implement no-show and surface it.
- [ ] **20. Per-artist `cancelled` is fetched but never rendered** — cancellation rate dropped from `ArtistStatCard`.
  - Files: `studio/index.ts` (~:378), `StudioDashboardScreen.tsx` (~:359-364).
- [ ] **21. Suspended artists show name-only** — reactivate decision is blind (no stats, no reason, no Message).
  - Files: `StudioDashboardScreen.tsx` (~:225).
- [ ] **22. Two different studio ratings** — dashboard hero = studio's own reviews; public page = roster-weighted artist average. Reconcile.
  - Files: `StudioDashboardScreen.tsx` (~:168), `StudioProfileScreen.tsx` (~:59).
- [ ] **23. Applications inbox**: no sort/filter/count/refresh, applicant portfolio not inline; auto-reject countdown can be ~24h off vs daily cron; the **applicant's own chat card is permanently "Pending"** (never resolves).
  - Files: `StudioApplicationsScreen.tsx` (~:23), `ChatThreadScreen.tsx` (`StudioApplicationCard` ~:613-654), `20260714150000_studio_applications_owner.sql`.
- [ ] **24. Studio edit gaps**: logo not editable; opening-hours editor supports one interval/day and **silently destroys split shifts** on save; no email/phone/website validation; currency hard-coded €.
  - Files: `StudioEditScreen.tsx` (~:69, :84, :93), `update_studio.sql`, `compactMoney` in `StudioDashboardScreen.tsx` (~:45).

---

## Tier 4 — Polish, IA & appearance

- [ ] **25. Cancelled appointments sit under "Upcoming"** (and inflate its count) — separate/archive them. (`MyBookingsScreen.tsx` ~:55)
- [ ] **26. Dead statuses** (`rescheduled`, `reviewing`, `no_show`) have labels/branches but are never set — implement or prune.
- [ ] **27. Artist IA is inverted** — Home tab shows the seeker feed; the artist dashboard hides behind the Profile icon and is titled "Your studio" (misleading for independent artists). (`ArtistDashboardScreen.tsx:47`)
- [ ] **28. The Create tab oversells "AI"** — it's on-device compositing, not generation; align the copy. (`create/index.tsx`, `AiPreviewHomeScreen.tsx`)
- [ ] **29. Messaging polish**: 200-message cap, no load-earlier (early offer cards vanish); chat images re-sign every render (flicker); voice notes send with no cancel/preview; delete-conversation is long-press-only.
  - Files: `messaging/index.ts` (`getMessages` ~:85), `ChatThreadScreen.tsx` (~:218, :110), `ConversationsScreen.tsx` (~:64).
- [ ] **30. Rewards are opaque** — no "ways to earn" panel, tier benefits unexplained, `save` earn-reason contradicts saving awarding nothing, referral share has no deep link. (`RewardsScreen.tsx`, `ideas/index.ts:159`)
- [ ] **31. Loading & empty states** — raw spinners cause layout jumps; single-line gray empties with no CTAs. Add skeletons + actionable empty states app-wide.

### Smaller items / cleanup
- [ ] **32. Dead `/studio-dashboard` route** renders "coming soon" while the real dashboard is on the home tab; `homePathForRoles` even points there. Remove/redirect. (`app/studio-dashboard/index.tsx:18`)
- [ ] **33. Solo owner-operator has no path** — `createStudio` grants only `studio_admin`, so an owner who also tattoos can't have an artist profile (compounds #5).
- [ ] **34. Moderator role has no mobile surface** — falls through to the seeker feed silently.
- [ ] **35. Artist/studio onboarding captures no location** — artist accounts get no city/coords, hurting distance-based recommendations until manual profile edit.
- [ ] **36. "Let the studio choose" overpromises** — routes to the studio owner personally with no artist assignment/reassignment; roster-availability preview doesn't match who actually fulfills. (`BookingRequestFlow.tsx` ~:48, :58-61, :216)
- [ ] **37. Local appointment reminders are fragile** — only scheduled when the seeker/artist opens the bookings/agenda screen; `cancelAllScheduledNotificationsAsync()` wipes all local notifications; two screens compete. (`notifications.ts` ~:74-98)
- [ ] **38. No double-booking guard at accept time** — `appointments` has no overlap constraint and `respond_offer` doesn't re-validate the slot (race between two clients accepting overlapping offers).
- [ ] **39. Multi-dimension `ratings` table is unused** — seeker reviews capture a single overall star only.
- [ ] **40. Studio reviews section** is read-only, capped at 3, no "see all", no rating distribution, no reply; `client_reviews_for` extended to owners but no owner-facing screen surfaces client reviews.

---

## Suggested first sprint (highest impact-to-effort)
**#1** (auto-complete + seeker review prompt), **#2** (reschedule decline fix), **#5/#7** (role elevation + delete in settings), **#10** (show save_count), **#15** (notification deep-links), **#13** (verify push).

> Note: several items touch the DB (auto-complete cron, stat definitions, offer expiry, no-show) — batch those into migrations to review together.
