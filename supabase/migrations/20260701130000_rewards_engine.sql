-- =====================================================================
-- 0031  REWARDS ENGINE  (points ledger RPC, auto-earn triggers,
--                        vouchers, referrals, profile-completion)
-- =====================================================================
-- The reward_points (materialized balance) + reward_transactions (ledger)
-- tables already exist (0010). This migration adds the *engine*: a single
-- privileged mint function, event triggers that earn points, a voucher
-- catalog + redemption, referrals, and profile-completion claims.
set search_path = public, extensions;

-- The atomic, idempotent ledger writer public.apply_reward_transaction(
--   p_profile_id, p_type, p_reason, p_amount, p_reference_type, p_reference_id, p_idempotency_key)
-- already exists (migration 0020) and is privileged (service_role only).
-- award_points is a thin SECURITY DEFINER wrapper for the *earn* path that
-- also drops a "+points" notification. It is NOT granted to authenticated —
-- only the triggers / RPCs below (which run as owner) may call it.
create or replace function public.award_points(
  p_profile uuid, p_reason reward_reason, p_amount int,
  p_ref_type text, p_ref_id uuid, p_idem text)
returns public.reward_transactions
language plpgsql security definer set search_path = public as $$
declare v_txn public.reward_transactions;
begin
  v_txn := public.apply_reward_transaction(p_profile, 'earn', p_reason, p_amount, p_ref_type, p_ref_id, p_idem);
  -- notify only on a fresh credit (idempotent replays return an older row)
  if v_txn.created_at > now() - interval '5 seconds' then
    perform public.push_notification(p_profile, 'reward', '+' || p_amount || ' points',
      initcap(replace(p_reason::text, '_', ' ')), 'reward', v_txn.id, '{}'::jsonb);
  end if;
  return v_txn;
end $$;

-- ---------------------------------------------------------------------
-- Auto-earn triggers
-- ---------------------------------------------------------------------
create or replace function public.trg_reward_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.id, 'signup', 100, 'profile', new.id, 'signup:' || new.id::text);
  return new;
end $$;
drop trigger if exists reward_signup on public.profiles;
create trigger reward_signup after insert on public.profiles
  for each row execute function public.trg_reward_signup();

create or replace function public.trg_reward_save() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.profile_id, 'save', 5, 'favorite', new.id, 'save:' || new.id::text);
  return new;
end $$;
drop trigger if exists reward_save on public.favorites;
create trigger reward_save after insert on public.favorites
  for each row execute function public.trg_reward_save();

create or replace function public.trg_reward_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(new.author_id, 'review_left', 50, 'review', new.id, 'review:' || new.id::text);
  return new;
end $$;
drop trigger if exists reward_review on public.reviews;
create trigger reward_review after insert on public.reviews
  for each row execute function public.trg_reward_review();

