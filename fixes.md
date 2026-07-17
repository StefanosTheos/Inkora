# Inkora — UX Fixes & Improvements

A prioritized backlog from a full-app audit of the three roles (seeker, artist, studio owner)
covering navigation, onboarding, the booking flow, the studio application/roster ecosystem,
studio statistics, and discovery/messaging/rewards.

> Point-in-time findings from a code audit — a few items may be intentional product choices.
> Tackle section by section; check items off as you go. File pointers are starting points, not exhaustive.
> Legend: `[x]` done · `[~]` deferred (intended behavior) · `[ ]` open.

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

- [~] **3. Deposits are threatened but never collected.** ⏸ Deferred — intended behavior.
  - Problem: reschedule UX warns "requires a new deposit," but there's no payment step anywhere; `deposit_paid` always false. Nagging about a fee that can't be charged.
  - Fix: remove deposit language until payments exist, or wire payments.
  - Files: `BookingRequestFlow.tsx` (~:283-288), `BookingDetailScreen.tsx` (~:154-160, :265-277).

- [x] **4. Studio stats mutate retroactively when the roster changes.** ✅ `20260716140000_studio_stats_by_studio_id.sql` attributes bookings/revenue by `appointments.studio_id` (stable across roster changes) + scopes per-artist metrics to the studio; also fixes mis-attribution of an artist's non-studio work. Signatures unchanged (no client edits).
  - Problem: `studio_overview` / `studio_artist_stats` only count `active` members, so suspending/removing an artist instantly erases their historical revenue/bookings/visits from studio totals.
  - Fix: base historical aggregates on who performed the work at the time, not current membership status.
  - Files: `supabase/migrations/20260714180000_studio_stats_ext.sql` (~:27, :73).

- [~] **5. No post-onboarding role elevation.** ⏸ Deferred — intended behavior.
  - Problem: `becomeArtist`/`createStudio` only reachable during onboarding; a "Find a tattoo" user can never become an artist/studio later. `SELF_GRANTABLE` defined but unused.
  - Fix: add "Become an artist / Register a studio" entry in Account Settings.
  - Files: `packages/data-access/src/auth/profile.ts` (:52-72), `packages/data-access/src/auth/roles.ts` (:54), `AccountSettingsScreen.tsx`.

- [x] **6. Rewards are stranded for artists & studios.** ✅ Decision: rewards are **seeker-only**. `20260716150000_rewards_seeker_only.sql` gates `award_points` (earn) + `redeem_voucher`/`redeem_referral` (spend) to accounts holding the `seeker` role, so non-seekers never accrue (no stranding). UI is already seeker-only. Welcome points unaffected (seeded at signup while seeker).

- [~] **7. Delete account is buried in Help center, not Account Settings** (GDPR / App-Store risk). ⏸ Deferred — intended behavior.
  - Files: `DeleteAccountScreen` reached via `LegalScreen.tsx:113`; add to `AccountSettingsScreen.tsx`.

---

## Tier 2 — High-value functionality & engagement

### Discovery → collection loop
- [x] **8a. Idea search is title-only.** ✅ Explore keyword search now matches **title AND description** (`fetchIdeaFeedPage` OR-ilike), so null-title ideas are reachable; style is covered by the style chips. No migration.
- [x] **8b. Ideas aren't searchable in Discover.** ✅ Added a **"Designs"** scope to Discover — a 2-col masonry grid backed by the (now title+description) idea feed with infinite scroll. `SearchScope` extended; `useIdeaFeed` gained an `enabled` flag. Removed the redundant keyword box from Home's Explore section (now browse + style chips only; typed search lives in Discover) — top search bar still routes there.
- [ ] **9. No boards/collections** — saves are a flat, unorganizable list; can't share a collection with an artist.
  - Files: `UserDashboardScreen.tsx` (~:198), `favorites` table.
- [x] **10. `save_count` is fully wired but never displayed.** ✅ Idea tiles now show a compact `♥ N` badge (only when >0); idea detail shows a "N saves" line. Plus a **Recent / Popular** sort (popularity = save_count, keyset on (save_count, id)) on both Home Explore and Discover → Designs.
- [ ] **11. No Share and no "Message artist" from ideas/portfolio** — missing organic-growth + contact shortcuts (Share exists only for referral code).
  - Files: `IdeaDetailScreen.tsx`, `PortfolioDesignScreen.tsx`.
- [x] **12. Style-filtered feed silently truncates at ~500 ideas.** ✅ Replaced client-side id materialization (1000-link/500-id caps) with a server-side `idea_styles!inner` join filter — whole style corpus reachable, keyset applies to the full set, no parent duplication (verified). Less code, no migration.

