-- =====================================================================
-- 0037  TRENDING ARTISTS = recent momentum (not all-time review count)
-- ---------------------------------------------------------------------
-- The old "trending" query ranked by cumulative all-time review count, so it
-- was really "most-reviewed ever" — static, and impossible for a new artist to
-- crack. This scores genuine recent momentum over a rolling window:
--       momentum = bookings×3 + reviews×2 + saves×1   (last N days)
-- Bookings are the strongest demand signal, then reviews, then saves.
--
-- SECURITY DEFINER: it must COUNT favourites and appointments across all users
-- (both RLS-restricted to their owners), but only ever returns aggregate counts
-- + public artist info — never any individual private row.
-- =====================================================================
create or replace function public.trending_artists(p_days int default 7, p_limit int default 10)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  headline text,
  rating_avg numeric,
  rating_count int,
  styles text[],
  momentum numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ts as (select now() - make_interval(days => greatest(p_days, 1)) as since),
  rev as (
    select r.artist_id, count(*)::numeric as n
    from public.reviews r
    where r.is_published and r.created_at >= (select since from ts)
    group by r.artist_id
  ),
  bk as (
    select a.artist_id, count(*)::numeric as n
    from public.appointments a
    where a.created_at >= (select since from ts) and a.status <> 'cancelled'
    group by a.artist_id
  ),
  sv as (
    -- saves of the artist directly, plus saves of any of their portfolio images
    select art.id as artist_id, count(*)::numeric as n
    from public.favorites f
    join public.artists art
      on (f.target_type = 'artist' and f.target_id = art.id)
      or (f.target_type = 'portfolio_image'
          and exists (select 1 from public.portfolio_images pi where pi.id = f.target_id and pi.artist_id = art.id))
    where f.created_at >= (select since from ts)
    group by art.id
  ),
  scored as (
    select art.id,
           coalesce(bk.n, 0) * 3 + coalesce(rev.n, 0) * 2 + coalesce(sv.n, 0) * 1 as momentum
    from public.artists art
    left join rev on rev.artist_id = art.id
    left join bk  on bk.artist_id  = art.id
    left join sv  on sv.artist_id  = art.id
  )
  select art.id, p.display_name, p.avatar_path, art.headline, art.rating_avg, art.rating_count,
         coalesce(array_remove(array_agg(distinct tsy.slug), null), '{}') as styles,
         sc.momentum
  from scored sc
  join public.artists art on art.id = sc.id
  join public.profiles p on p.id = art.id
  left join public.artist_styles ast on ast.artist_id = art.id
  left join public.tattoo_styles tsy on tsy.id = ast.style_id
  where sc.momentum > 0
  group by art.id, p.display_name, p.avatar_path, art.headline, art.rating_avg, art.rating_count, sc.momentum
  order by sc.momentum desc, art.rating_avg desc nulls last, art.rating_count desc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.trending_artists(int, int) to anon, authenticated;
