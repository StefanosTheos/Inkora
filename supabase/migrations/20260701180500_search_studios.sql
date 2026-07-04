-- =====================================================================
-- 0041  Studio search RPC (mirror of search_artists, for the Discover tab)
-- =====================================================================
-- Studios have no ratings/styles of their own, so both are derived from the
-- active roster: styles = union of member artists' styles; rating = the
-- roster's review-count-weighted average. Full-text over name/bio/city.
-- Rating and styles are aggregated in SEPARATE CTEs so the artist×style
-- fan-out doesn't double-count each artist's reviews. Offset-paginated with a
-- deterministic id tiebreaker; security definer so roster aggregation isn't
-- affected by per-viewer RLS.
set search_path = public, extensions;

create or replace function public.search_studios(
  p_q           text default '',
  p_style_slugs text[] default '{}',
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_radius_km   double precision default null,
  p_min_rating  numeric default 0,
  p_sort        text default 'relevance',
  p_limit       int default 20,
  p_offset      int default 0
)
returns table (
  id uuid, name text, slug text, logo_path text, city text,
  styles text[], distance_km double precision, artist_count int,
  rating_avg numeric, rating_count int, relevance real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with roster as ( -- one row per active (studio, artist)
    select sm.studio_id, a.id as artist_id, a.rating_avg, a.rating_count
    from studio_memberships sm
    join artists a on a.id = sm.artist_id
    where sm.status = 'active'
  ),
  studio_rating as (
    select studio_id,
      count(*)::int as artist_count,
      case when sum(rating_count) > 0
        then round((sum(rating_avg * rating_count) / sum(rating_count))::numeric, 2)
        else 0 end as rating_avg,
      coalesce(sum(rating_count), 0)::int as rating_count
    from roster group by studio_id
  ),
  studio_styles as (
    select r.studio_id, array_remove(array_agg(distinct ts.slug::text), null) as styles
    from roster r
    join artist_styles ast on ast.artist_id = r.artist_id
    join tattoo_styles ts on ts.id = ast.style_id
    group by r.studio_id
  ),
  base as (
    select
      s.id, s.name, s.slug::text as slug, s.logo_path, s.city, s.latitude, s.longitude,
      to_tsvector('simple',
        coalesce(s.name, '') || ' ' || coalesce(s.bio, '') || ' ' || coalesce(s.city, '')) as tsv,
      coalesce(ss.styles, '{}') as styles,
      coalesce(sr.artist_count, 0) as artist_count,
      coalesce(sr.rating_avg, 0) as rating_avg,
      coalesce(sr.rating_count, 0) as rating_count
    from studios s
    left join studio_rating sr on sr.studio_id = s.id
    left join studio_styles ss on ss.studio_id = s.id
    where s.is_active
  )
  select
    b.id, b.name, b.slug, b.logo_path, b.city, b.styles,
    case when p_lat is not null and b.latitude is not null then
      round((st_distance(
        st_setsrid(st_makepoint(b.longitude, b.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1)::double precision
    end as distance_km,
    b.artist_count, b.rating_avg, b.rating_count,
    case when p_q <> '' then ts_rank(b.tsv, websearch_to_tsquery('simple', p_q)) else 0 end as relevance
  from base b
  where
    (p_q = '' or b.tsv @@ websearch_to_tsquery('simple', p_q) or b.name ilike '%' || p_q || '%')
    and (cardinality(p_style_slugs) = 0 or b.styles && p_style_slugs)
    and (p_min_rating = 0 or b.rating_avg >= p_min_rating)
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
    b.rating_avg desc nulls last,
    b.id desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
