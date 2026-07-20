# Inkora — UX Fixes & Improvements

Backlog from full-app audits of the three roles (seeker, artist, studio owner).
**Top = open findings** (newest audit first). **Bottom = Done / Deferred** (condensed).

> Legend: `[ ]` open · `[x]` done · `[~]` deferred (intended behavior). File pointers are starting points, not exhaustive. A few items may be intentional product choices.

## Role scope (reference)
- **Seeker** — consumer: discover artists/ideas, collect inspiration, book, chat, review, earn rewards, on-device try-on.
- **Artist** — provider: portfolio/flashes, requests → offers → appointments → reviews; apply to studios. Business Home tab + Profile.
- **Studio owner** (`studio_admin`) — manager: public studio page, roster, KPI dashboard. Tabs: Studio · Chats · Team.

---

# OPEN — Round 2 audit (2026-07-20)

## Tier C — Notifications & messaging
- [ ] **51. Owner roster-change notifications dead-end on a removed stub.** `notificationHref` routes owner roster changes (invite accepted/declined, artist joined/left) to `/studio-dashboard/roster`, which is a "coming soon" placeholder — and after the dashboard→Team split the real roster lives on the **Team tab**. Fix: point `audience:'owner'` roster changes at `/team` (or route the tab) and delete the stub.
  - Files: `packages/domain/src/models/notification.ts:68`, `apps/mobile/app/studio-dashboard/roster.tsx`.
- [ ] **52. Per-type mute & quiet hours are silently non-functional.** The domain type models `notification_preferences.channels` as per-`NotificationType` `{inApp,push}` + `quietHours`, but every reader (notify-dispatch, use-push-sync, dashboard) treats it as a flat `{push,email}` boolean — push is one global on/off and the typed model is dead. Fix: implement per-type/quiet-hours or simplify the type to match.
  - Files: `packages/domain/src/models/notification.ts:22`, `supabase/functions/notify-dispatch/index.ts:89`.
- [ ] **53. No badge for new studio applications.** `membership_request` is absent from every badge count, so an owner gets no tab/Home badge for a new applicant — only the generic bell.
  - Files: `apps/mobile/src/lib/badges.ts:22-64`.
- [ ] **54. Reading a deep-linked chat leaves the tab badge lit.** `useChat` calls `markRead` on open but never invalidates `["conversations"]`, so opening a chat from a notification/deep-link leaves the Chats badge lit until the list refetches. Also `markRead` writes the client clock vs the server-set `last_message_at`, so clock skew can mis-flag unread.
  - Files: `packages/data-access/src/messaging/index.ts:171,319`.
- [ ] **55. Inline application accept/decline doesn't clear the owner's bell.** `StudioApplicationCard.respond` invalidates studio queries but never calls `markEntityNotificationsRead` (the offer card does), so the `membership_request` notification stays unread.
  - Files: `apps/mobile/src/features/messaging/ChatThreadScreen.tsx:732`.
- [ ] **56. Quote/consultation chat cards are non-actionable.** The "+" quick actions send `booking_card` quote/consultation messages that render as a static `RequestCard` — no accept/offer flow for the artist (unlike `BookingRequestCard`), so a structured ask is purely informational.
  - Files: `apps/mobile/src/features/messaging/ChatThreadScreen.tsx:210,431`.
- [ ] **57. Notifications inbox has no pagination or pull-to-refresh** (hard `limit 50`) — older notifications become unreachable.
  - Files: `packages/data-access/src/notifications/index.ts:37`, `NotificationsScreen.tsx`.

## Tier D — UX / QoL
- [ ] **58. Seeker Requests tab never archives closed requests.** It filters only `status !== 'converted'`, so declined/expired/cancelled requests never leave the tab and inflate "Requests (N)" (unseen declined even float to the top). The artist side has a "Closed" section; add an archive/closed grouping for seekers.
  - Files: `MyBookingsScreen.tsx:65`.
