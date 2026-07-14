-- =====================================================================
-- 0050  Public seeker profile — expose the bio
--   Seekers can set a bio (profiles.bio) but it was never surfaced on their
--   public profile. Add it to the read-only snapshot RPC. Recreated (not
--   replaced) because the OUT columns change.
-- =====================================================================
set search_path = public, extensions;

drop function if exists public.public_seeker_profile(uuid);
create function public.public_seeker_profile(p_profile_id uuid)
returns table (
  id             uuid,
  display_name   text,
  username       text,
  avatar_path    text,
  city           text,
  bio            text,
  member_since   timestamptz,
  bookings_count int,
  reviews_count  int
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.display_name,
    p.username::text,
    p.avatar_path,
    p.city,
    p.bio,
    p.created_at as member_since,
    (select count(*) from appointments a where a.client_id = p.id)::int as bookings_count,
    (select count(*) from reviews r where r.author_id = p.id and r.is_published)::int as reviews_count
  from profiles p
  where p.id = p_profile_id;
$$;

grant execute on function public.public_seeker_profile(uuid) to authenticated;
