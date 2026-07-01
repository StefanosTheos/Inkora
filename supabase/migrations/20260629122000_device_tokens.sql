-- =====================================================================
-- 0021  DEVICE TOKENS  (FCM push targets, one row per device install)
-- =====================================================================
create type device_platform as enum ('ios','android','web');

create table public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  fcm_token   text not null unique,             -- globally unique per device install
  platform    device_platform not null,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,                       -- set when FCM reports the token dead
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_device_tokens_updated before update on public.device_tokens
  for each row execute function public.set_updated_at();

-- fan-out reads only active tokens for a user
create index idx_device_tokens_active on public.device_tokens (profile_id) where disabled_at is null;

alter table public.device_tokens enable row level security;

-- a user manages only their own device tokens; service_role (Edge Functions) bypasses RLS
create policy device_tokens_owner on public.device_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
