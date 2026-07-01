-- =====================================================================
-- 0010  REWARDS  (materialized balance + append-only ledger)
-- =====================================================================
create table public.reward_points (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  balance           int not null default 0 check (balance >= 0),
  lifetime_earned   int not null default 0,
  lifetime_redeemed int not null default 0,
  tier              reward_tier not null default 'bronze',
  tier_updated_at   timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_reward_points_updated before update on public.reward_points
  for each row execute function public.set_updated_at();

create table public.reward_transactions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  type            reward_txn_type not null,
  reason          reward_reason   not null,
  amount          int not null,          -- signed: +earn / -redeem
  balance_after   int not null,
  reference_type  text,
  reference_id    uuid,
  idempotency_key text unique,           -- blocks double-credit on retry
  created_at      timestamptz not null default now()
);
create index idx_reward_txn_profile on public.reward_transactions (profile_id, created_at desc);
