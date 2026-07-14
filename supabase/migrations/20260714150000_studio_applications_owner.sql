-- =====================================================================
-- 0053  STUDIO OWNER: applications inbox + 5-day auto-reject
--   respond_studio_application (owner accept/reject) already exists. This adds
--   the owner-side LIST RPC and a daily cron that auto-rejects applications
--   left unanswered for 5 days, so the artist can move on to another studio.
-- =====================================================================
set search_path = public, extensions;

-- ---- pending applications for a studio (owner view) -----------------
create or replace function public.studio_applications(p_studio_id uuid)
returns table (
  artist_id    uuid,
  display_name text,
  avatar_path  text,
  headline     text,
  rating_avg   numeric,
  rating_count int,
  applied_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count, m.created_at
  from studio_memberships m
  join artists a on a.id = m.artist_id
  join profiles p on p.id = a.id
  where m.studio_id = p_studio_id and m.status = 'requested'
    and public.is_studio_admin(p_studio_id)
  order by m.created_at asc;
$$;
grant execute on function public.studio_applications(uuid) to authenticated;

-- ---- auto-reject applications older than 5 days ---------------------
create or replace function public.auto_reject_studio_applications()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select studio_id, artist_id from studio_memberships
    where status = 'requested' and created_at < now() - interval '5 days'
  loop
    update studio_memberships
       set status = 'removed', updated_at = now()
     where studio_id = r.studio_id and artist_id = r.artist_id and status = 'requested';
    perform public.push_notification(
      r.artist_id, 'membership_request', 'Application expired',
      'Your application wasn''t answered within 5 days — you''re free to apply to another studio.',
      'studio', r.studio_id, jsonb_build_object('kind', 'application_expired'));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.auto_reject_studio_applications() from public, anon, authenticated;

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('auto-reject-studio-applications');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'auto-reject-studio-applications',
  '0 3 * * *',
  $cron$ select public.auto_reject_studio_applications(); $cron$
);
