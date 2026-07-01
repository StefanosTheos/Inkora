-- =====================================================================
-- 0012  TATTOO JOURNEY ENTRIES (private user timeline)
-- =====================================================================
create table public.tattoo_journey_entries (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  artist_id      uuid references public.artists(id) on delete set null,
  idea_id        uuid references public.tattoo_ideas(id) on delete set null,
  entry_type     journey_entry_type not null,
  title          text,
  notes          text,
  image_paths    text[] not null default '{}',
  occurred_on    date not null,
  created_at     timestamptz not null default now()
);
create index idx_journey_profile on public.tattoo_journey_entries (profile_id, occurred_on desc);
