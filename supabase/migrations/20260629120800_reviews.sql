-- =====================================================================
-- 0009  REVIEWS & RATINGS
-- =====================================================================
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  artist_id      uuid not null references public.artists(id) on delete cascade,
  studio_id      uuid references public.studios(id) on delete set null,
  overall_rating int  not null check (overall_rating between 1 and 5),
  title          text,
  body           text,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_reviews_updated before update on public.reviews
  for each row execute function public.set_updated_at();
create index idx_reviews_artist on public.reviews (artist_id) where is_published;

create table public.ratings (
  id        uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  dimension text not null check (dimension in ('quality','cleanliness','professionalism','communication','value')),
  score     int  not null check (score between 1 and 5),
  unique (review_id, dimension)
);
