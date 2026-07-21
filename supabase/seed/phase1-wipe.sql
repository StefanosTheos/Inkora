-- =====================================================================
-- PHASE 1 — FULL DATA WIPE  (pre-tester reseed)
-- Run in the hosted project's SQL Editor (runs as postgres → bypasses RLS).
--
-- Removes ALL user + content data so the app is fully empty: every login
-- account (auth.users), profile, artist, studio, appointment, booking request,
-- offer, review, conversation, message, tattoo journey, reward ledger,
-- notification, favorite, saved design, board, AI preview, device token, etc.
--
-- KEEPS the reference / config data the app depends on:
--   * tattoo_styles   — the style taxonomy (referenced everywhere)
--   * promotions      — home-screen banners
--   * vouchers        — the rewards catalog
--   * uploaded storage assets (styles/*.jpg) — untouched (this is data only)
--
-- ⚠️  This deletes EVERY account, including any you created yourself. After
--     Phase 2 you sign in with the new tester accounts.
--
-- WHY THE ORDER: three FK edges are ON DELETE RESTRICT / NO ACTION and would
-- block a blanket delete while data exists —
--   studios.owner_id → profiles          RESTRICT
--   appointments.client_id → profiles    RESTRICT
--   appointments.artist_id → artists     RESTRICT
--   studio_memberships.invited_by → profiles  NO ACTION
-- so we clear those parents first, then delete auth.users, which cascades
-- profiles → artists → every remaining ON DELETE CASCADE child.
-- =====================================================================
begin;

-- 1) Appointments — client_id & artist_id are RESTRICT. Deleting these also
--    cascades reviews, client_reviews, ratings and journey_milestones, and
--    SET-NULLs journey-entry / message / price-estimation back-references.
delete from public.appointments;

-- 2) Studios — owner_id is RESTRICT. Cascades studio_memberships (clearing the
--    invited_by NO ACTION edge too).
delete from public.studios;

-- 3) Conversations — created_by is SET NULL, so these would NOT auto-delete when
--    profiles go. Deleting them cascades conversation_participants + messages.
delete from public.conversations;

-- 4) Rows that reference profiles only via SET NULL or a polymorphic id, so they
--    would linger as orphans through the profile cascade — clear explicitly.
delete from public.profile_visits;
delete from public.audit_log;

-- 5) Now nothing blocks the root delete. Removing the auth users cascades:
--    profiles → artists → role_grants, artist_styles, artist_availability,
--    artist_unavailable_dates, artist_offers, portfolios, portfolio_images,
--    appointment_requests, offers, price_estimations, tattoo_ideas, idea_styles,
--    user_style_preferences, favorites, saved_designs, boards, ai_previews,
--    reward_points, reward_transactions, referral_codes, referrals,
--    voucher_redemptions, notifications, notification_preferences, device_tokens,
--    tattoo_journey_entries, profiles_private (+ auth.identities / sessions).
delete from auth.users;

commit;

-- ---------------------------------------------------------------------
-- Sanity check (optional) — every count below should be 0, and the three
-- KEPT reference tables should be non-zero.
-- ---------------------------------------------------------------------
-- select
--   (select count(*) from auth.users)               as users,
--   (select count(*) from public.profiles)          as profiles,
--   (select count(*) from public.artists)           as artists,
--   (select count(*) from public.studios)           as studios,
--   (select count(*) from public.appointments)      as appointments,
--   (select count(*) from public.appointment_requests) as requests,
--   (select count(*) from public.reviews)           as reviews,
--   (select count(*) from public.conversations)     as conversations,
--   (select count(*) from public.messages)          as messages,
--   (select count(*) from public.tattoo_ideas)      as ideas,
--   (select count(*) from public.tattoo_journey_entries) as journeys,
--   (select count(*) from public.notifications)     as notifications,
--   (select count(*) from public.tattoo_styles)     as styles_kept,
--   (select count(*) from public.vouchers)          as vouchers_kept,
--   (select count(*) from public.promotions)        as promotions_kept;