- [ ] **59. Flashes toggle: search + refresh are no-ops.** In Discover Designs the search box stays editable while Flashes is ON but `fetchFlashFeedPage` ignores `q`; on Home, pull-to-refresh refetches the idea feed (not `flashesQ`) and its spinner tracks the hidden idea feed. Fix: hide/disable search for flashes; refresh the active feed.
  - Files: `DiscoverScreen.tsx:92`, `HomeScreen.tsx:83`.
- [ ] **60. Raw style slugs shown to users.** `IdeaDetailScreen` renders `{sl}` ("neo-traditional") and `ArtistCard` meta shows raw slugs, instead of formatted names like `FilterSheet` (`st.name` / `formatStyleSlug`).
  - Files: `IdeaDetailScreen.tsx:116`, `home/components.tsx:89`.
- [ ] **61. Stat tiles over/under-count.** The seeker "Bookings" stat uses `countMyAppointments` (all statuses incl. cancelled/no_show); the "Saved" stat sums capped queries (artists 60 / designs 80) and diverges for heavy savers.
  - Files: `UserDashboardScreen.tsx:56,147`, `packages/data-access/src/booking/index.ts:385`.
- [ ] **62. Studio period grid mislabels what's period-scoped.** The "Scheduled" tile shows all-time `scheduledBookings` inside the wtd/mtd/ytd grid (never changes on toggle), and the period note lists "Revenue, completed, cancelled & visits" but omits No-shows (which IS period-scoped).
  - Files: `StudioDashboardScreen.tsx` (Overview grid + period note).
- [ ] **63. Year-to-date insights drill loses the year.** Both insight CTAs pass `g=month` for `ytd`, so drilling from a Year view opens the current month only (Insights has no year grain).
  - Files: `StudioDashboardScreen.tsx` (insights CTAs).
- [ ] **64. Studio invite doesn't exclude the current/invited roster.** An owner can tap "Invite" on someone already on the team → server error instead of a disabled/"On your team" state.
  - Files: `StudioInviteScreen.tsx:59-106`.
- [ ] **65. Studio calendar shows false empties out of window.** It loads a fixed `[today-365, +120]` range but `MonthCalendar` pages to any month; months outside the window show "Nothing booked" even when bookings exist. Fix: fetch on month change (or clamp navigation).
  - Files: `StudioCalendarScreen.tsx:45`.
- [ ] **66. Owner's own public studio page is a dead end.** Viewing their own `/studio/[slug]`, the sticky CTA is a hint only ("edit it from your dashboard") with no button — add an Edit / Back-to-dashboard action.
  - Files: `StudioProfileScreen.tsx:222`.
- [ ] **67. Studio opening-hours editor allows overlapping intervals** (the artist availability editor rejects them) — owners can save duplicate/overlapping split shifts.
  - Files: `StudioEditScreen.tsx:127-139`.
- [ ] **68. Redundant "Portfolio & flashes" row** appears in the Manage list on both the artist Home and the artist Profile — leftover from the Home/Profile split.
  - Files: `ArtistDashboardScreen.tsx`, `ArtistHomeScreen.tsx`.
- [ ] **69. Saved-design viewer loads full-res originals** for every page (`publicStorageUrl` with no size) instead of a sized `imageUrl(..., N)` — needless bandwidth/memory.
  - Files: `apps/mobile/app/(modals)/image-viewer.tsx:53`.
- [ ] **70. Voucher redemption idempotency key isn't stable.** `redeemVoucher(…, `${v.id}-${Date.now()}`)` changes every call, so it can't dedupe a double-submit — risks a double point spend on a money-equivalent action. Fix: derive a stable key (e.g. per voucher+day or a client-generated UUID held in state).
  - Files: `RewardsScreen.tsx:58`.
