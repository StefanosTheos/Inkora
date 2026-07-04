-- =====================================================================
-- 0039  Search: deterministic ordering + keyset pagination for rating sort
-- =====================================================================
-- Two problems with the previous search_artists:
--   1. No unique final tiebreaker, so rows with equal sort keys (e.g. the many
--      artists sharing rating_avg = 0) could be skipped or duplicated across
--      offset pages. Fixed by appending `b.id desc` to every sort.
--   2. Deep pages under the "rating" sort paid an OFFSET scan. Added optional
--      keyset params (p_after_rating, p_after_id) so the client can fetch the
--      next page by cursor instead — O(rows returned), not O(offset).
-- Relevance (computed ts_rank) and distance (computed geography, nullable) keep
-- offset pagination: keyset over a computed/nullable key is fragile and offset
-- is the conventional choice for relevance-ranked results.
set search_path = public, extensions;

-- Adding the two keyset params changes the argument signature, so this is a NEW
-- overload rather than a replacement — Postgres keys functions by (name, arg
-- types). Drop the previous 10-arg version first, otherwise PostgREST sees two
-- candidates and fails every call with PGRST203 ("could not choose the best
-- candidate function").
drop function if exists public.search_artists(
  text, text[], double precision, double precision, double precision,
  numeric, boolean, text, integer, integer
);

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
  p_offset         int default 0,
  p_after_rating   numeric default null,   -- keyset cursor (rating sort only)
  p_after_id       uuid default null
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
    -- keyset continuation for the rating sort: rows strictly "after" the cursor
    -- under (rating_avg desc, id desc). No-op for other sorts / first page.
    and (
      p_sort <> 'rating' or p_after_id is null or
      (coalesce(b.rating_avg, 0), b.id) < (coalesce(p_after_rating, 0), p_after_id)
    )
  order by
    (case when p_sort = 'distance' then
      round((st_distance(
        st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1) end) asc nulls last,
    (case when p_sort = 'rating' then coalesce(b.rating_avg, 0) end) desc nulls last,
    (case when p_sort = 'relevance' and p_q <> '' then ts_rank(b.tsv, websearch_to_tsquery('simple', p_q)) end) desc nulls last,
    b.rating_avg desc nulls last,
    b.id desc  -- deterministic unique tiebreaker (stabilises pagination)
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
