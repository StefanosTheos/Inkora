-- =====================================================================
-- 0042  artist_stats RPC — audience metrics for the artist dashboard
-- =====================================================================
-- Artists want to see how many people saved them and saved their designs, but
-- favorites are RLS-scoped to their owner (fav_owner), so a client can't count
-- other users' saves. Expose aggregate counts only, via a security-definer RPC
-- (no rows, no PII leak). Defaults to the calling artist.
set search_path = public, extensions;

create or replace function public.artist_stats(p_artist_id uuid default null)
returns table (saved_by int, design_saves int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    (select count(*) from favorites f
       where f.target_type = 'artist'
         and f.target_id = coalesce(p_artist_id, auth.uid()))::int as saved_by,
    (select count(*) from favorites f
       join tattoo_ideas i on i.id = f.target_id
       where f.target_type = 'idea'
         and i.source_artist_id = coalesce(p_artist_id, auth.uid()))::int as design_saves;
$$;