- [ ] **71. Rewards "Redeem points" header renders with no empty state** when no vouchers are configured — an orphaned header over blank space.
  - Files: `RewardsScreen.tsx:104`.
- [ ] **72. Onboarding gaps.** (a) A seeker who likes no style cards is hard-gated ("No favorites yet", only "Try again") with no skip — artists/studios aren't gated. (b) `onArtist` grants artist + drops seeker + re-mints the session *before* geocoding/`finish`; if `updateProfileLocation` fails the user is left artist-but-not-onboarded with no rollback.
  - Files: `OnboardingFlow.tsx:117,419`.
- [ ] **73. `/rewards` doesn't bounce studio owners.** The guard redirects `artist` but not `studio_admin`, so an owner deep-linking `/rewards` sees an empty seeker-only screen.
  - Files: `apps/mobile/app/rewards.tsx:11`.
- [ ] **74. Legal copy references a nonexistent setting.** It tells users to set a "default search radius under Account settings," but no radius control exists and `profiles.search_radius_km` is never editable. Fix the copy or wire the control.
  - Files: `LegalScreen.tsx:34`, `identity` migration.
- [ ] **75. Sign-up ignores email-confirmation + weak password hint.** The screen ignores `needsEmailConfirmation` (silent no-op if confirmations are enabled) and the "min 8 chars" placeholder has no client validation (Supabase default is 6).
  - Files: `apps/mobile/app/(auth)/sign-up.tsx:20-27,41`.
- [ ] **76. Idea "N saves" count goes stale after your own save.** `useIdeaSaved` invalidates `["idea-saved",id]`/`["saved-designs"]` but not `["idea",id]`, so the counter on the same detail screen doesn't update until a cold refetch.
  - Files: `packages/data-access/src/ideas/index.ts:176`.
- [ ] **78. `BigTile` ignores its `icon` when tappable.** With `onPress` set it always renders `chevron-forward`, so the Applications tile's `mail-unread-outline` never shows — a dead prop.
  - Files: `StudioDashboardScreen.tsx` (`BigTile`).

## Tier E — Missing capabilities / additions
- [ ] **9. No boards/collections** — saves are a flat, unorganizable list; can't group or share a collection with an artist. (`UserDashboardScreen.tsx`, `favorites`)
- [ ] **30. Rewards are opaque** — no "ways to earn" panel, tier benefits unexplained, `save` earn-reason contradicts saving awarding nothing, referral share has no deep link. (`RewardsScreen.tsx`, `ideas/index.ts`)
- [ ] **79. Try-on is flash-only.** Inspiration ideas (the bulk of Discover) have Save/Send/Book but no "Try on" — the headline feature is unreachable from most designs. Consider allowing any design image into the compositor.
  - Files: `IdeaDetailScreen.tsx`, `TryOnScreen.tsx`.
- [ ] **80. No production analytics.** Mobile uses a console no-op tracker (`createConsoleTracker(__DEV__)`), web has none, and the only real adapter (`createPostHogTracker`) is dead code — the full events taxonomy is unused. Wire a real tracker (or drop the taxonomy).
  - Files: `apps/mobile/src/lib/analytics.ts:5`, `packages/analytics/src/tracker.ts:44`.
- [ ] **81. apps/web business surfaces are stubs.** Artist & studio dashboard routes are empty `export {}` (render nothing); the web `ArtistProfileView` "Message" button links to the generic inbox instead of `startDirectConversation`; web AI is `alert("coming soon")`. Consumer flows work; business/admin dashboards are scaffold only.
  - Files: `apps/web/src/app/(artist)/dashboard/page.tsx`, `(studio)/dashboard/page.tsx`, `features/artist/ArtistProfileView.tsx:116`.
- [ ] **82. No studio co-manager / delegation.** `is_studio_admin` has an owner/manager membership branch, but every RPC hardcodes membership role `'artist'`, so a studio can't add a co-manager — the manager scope is unreachable.
  - Files: `supabase/migrations/20260629121300_rls_helpers.sql:19`, studio RPCs.