### Reliability & re-engagement
- [x] **13. Push may be silently inactive.** ✅ Hardened the two silent-failure paths I can fix in code: (a) **token rotation** — added `syncPushRegistration()` + a `usePushSync()` boot hook that, for any signed-in user with push enabled, silently re-registers the *current* FCM token (no prompt) and subscribes to in-session rotations, reactivating a previously-disabled token; without this a rotated token gets 404'd, disabled, and push dies with no recovery. (b) **observability** — `notify-dispatch` now `console.warn/error`s every inert state (missing `FCM_SERVICE_ACCOUNT`, opted-in-but-no-tokens, per-token FCM 4xx/5xx) and also disables tokens on `400 INVALID_ARGUMENT` (not just 404). The "enable in Settings" nudge already exists in Account settings (osBlocked → `Linking.openSettings()`). **Still infra, not code** (user-side, unchanged): create the Firebase project + `google-services.json`, set `supabase secrets set FCM_SERVICE_ACCOUNT=…`, and add the Database Webhook on `notifications` INSERT → `notify-dispatch`. Until those three are done no push is delivered regardless of app code.
  - Files: `apps/mobile/src/lib/notifications.ts`, `apps/mobile/src/lib/use-push-sync.ts`, `apps/mobile/app/_layout.tsx`, `supabase/functions/notify-dispatch/index.ts`.
