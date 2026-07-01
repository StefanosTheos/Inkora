-- =====================================================================
-- 0026  ARTIST SEARCH — Postgres full-text search + filters + geo + sort
-- =====================================================================

-- trigram index accelerates partial (search-as-you-type) name matching
create index if not exists idx_profiles_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);

-- search_artists: FTS over name+headline+style names, filterable by style/distance/
-- rating/availability, sortable by relevance|distance|rating. Offset-paginated.
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
  id uuid,
  display_name text,
  avatar_path text,
  headline text,
  rating_avg numeric,
  rating_count int,
  city text,
  styles text[],
  distance_km double precision,
  is_accepting boolean,
  relevance real
)
language sql
stable
set search_path = public, extensions
as $$
  with base as (
    select
      a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count,
      p.city, a.is_accepting, p.latitude, p.longitude,
      array_remove(array_agg(distinct ts.slug::text), null) as styles,
      to_tsvector('simple',
        coalesce(p.display_name, '') || ' ' || coalesce(a.headline, '') || ' ' ||
        coalesce(string_agg(distinct ts.name, ' '), '')) as tsv
    from artists a
    join profiles p on p.id = a.id
    left join artist_styles ast on ast.artist_id = a.id
    left join tattoo_styles ts on ts.id = ast.style_id
    group by a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count,
             p.city, a.is_accepting, p.latitude, p.longitude
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
