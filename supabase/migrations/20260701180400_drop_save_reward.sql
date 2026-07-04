-- =====================================================================
-- 0040  Remove reward points for saving (favoriting)
-- =====================================================================
-- Saving an artist/idea/studio is a near-zero-effort action, so rewarding it
-- with redeemable points invites farming — a user can save every item once
-- (and even unsave them afterwards, keeping the points). Per-target idempotency
-- would only stop toggling a *single* item, not the save-everything farm.
-- Decision: saving is pure curation (a personal shortlist) and grants no points.
-- Points come from higher-intent actions that already exist: completing a
-- booking, leaving a review, referrals, profile completion, daily check-in.
-- Historical 'save' ledger entries are left untouched (no claw-back).
set search_path = public, extensions;

drop trigger if exists reward_save on public.favorites;
drop function if exists public.trg_reward_save();