create or replace function public.trg_reward_booking_completed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.award_points(new.client_id, 'booking_completed', 150, 'appointment', new.id, 'booking_done_client:' || new.id::text);
    perform public.award_points(new.artist_id, 'booking_completed', 150, 'appointment', new.id, 'booking_done_artist:' || new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists reward_booking_completed on public.appointments;
create trigger reward_booking_completed after update on public.appointments
  for each row execute function public.trg_reward_booking_completed();

-- ---------------------------------------------------------------------
-- Daily active bonus (client calls once per app-open; capped 1/day via idem)
-- ---------------------------------------------------------------------
create or replace function public.award_daily_active()
returns public.reward_transactions
language plpgsql security definer set search_path = public as $$
begin
  return public.award_points(auth.uid(), 'daily_active', 10, 'daily', null,
    'daily:' || auth.uid()::text || ':' || current_date::text);
end $$;
grant execute on function public.award_daily_active() to authenticated;

-- ---------------------------------------------------------------------
-- Profile-completion: award once per completed item; report % complete.
-- ---------------------------------------------------------------------
create or replace function public.claim_profile_completion()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  v_me uuid := auth.uid();
  a bool; b bool; c bool; u bool; o bool;
  done int := 0;
begin
  select * into p from public.profiles where id = v_me;
  a := p.avatar_path is not null;
  b := coalesce(length(btrim(p.bio)), 0) > 0;
  c := coalesce(length(btrim(p.city)), 0) > 0;
  u := p.username is not null;
  o := p.onboarded_at is not null;
  if a then perform public.award_points(v_me, 'signup', 25, 'profile_item', v_me, 'profile:avatar:' || v_me::text); done := done + 1; end if;
  if b then perform public.award_points(v_me, 'signup', 25, 'profile_item', v_me, 'profile:bio:' || v_me::text); done := done + 1; end if;
  if c then perform public.award_points(v_me, 'signup', 15, 'profile_item', v_me, 'profile:city:' || v_me::text); done := done + 1; end if;
  if u then perform public.award_points(v_me, 'signup', 15, 'profile_item', v_me, 'profile:username:' || v_me::text); done := done + 1; end if;
  if o then perform public.award_points(v_me, 'signup', 40, 'profile_item', v_me, 'profile:onboarding:' || v_me::text); done := done + 1; end if;
  return jsonb_build_object(
    'avatar', a, 'bio', b, 'city', c, 'username', u, 'onboarding', o,
    'completed', done, 'total', 5, 'pct', round(done * 100.0 / 5));
end $$;
grant execute on function public.claim_profile_completion() to authenticated;

-- ---------------------------------------------------------------------
-- VOUCHERS  (redeemable catalog + per-user redemptions)
-- ---------------------------------------------------------------------
create table if not exists public.vouchers (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  kind          text not null default 'perk',       -- perk | discount | merch
  value_text    text,                                -- e.g. "10% off your next tattoo"
  cost_points   int not null check (cost_points > 0),
  stock         int,                                 -- null = unlimited
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.voucher_redemptions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  voucher_id   uuid not null references public.vouchers(id) on delete restrict,
  code         text not null unique,
  cost_points  int not null,
  status       text not null default 'active',       -- active | used | expired
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  used_at      timestamptz
);
create index if not exists idx_voucher_redemptions_profile on public.voucher_redemptions (profile_id, created_at desc);

alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;
drop policy if exists vouchers_read on public.vouchers;
create policy vouchers_read on public.vouchers for select using (is_active);
drop policy if exists redemptions_read on public.voucher_redemptions;
create policy redemptions_read on public.voucher_redemptions for select using (profile_id = auth.uid());

create or replace function public.redeem_voucher(p_voucher uuid)
returns public.voucher_redemptions
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.vouchers%rowtype;
  v_me uuid := auth.uid();
  v_code text;
  v_red public.voucher_redemptions;
begin
  select * into v from public.vouchers where id = p_voucher and is_active for update;
  if not found then raise exception 'voucher_unavailable'; end if;
  if v.stock is not null and v.stock <= 0 then raise exception 'out_of_stock'; end if;

  -- spend points (raises insufficient_points when short)
  perform public.apply_reward_transaction(v_me, 'redeem', 'redemption', -v.cost_points, 'voucher', p_voucher,
    'voucher:' || gen_random_uuid()::text);
  if v.stock is not null then update public.vouchers set stock = stock - 1 where id = p_voucher; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.voucher_redemptions (profile_id, voucher_id, code, cost_points, expires_at)
    values (v_me, p_voucher, v_code, v.cost_points, now() + interval '90 days')
    returning * into v_red;
  return v_red;
end $$;
grant execute on function public.redeem_voucher(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- REFERRALS  (one code per user; both sides earn on redemption)
-- ---------------------------------------------------------------------
create table if not exists public.referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  code        text not null,
  rewarded    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create index if not exists idx_referrals_referrer on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes for select using (profile_id = auth.uid());
drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select
  using (referrer_id = auth.uid() or referred_id = auth.uid());

create or replace function public.get_referral_code()
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  select code into v_code from public.referral_codes where profile_id = auth.uid();
  if v_code is not null then return v_code; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.referral_codes (profile_id, code) values (auth.uid(), v_code)
    on conflict (profile_id) do update set code = public.referral_codes.code
    returning code into v_code;
  return v_code;
end $$;
grant execute on function public.get_referral_code() to authenticated;

create or replace function public.redeem_referral(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_me uuid := auth.uid();
begin
  select profile_id into v_referrer from public.referral_codes where code = upper(btrim(p_code));
  if v_referrer is null then raise exception 'invalid_code'; end if;
  if v_referrer = v_me then raise exception 'cannot_refer_self'; end if;
  if exists (select 1 from public.referrals where referred_id = v_me) then raise exception 'already_referred'; end if;
  insert into public.referrals (referrer_id, referred_id, code) values (v_referrer, v_me, upper(btrim(p_code)));
  perform public.award_points(v_referrer, 'referral', 200, 'referral', v_me, 'ref_referrer:' || v_me::text);
  perform public.award_points(v_me, 'referral', 100, 'referral', v_referrer, 'ref_referred:' || v_me::text);
  update public.referrals set rewarded = true where referred_id = v_me;
end $$;
grant execute on function public.redeem_referral(text) to authenticated;

-- ---------------------------------------------------------------------
-- seed a small voucher catalog
-- ---------------------------------------------------------------------
insert into public.vouchers (title, description, kind, value_text, cost_points, sort_order) values
  ('€10 off your next tattoo', 'Redeemable with any participating Inkora artist.', 'discount', '€10 off', 300, 10),
  ('Priority booking', 'Skip the queue — your next request is flagged priority for 30 days.', 'perk', 'Priority for 30 days', 500, 20),
  ('Free aftercare kit', 'A premium tattoo aftercare kit shipped to you.', 'merch', 'Aftercare kit', 800, 30),
  ('€25 off a full sleeve', 'Applies to sessions over €300.', 'discount', '€25 off', 1200, 40)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- realtime: live balance + ledger on the dashboard
-- ---------------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.reward_points;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reward_transactions; exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- backfill signup bonus for existing profiles (idempotent)
-- ---------------------------------------------------------------------
do $$ declare r record; begin
  for r in select id from public.profiles loop
    perform public.apply_reward_transaction(r.id, 'earn', 'signup', 100, 'profile', r.id, 'signup:' || r.id::text);
  end loop;
end $$;
