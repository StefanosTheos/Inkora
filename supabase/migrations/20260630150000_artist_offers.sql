-- =====================================================================
-- 0027  ARTIST OFFERS (advertised packages/deals shown on the profile)
-- =====================================================================
create table public.artist_offers (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.artists(id) on delete cascade,
  title         text not null,
  description   text,
  price_amount  numeric(12,2),
  currency_code char(3) not null default 'EUR',
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index idx_artist_offers on public.artist_offers (artist_id) where is_active;

alter table public.artist_offers enable row level security;
create policy artist_offers_read on public.artist_offers for select
  using (is_active or artist_id = auth.uid());
create policy artist_offers_write on public.artist_offers for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

-- ---- seed offers for demo artists ----
insert into public.artist_offers (artist_id, title, description, price_amount, currency_code, sort_order) values
  ('a0000000-0000-4000-8000-000000000001','Fine-line flash','Palm-sized single-needle piece, one session', 120, 'EUR', 10),
  ('a0000000-0000-4000-8000-000000000001','Botanical half-sleeve','Custom botanical design, 2–3 sessions', 650, 'EUR', 20),
  ('a0000000-0000-4000-8000-000000000002','Blackwork day rate','Full-day blackwork session', 700, 'EUR', 10),
  ('a0000000-0000-4000-8000-000000000003','Realism consultation','30-min consult + design draft', 40, 'EUR', 10)
on conflict do nothing;

-- ---- seed weekly availability for demo artists (Mon–Fri) ----
insert into public.artist_availability (artist_id, day_of_week, start_time, end_time, timezone)
select a.id, d.dow, '11:00'::time, '19:00'::time, 'Europe/Athens'
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid),
  ('a0000000-0000-4000-8000-000000000002'::uuid),
  ('a0000000-0000-4000-8000-000000000003'::uuid)
) a(id)
cross join (values (1),(2),(3),(4),(5)) d(dow)
on conflict do nothing;