## Tier F — Dead code & type drift
- [ ] **83. Unused booking transition tables.** `packages/domain/src/state-machines/booking.ts` (`APPOINTMENT/REQUEST/OFFER_TRANSITIONS`) has zero importers — the declared transition-legality layer is unused (the root cause behind #42). Either enforce it (trigger/guard) or delete it.
- [ ] **84. `database.types.ts` schema drift (one stale regen).** Missing: `profile_visits` table, `appointment_requests.preferred_time_of_day` column, `membership_status 'requested'`, `notification_type 'membership_request'`/`'journey'`, `reward_reason 'journey_milestone'`/`'journey_completed'` — so live queries run on untyped columns and several `n.type === …` comparisons are dead TS branches. Fix: regenerate types against current migrations.
- [ ] **85. Dead exports & scaffold barrel.** Zero-importer exports: `getJourney`/`useJourney` (dashboard), `completeOnboarding`/`OnboardingInput`, `homePathForRoles`/`primaryRole`/`SELF_GRANTABLE`/`APP_ROLE_TO_DB`/`DB_ROLE_TO_APP` (roles), `formatRoleLabel`, `EMPTY_SEARCH`, `topStyleSlugs`, `AiStatusChip`. The `data-access` barrel also re-exports never-implemented scaffold modules (`client` `createDataAccess` TODO, `hooks` `export {}`, `repositories`/`services` interfaces-only). Prune.
- [ ] **86. Orphaned "coming soon" stub routes.** `(modals)/filters.tsx`, `(tabs)/discover/map.tsx`, and `studio-dashboard/roster.tsx` are placeholders nothing navigates to (roster is the exception — see #51). Delete or implement.
- [ ] **87. Orphaned AI "queued generation" path.** `createAiPreview`/`uploadPreviewSource`/status `queued`/`source_idea_id` have no mobile caller (mobile only does on-device compositing), and `useAiPreviews` filters to rows with `resultImagePath`, so any queued row is permanently invisible. Prune or finish the pipeline.
  - Files: `packages/data-access/src/ai/index.ts:55,169`.

---

# DONE

## Round 2 fixes
- [x] **50.** Notification/reminder taps now deep-link — a `useNotificationRouting` hook (mounted in the Gate) handles both warm taps (`addNotificationResponseReceivedListener`) and cold starts (`getLastNotificationResponseAsync`), routing the payload via `notificationHref` (appointmentId/requestId/conversationId + type). Local reminders route out of the box; `notify-dispatch` now also puts `type`/`entityId` in the FCM `data` so typed pushes deep-link too (needs edge-function redeploy). (`apps/mobile/src/lib/use-notification-routing.ts`, `app/_layout.tsx`, `supabase/functions/notify-dispatch/index.ts`)
- [x] **49.** Chat messages now notify the recipient — a `trg_messages_notify` trigger inserts a `message` notification for each non-sender participant on every new message (skipping structured booking cards), which shows in the inbox and drives a push via the notify-dispatch webhook. Coalesced to one unread row per conversation (delete+insert still pushes per message). Opening a chat (or receiving one while open) clears the conversation's message notifications so the bell doesn't stay lit. (migration `20260720190000`, `packages/data-access/src/messaging/index.ts`; needs the notify-dispatch webhook wired for push — infra, per #13)
- [x] **48.** Offer creation is locked down — `offer_artist_write` now also requires the caller to hold the `artist` role **and** be the request's assigned artist (so a non-artist can't inject a direct offer and be minted as the appointment's artist), and `respond_offer` refuses an `offer.artist_id ≠ request.artist_id` mismatch. The `create_offer` RPC (SECURITY DEFINER) and legit self-withdraw are unaffected. (migration `20260720180000`)
- [x] **47.** `accept_reschedule` now wraps the time move in a handler that turns an overlap `exclusion_violation` (artist or client) into a clean "That time is no longer free — propose another slot." instead of a raw constraint error. (migration `20260720170000`)
- [x] **46.** "Mark completed" now unlocks only once the scheduled **end** has passed (was: session start), so a multi-hour session can't be completed a minute in and prematurely fire reviews/rewards/journey. No-show stays gated on session start (artist-only); either party may still complete after the end (keeps the seeker unblocked). Client-only, no migration. (`BookingDetailScreen.tsx`)
- [x] **45.** A seeker can no longer double-book themselves — added the symmetric `appointments_client_no_overlap` exclusion constraint (client + overlapping active bookings) and a friendly client-overlap pre-check in `respond_offer` (the constraint is the race backstop for both parties). The migration first auto-resolves pre-existing client overlaps (keeps the earliest) so it can be applied. (migration `20260720160000`)
- [x] **44.** `createOffer` can no longer resurrect a dead request — routed through a guarded, atomic `create_offer` RPC that locks the request row, refuses a closed one (`status not in pending/reviewing`), and only lets the assigned artist offer. Partly narrows #48's offer-injection vector for the app path (the RLS direct-insert tightening remains #48). (migration `20260720150000`, `packages/data-access/src/booking/index.ts`)
- [x] **43.** `submitReview` is now atomic — a single `submit_review` SECURITY DEFINER RPC writes the review + five dimension ratings in one transaction (derives artist/studio from the appointment, validates scores, authorizes the caller), so a partial write can't strand an un-retryable review. (migration `20260720140000`, `packages/data-access/src/booking/index.ts`)
- [x] **42.** Terminal appointment states are now final at the DB layer — a `BEFORE UPDATE` trigger rejects any status change out of cancelled/completed/no_show and only lets a reschedule acceptance move the time (closes the blanket party-update RLS hole for direct PATCH); the complete/cancel/no-show helpers also status-filter to active bookings and surface a clean error. (migration `20260720130000`, `packages/data-access/src/booking/index.ts`)
- [x] **41.** A pending reschedule can no longer un-complete a finished booking — a `BEFORE UPDATE` trigger clears `reschedule_*` on any terminal transition (RPC, direct update, or auto-complete cron), `accept_reschedule` refuses closed appointments, + one-time backfill; the UI reschedule box is gated on `active`. (migration `20260720120000`, `BookingDetailScreen.tsx`)
- [x] **77.** "Reschedule pending" chip no longer lingers on completed/archived bookings — resolved by the same #41 trigger clearing `reschedule_status` on close.

## Tier 1 — broken loops & dead-ends
- [x] **1.** Bookings auto-complete (daily cron) + seeker can mark completed + both nudged to review.
- [x] **2.** Declining a reschedule keeps the original time (`decline_reschedule`); separate from "Cancel appointment".
- [x] **4.** Studio stats attributed by `appointments.studio_id` — stable when the roster changes.
- [x] **6.** Rewards gated **seeker-only** (earn + spend RPCs require the seeker role).

## Tier 2 — functionality & engagement
- [x] **8a.** Idea keyword search matches title **and** description.
- [x] **8b.** "Designs" scope added to Discover (masonry grid + infinite scroll).
- [x] **10.** `save_count` shown (♥N tile badge + "N saves" line) + Recent/Popular sort.
- [x] **11.** Share + Message-artist shortcuts on idea/portfolio detail.
- [x] **12.** Style-filtered feed uses a server-side join — whole corpus reachable (no ~500 cap).
- [x] **13.** Push token-rotation sync (`syncPushRegistration`/`usePushSync`) + `notify-dispatch` observability.
- [x] **14.** Offers/requests expire (`expires_at` + hourly sweepers + countdown UI).
- [x] **15.** Notifications deep-link by payload (`notificationHref`). *(roster case regressed — see #51)*
- [x] **16.** Rail "See all" carries intent into Discover; style-quiz CTA when recs are empty.
- [x] **17.** Location dead-ends fixed (`SetLocationSheet`; actionable "Nearest"/distance chips).

## Tier 3 — studio dashboard depth
- [x] **18.** Studio period selector (This week/month/year) + trend arrows.
- [x] **19.** `no_show` set (artist "Mark as no-show") + surfaced across stats.
- [x] **20.** Per-artist cancellation-rate metric on roster cards.
- [x] **21.** Suspended cards show performance + reason/date + Message; stats include suspended.
- [x] **22.** Studio rating reconciled on own reviews — dashboard ↔ public page agree.
- [x] **23.** Applications inbox: count, pull-to-refresh, sort, inline portfolio; countdown-drift fixed.
- [x] **24.** Studio edit: logo upload, multi-interval hours, contact validation, currency picker.

## Tier 4 — polish, IA & appearance
- [x] **25.** Cancelled/no-show moved off Upcoming into an Archive tab.
- [x] **26.** Dead statuses now set (`rescheduled` on accept, `reviewing` on open, `no_show`).
- [x] **27.** Artist IA inverted — business **Home** tab + slimmed **Profile**.
- [x] **28.** "Create" tab → **"Try on"**; honest non-AI copy; orphan create-idea modal deleted.
- [x] **29.** Messaging polish: paging/load-earlier, signed-URL cache, voice cancel, visible delete.
- [x] **31.** `Skeleton` + `EmptyState` primitives applied to Home/Discover/Bookings/Chats.
- [x] **32.** Dead `/studio-dashboard` → `<Redirect href="/" />`; `homePathForRoles` fixed.
- [x] **35.** Artist onboarding captures city/coords (distance-discoverable immediately).
- [x] **36.** "Let the studio choose" removed — studio bookings require picking a roster artist.
- [x] **37.** Local reminders reconciled by stable id (no blanket cancel; no prompt).
- [x] **38.** Double-booking guard: exclusion constraint + friendly `respond_offer` pre-check.
- [x] **39.** Multi-dimension seeker reviews written to the `ratings` table.
- [x] **40.** Studio reviews: rating distribution, "See all", review replies (`reply_to_review`).

## Shipped this session (not previously numbered)
- [x] Studio **Insights** page — completed-bookings drill-down (day/week/month, filters, 5/page pagination, "Total revenue").
- [x] Studio **Calendar** — month grid of upcoming + completed bookings with per-day detail.
- [x] Studio dashboard **split** → Studio home (identity + Overview) + **Team** tab (roster/suspended/reviews/settings).
- [x] **Flashes toggle** on Explore + Discover (with an infinite, keyset-paginated flash feed).
- [x] **Send a design to chat** — composer "saved designs" picker + "Send to artist" on design detail (with confirm).
- [x] **Try-on from saved** — "Saved" picker in the try-on flow + "Try on" on saved flashes; artist **Saved designs** view.
- [x] Studio overview first period = **This week** (week-to-date).
- [x] App-wide **Pager scroll-to-top** on page change; **reviews pagination** (studio + artist).
- [x] Duplicate **appointment-reminder** fix (serialized reconcile).
- [x] Chat **header resolves** for freshly-started conversations.
- [x] Artist availability supports **split shifts** (parity with studios).

# DEFERRED
- [~] **3.** Deposits are threatened in copy but never collected — remove the language or wire payments. (no payments yet)
- [~] **5.** No post-onboarding role elevation ("Become an artist / Register a studio" in settings). (product: no in-app elevation)
- [~] **7.** Delete account lives under Legal/Help, not Account Settings (GDPR/App-Store surfacing).
- [~] **33.** Solo owner-operator has no path (owner who also tattoos). (product: use a separate artist account)
- [~] **34.** Moderator role has no mobile surface — moderation is unimplemented end-to-end; RLS still protects content.
