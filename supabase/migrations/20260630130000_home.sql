-- =====================================================================
-- 0025  HOME PAGE support: promotions + nearby-studios geo RPC
--   (featured / trending / recommended artists reuse existing data)
-- =====================================================================

-- Marketing promo cards shown on Home.
create table public.promotions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  image_path text,
  cta_label  text,
  cta_route  text,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_promotions_active on public.promotions (sort_order) where is_active;

alter table public.promotions enable row level security;
-- world-readable when active and within its (optional) date window; writes are privileged.
create policy promotions_read on public.promotions for select
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- Studios nearest to a point, with distance in km. Ordered via the GiST geo index.
create or replace function public.nearby_studios(p_lat double precision, p_lng double precision, p_limit int default 10)
returns table (id uuid, name text, slug text, logo_path text, city text, distance_km double precision)
language sql
stable
set search_path = public, extensions
as $$
  select
    s.id, s.name, s.slug::text, s.logo_path, s.city,
    round((st_distance(s.geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1)::double precision
  from studios s
  where s.is_active
  order by s.geo <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit greatest(p_limit, 1);
$$;

-- Seed a few promos (image_path null -> UI renders a gradient fallback).
insert into public.promotions (title, subtitle, cta_label, cta_route, sort_order) values
  ('Find your artist', 'Browse top-rated tattoo artists near you', 'Explore', '/discover', 10),
  ('First tattoo?',    'Start with inspiration, then book a consult', 'Get inspired', '/', 20),
  ('Refer a friend',   'Earn reward points when they book',          'Learn more',  '/rewards', 30);