- [x] **14. Offers and requests never expire.** ✅ Offers now get an `expires_at` on send (`createOffer`: 7 days, capped at the proposed start — can't accept a slot that already passed). New migration `20260716160000_expire_offers_requests.sql` adds hourly sweepers: `expire_stale_offers()` flips pending offers past `expires_at` **or** past their proposed slot → `expired` (also covers legacy null-expiry offers) and notifies both parties; `expire_stale_requests()` flips pending/reviewing requests older than 7 days → `expired` and nudges the seeker ("try another artist"). `respond_offer` already refused expired offers server-side. UI: `OfferCard` shows an "⏳ Expires in N days" countdown while pending, and treats a time-expired offer as expired (Accept button hidden, "Expired" chip) even before the cron sweeps it. **Migration must be applied in SQL Editor.**
  - Files: `packages/data-access/src/booking/index.ts`, `apps/mobile/src/features/booking/BookingDetailScreen.tsx` (`OfferCard`), `supabase/migrations/20260716160000_expire_offers_requests.sql`.

### Notifications & navigation intent
- [x] **15. Several notifications dead-end at `/notifications`** (application-expired, invite accepted/declined, new-artist-joined, suspend/reactivate). ✅ `notificationHref` now routes every `membership_request` by payload: artist invite → `/studio/{slug}`; owner new-application (`artistId`) → `/studio-applications`; owner roster change (`audience:'owner'`) → `/studio-dashboard/roster`; all remaining artist-facing status changes (application accepted/declined/expired, suspended/removed/reactivated) → `/artist-dashboard` (shows their studio affiliation) instead of the inbox. Migration `20260716170000_notification_deeplinks.sql` tags `respond_studio_invite`'s owner notification with `audience:'owner'` (it was previously indistinguishable from an artist status change — both only had `studioId`); artist-facing RPCs need no DB change since they fall through to the dashboard. **Migration must be applied in SQL Editor.**
  - Files: `packages/domain/src/models/notification.ts` (`notificationHref`), `supabase/migrations/20260716170000_notification_deeplinks.sql`.
- [x] **16. "See all" throws away rail intent**; **Recommended silently == Featured** when user has no style prefs. ✅ Each rail's "See all" now carries its intent into Discover via nav params: Featured → `sort=rating&acceptingOnly=1`; Recommended → `styleSlugs=<user's top slugs>&sort=relevance`; Trending → `sort=rating`; Nearby studios → `scope=studios&sort=distance`. `DiscoverScreen` now reads `scope`, `styleSlugs`, and `acceptingOnly` params (in addition to `sort`/`minRating`). For empty recs: new `useMyStyleSlugs` hook detects when the user has no preferences (so Recommended would just mirror Featured) — Home then hides that rail and shows a **"Take the style quiz"** CTA routing to a new standalone `/style-quiz` route (reuses the seeker deck + taste board via an exported `SeekerOnboarding`; on finish it saves prefs, invalidates `recommended-for-me`/`my-style-slugs`, and returns Home). No migration.
  - Files: `apps/mobile/src/features/home/HomeScreen.tsx`, `apps/mobile/src/features/discovery/DiscoverScreen.tsx`, `apps/mobile/src/features/onboarding/OnboardingFlow.tsx` (export `SeekerOnboarding`), `apps/mobile/app/style-quiz.tsx` (new), `packages/data-access/src/home/{queries,hooks}.ts` (`useMyStyleSlugs`).
- [x] **17. Location dead-ends in discovery** — "Nearest"/distance filters disable silently, nearby rail vanishes, no inline "set your city" action. ✅ New reusable `SetLocationSheet` (city + optional country → `updateProfileLocation` geocode → invalidates `my-location`, so distance/nearby light up immediately). Discover: the "Nearest" sort chip now stays tappable with a 📍 hint when there's no location and opens the sheet (instead of a greyed dead chip); `FilterSheet`'s Distance section shows an actionable "Set your city to filter by distance" row (via new `onSetLocation` prop) instead of a passive "(set your city to enable)" note. Home: when no location is saved, the vanished Nearby rail is replaced by a "See studios & artists near you — Set your city" CTA. No migration.
  - Files: `apps/mobile/src/components/SetLocationSheet.tsx` (new), `apps/mobile/src/features/discovery/DiscoverScreen.tsx`, `apps/mobile/src/features/discovery/FilterSheet.tsx`, `apps/mobile/src/features/home/HomeScreen.tsx`.

---

## Tier 3 — Studio dashboard depth

- [x] **18. No time ranges anywhere** — every number is all-time; can't answer "how did we do this month?" ✅ Added a **30 days / This month / This year** period selector on the studio dashboard Overview. New RPC `studio_overview_period` (migration `20260716180000`) aggregates the activity metrics — revenue, completed, cancelled, profile visits — for the chosen window **and** the prior equal-length window (MTD/YTD compare same-elapsed spans), so each renders a coloured **trend arrow** (↑/↓ %) vs. the previous period (cancellations invert good/bad colouring). Current-state metrics (artists, rating, scheduled, applications, saved-by) stay all-time; a caption clarifies which numbers are period-scoped. Bookings attributed by `studio_id` (consistent with #4). **Migration must be applied in SQL Editor.**
  - Files: `supabase/migrations/20260716180000_studio_overview_period.sql`, `packages/domain/src/models/studio-profile.ts` (`StatsPeriod`, `StudioPeriodStat`), `packages/data-access/src/studio/index.ts` (`useStudioOverviewPeriod`), `packages/data-access/src/db/database.types.ts`, `apps/mobile/src/features/studio/StudioDashboardScreen.tsx`.
- [x] **19. `no_show` is invisible** in every stat (and never set anywhere in the app) — real revenue-loss signal counted nowhere. ✅ Implemented: artists can **Mark as no-show** on a started session (`markNoShow` → status `no_show` + `cancelled_at`; the appt-update trigger notifies the client). Surfaced in stats via migration `20260716190000` (drops+recreates `studio_overview`, `studio_artist_stats`, `studio_overview_period` to add no-show counts, incl. period + trend, timed by `cancelled_at`). Dashboard shows a period-scoped **No-shows** tile with a (red-when-up) trend arrow, and each roster card gets a **No-show** metric (red when >0). **Migration must be applied in SQL Editor.**
  - Files: `packages/data-access/src/booking/index.ts` (`markNoShow`), `apps/mobile/src/features/booking/BookingDetailScreen.tsx`, `supabase/migrations/20260716190000_studio_no_show.sql`, `packages/domain/src/models/studio-profile.ts`, `packages/data-access/src/studio/index.ts`, `packages/data-access/src/db/database.types.ts`, `apps/mobile/src/features/studio/StudioDashboardScreen.tsx`.
- [x] **20. Per-artist `cancelled` is fetched but never rendered** — cancellation rate dropped from `ArtistStatCard`. ✅ Added a **Cancel** metric to each roster card showing the cancellation *rate* (`cancelled / (completed + cancelled)`, "—" with no history), turning red at ≥20%. No migration.
  - Files: `apps/mobile/src/features/studio/StudioDashboardScreen.tsx` (`ArtistStatCard`/`Metric`).
- [x] **21. Suspended artists show name-only** — reactivate decision is blind (no stats, no reason, no Message). ✅ Suspended cards now show the artist's **performance metrics** (revenue, done, cancel-rate, no-show, reviews, saves, visits), a **Message** button, and the **suspension reason + date**. Suspending now prompts for an optional reason (stored on the membership, cleared on reactivate/remove). Migration `20260716200000` adds `studio_memberships.suspension_reason`, extends `studio_set_membership` with `p_reason`, and broadens `studio_artist_stats` to include suspended members so their stats are available. **Migration must be applied in SQL Editor.**
  - Files: `supabase/migrations/20260716200000_suspension_reason.sql`, `packages/domain/src/models/studio-profile.ts`, `packages/data-access/src/studio/index.ts`, `packages/data-access/src/db/database.types.ts`, `apps/mobile/src/features/studio/StudioDashboardScreen.tsx`.
- [ ] **22. Two different studio ratings** — dashboard hero = studio's own reviews; public page = roster-weighted artist average. Reconcile.
  - Files: `StudioDashboardScreen.tsx` (~:168), `StudioProfileScreen.tsx` (~:59).
- [x] **23. Applications inbox**: no sort/filter/count/refresh, applicant portfolio not inline; auto-reject countdown ~24h off; applicant's chat card permanently "Pending". ✅ Inbox now shows a **count** in the title, **pull-to-refresh**, a **sort toggle** (Expiring first / Top rated), and **inline portfolio thumbnails** per applicant (reuses `useStudioPortfolio`, ≤4 each). Countdown now computed from the **real 03:00 UTC cron instant** (next daily run at/after the 5-day mark) instead of `applied+5d`, killing the ~24h drift. The applicant's chat card resolves: it reads their own membership row (RLS-allowed) and shows **Accepted / Not accepted / Pending** instead of a permanent "Pending". No migration.
  - Files: `apps/mobile/src/features/studio/StudioApplicationsScreen.tsx`, `apps/mobile/src/features/messaging/ChatThreadScreen.tsx` (`StudioApplicationCard`), `packages/data-access/src/studio/index.ts` (`getMyStudioMembershipStatus`/`useMyStudioMembershipStatus`).
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
