-- =====================================================================
-- 0036  Geo privacy — move precise location off the public profile
-- =====================================================================
-- profiles_read_all exposes the whole profiles row (SELECT using true), so
-- every user's exact latitude/longitude (and birthdate) were world-readable.
-- Move those to an owner-only table. Proximity search still works because
-- search_artists now reads coordinates SERVER-SIDE (security definer) and
-- returns only a derived distance_km — raw coordinates never reach a client.
set search_path = public, extensions;

create table if not exists public.profiles_private (
  id         uuid primary key references public.profiles(id) on delete cascade,
  latitude   double precision,
  longitude  double precision,
  birthdate  date,
  updated_at timestamptz not null default now()
);
alter table public.profiles_private enable row level security;
drop policy if exists profiles_private_owner on public.profiles_private;
create policy profiles_private_owner on public.profiles_private for all
  using (id = auth.uid()) with check (id = auth.uid());
revoke select on public.profiles_private from anon; -- RLS also blocks; defense-in-depth

-- migrate existing coordinates/birthdate
insert into public.profiles_private (id, latitude, longitude, birthdate)
select id, latitude, longitude, birthdate from public.profiles
where latitude is not null or longitude is not null or birthdate is not null
on conflict (id) do nothing;

-- search_artists: read coords from profiles_private as owner (definer); the
-- RETURNS shape is unchanged and still exposes only distance_km.
create or replace function public.search_artists(
  p_q              text default '',
  p_style_slugs    text[] default '{}',
  p_lat            double precision default null,
  p_lng            double precision default null,
  p_radius_km      double precision default null,
  p_min_rating     numeric default 0,
  p_accepting_only boolean default false,
  p_sort           text default 'relevance',
  p_limit          int default 20,
  p_offset         int default 0
)
returns table (
  id uuid, display_name text, avatar_path text, headline text,
  rating_avg numeric, rating_count int, city text, styles text[],
  distance_km double precision, is_accepting boolean, relevance real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with base as (
    select
      a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count,
      p.city, a.is_accepting, pp.latitude, pp.longitude,
      array_remove(array_agg(distinct ts.slug::text), null) as styles,
      to_tsvector('simple',
        coalesce(p.display_name, '') || ' ' || coalesce(a.headline, '') || ' ' ||
        coalesce(string_agg(distinct ts.name, ' '), '')) as tsv
    from artists a
    join profiles p on p.id = a.id
    left join profiles_private pp on pp.id = a.id
    left join artist_styles ast on ast.artist_id = a.id
    left join tattoo_styles ts on ts.id = ast.style_id
    group by a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count,
             p.city, a.is_accepting, pp.latitude, pp.longitude
  )
  select
    b.id, b.display_name, b.avatar_path, b.headline, b.rating_avg, b.rating_count, b.city, b.styles,
    case when p_lat is not null and b.latitude is not null then
      round((st_distance(
        st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1)::double precision
    end as distance_km,
    b.is_accepting,
    case when p_q <> '' then ts_rank(b.tsv, websearch_to_tsquery('simple', p_q)) else 0 end as relevance
  from base b
  where
    (p_q = '' or b.tsv @@ websearch_to_tsquery('simple', p_q) or b.display_name ilike '%' || p_q || '%')
    and (cardinality(p_style_slugs) = 0 or b.styles && p_style_slugs)
    and (p_min_rating = 0 or b.rating_avg >= p_min_rating)
    and (not p_accepting_only or b.is_accepting)
    and (
      p_radius_km is null or p_lat is null or b.latitude is null or
      st_dwithin(
        st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
        p_radius_km * 1000)
    )
  order by
    (case when p_sort = 'distance' then
      round((st_distance(
        st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1) end) asc nulls last,
    (case when p_sort = 'rating' then b.rating_avg end) desc nulls last,
    (case when p_sort = 'relevance' and p_q <> '' then ts_rank(b.tsv, websearch_to_tsquery('simple', p_q)) end) desc nulls last,
    b.rating_avg desc nulls last
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- finally, remove the now-private columns from the public profiles row
alter table public.profiles
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists birthdate;
