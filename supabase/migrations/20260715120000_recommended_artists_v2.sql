-- =====================================================================
-- 0035  RECOMMENDED ARTISTS v2 — weight-aware + rating-confidence + proximity
-- ---------------------------------------------------------------------
-- Replaces the flat style-overlap ranking (count of matching slugs, then raw
-- rating) with a scored match that reflects how strongly the user prefers each
-- style and how trustworthy an artist's rating is:
--   * weighted style fit — Σ(pref weight) over matching styles, as a share of
--     the user's total taste, so a LOVE (weight 3) outweighs a LIKE (weight 1).
--   * Bayesian-shrunk rating — review volume matters, so a 5.0 from 1 review
--     doesn't beat a 4.8 from 200.
--   * proximity — nearer artists rank higher, using the artist's active studio
--     location (public). Neutral when the user's location is unknown.
-- Also returns matched_styles + distance_km so the app can EXPLAIN each match.
-- =====================================================================

-- Old flat-overlap signature is replaced by the weighted one below.
drop function if exists public.recommended_artists(text[], int);

create or replace function public.recommended_artists(
  p_style_slugs   text[],
  p_style_weights numeric[] default null,        -- aligned with p_style_slugs; defaults to 1 each
  p_lat           double precision default null,
  p_lng           double precision default null,
  p_limit         int default 10
)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  headline text,
  rating_avg numeric,
  rating_count int,
  match_count bigint,
  styles text[],
  matched_styles text[],
  distance_km double precision,
  score double precision
)
language sql
stable
set search_path = public
as $$
  with prefs as (
    select s.slug, coalesce(w.weight, 1)::numeric as weight
    from unnest(p_style_slugs) with ordinality as s(slug, ord)
    left join unnest(coalesce(p_style_weights, '{}'::numeric[])) with ordinality as w(weight, ord)
      on w.ord = s.ord
  ),
  total as (select coalesce(sum(weight), 0)::numeric as total_weight from prefs),
  dist as (
    -- distance to the artist's nearest active studio (public coordinates)
    select m.artist_id,
           min(st_distance(st.geo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0) as distance_km
    from studio_memberships m
    join studios st on st.id = m.studio_id
    where m.status = 'active' and p_lat is not null and p_lng is not null
    group by m.artist_id
  ),
  base as (
    select a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count,
           ts.slug, pr.weight as pref_weight
    from artists a
    join profiles p on p.id = a.id
    join artist_styles ast on ast.artist_id = a.id
    join tattoo_styles ts on ts.id = ast.style_id
    left join prefs pr on pr.slug = ts.slug
    where a.is_accepting
  ),
  agg as (
    select id, display_name, avatar_path, headline, rating_avg, rating_count,
           array_agg(distinct slug) as styles,
           array_remove(array_agg(distinct slug) filter (where pref_weight is not null), null) as matched_styles,
           count(*) filter (where pref_weight is not null) as match_count,
           coalesce(sum(pref_weight), 0)::numeric as matched_weight
    from base
    group by id, display_name, avatar_path, headline, rating_avg, rating_count
    having count(*) filter (where pref_weight is not null) > 0
  )
  select ag.id, ag.display_name, ag.avatar_path, ag.headline, ag.rating_avg, ag.rating_count,
         ag.match_count, ag.styles, coalesce(ag.matched_styles, '{}') as matched_styles,
         d.distance_km,
         (
             0.60 * least(1.0, ag.matched_weight / nullif((select total_weight from total), 0))
           + 0.25 * ((ag.rating_count * ag.rating_avg + 20 * 4.3) / (ag.rating_count + 20) / 5.0)
           + 0.15 * case when d.distance_km is null then 0.5
                         else greatest(0.0, 1.0 - least(d.distance_km, 100.0) / 100.0) end
         )::double precision as score
  from agg ag
  left join dist d on d.artist_id = ag.id
  order by score desc, ag.rating_avg desc nulls last, ag.rating_count desc
  limit greatest(p_limit, 1);
$$;
