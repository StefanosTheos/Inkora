-- =====================================================================
-- DEMO: Tattoo Studio Owner (loginable)
--   Run in the hosted project's SQL Editor (runs as postgres → bypasses RLS).
--   Prereq: migration 20260714140000_studio_owner_stats.sql must be applied
--   first (creates profile_visits + the studio stats RPCs).
--
--   Login:  studio@demo.inkora.dev  /  password123
--   Creates a studio "Iron Lotus" owned by that account, staffs it with a few
--   existing demo artists (top-rated), adds 2 pending applicants, and seeds
--   favourites / profile visits / bookings (scheduled, cancelled AND completed
--   with prices) / studio-tagged reviews / studio favourites so every dashboard
--   stat — including revenue, rating, recent reviews and "Saved by" — is
--   populated. Idempotent — safe to re-run.
-- =====================================================================

-- Fixed demo ids
--   owner user   : e0000000-0000-4000-8000-000000000001
--   studio       : e1000000-0000-4000-8000-000000000001

-- 1) Auth user + identity ---------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000001','authenticated','authenticated',
   'studio@demo.inkora.dev',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Nadia Vasquez"}', false, false)
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(),'e0000000-0000-4000-8000-000000000001',
   '{"sub":"e0000000-0000-4000-8000-000000000001","email":"studio@demo.inkora.dev"}',
   'email','studio@demo.inkora.dev', now(), now(), now())
on conflict do nothing;

-- Hosted GoTrue needs non-null token columns or sign-in errors.
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where id = 'e0000000-0000-4000-8000-000000000001';

-- 2) Roles + profile --------------------------------------------------
-- The signup trigger grants 'seeker'; a studio owner is 'studio_admin' only.
delete from public.role_grants where profile_id = 'e0000000-0000-4000-8000-000000000001' and role = 'seeker';
insert into public.role_grants (profile_id, role)
values ('e0000000-0000-4000-8000-000000000001','studio_admin')
on conflict (profile_id, role) do nothing;

update public.profiles
  set display_name = 'Nadia Vasquez', city = 'Athens', onboarded_at = coalesce(onboarded_at, now())
where id = 'e0000000-0000-4000-8000-000000000001';

-- 3) The studio -------------------------------------------------------
insert into public.studios
  (id, owner_id, name, slug, bio, city, country, latitude, longitude, opening_hours, is_active)
values
  ('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001',
   'Iron Lotus',
   'iron-lotus',
   'A collective of fine-line, blackwork and neo-traditional artists in the heart of Athens. By appointment.',
   'Athens','GR', 37.9838, 23.7275,
   '{"mon":[["11:00","19:00"]],"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","20:00"]],"fri":[["11:00","20:00"]],"sat":[["12:00","18:00"]]}'::jsonb,
   true)
on conflict (id) do update
  set name = excluded.name, bio = excluded.bio, opening_hours = excluded.opening_hours;

-- 4) Roster: top-rated existing artists become active members ---------
insert into public.studio_memberships (studio_id, artist_id, role, status, joined_at)
select 'e1000000-0000-4000-8000-000000000001', a.id, 'artist', 'active', now()
from public.artists a
order by a.rating_count desc nulls last, a.rating_avg desc nulls last
limit 4
on conflict (studio_id, artist_id) do update set status = 'active', joined_at = coalesce(public.studio_memberships.joined_at, now());

-- 5) Two more artists with PENDING applications -----------------------
insert into public.studio_memberships (studio_id, artist_id, role, status, created_at)
select 'e1000000-0000-4000-8000-000000000001', a.id, 'artist', 'requested', now() - (random() * interval '4 days')
from public.artists a
where a.id not in (select artist_id from public.studio_memberships where studio_id = 'e1000000-0000-4000-8000-000000000001')
order by a.rating_count desc nulls last
limit 2
on conflict (studio_id, artist_id) do nothing;

-- 6) Favourites of the member artists (saved_by) ----------------------
insert into public.favorites (profile_id, target_type, target_id)
select p.id, 'artist', m.artist_id
from (select artist_id from public.studio_memberships
        where studio_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active') m
cross join lateral (
  select id from public.profiles where id <> m.artist_id order by created_at limit 6
) p
on conflict (profile_id, target_type, target_id) do nothing;

-- 7) Favourites of the member artists' work (work_saves) --------------
insert into public.favorites (profile_id, target_type, target_id)
select p.id, 'portfolio_image', pi.id
from (select artist_id from public.studio_memberships
        where studio_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active') m
join lateral (select id from public.portfolio_images where artist_id = m.artist_id order by sort_order limit 2) pi on true
join lateral (select id from public.profiles where id <> m.artist_id order by created_at limit 4) p on true
on conflict (profile_id, target_type, target_id) do nothing;

-- 8) Profile visits (artist + studio) ---------------------------------
insert into public.profile_visits (target_type, target_id, viewer_id, created_at)
select 'artist', m.artist_id, p.id, now() - (random() * interval '12 days')
from (select artist_id from public.studio_memberships
        where studio_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active') m
cross join lateral (select id from public.profiles where id <> m.artist_id order by created_at limit 9) p;

insert into public.profile_visits (target_type, target_id, viewer_id, created_at)
select 'studio', 'e1000000-0000-4000-8000-000000000001', p.id, now() - (random() * interval '18 days')
from (select id from public.profiles
        where id <> 'e0000000-0000-4000-8000-000000000001' order by created_at limit 24) p;

-- 9) Bookings (completed w/ revenue + reviews, upcoming, cancelled) + studio
--    favourites. The booking/review part is guarded to run once; favourites
--    upsert — so the whole script stays idempotent.
do $$
declare
  v_studio  uuid := 'e1000000-0000-4000-8000-000000000001';
  v_owner   uuid := 'e0000000-0000-4000-8000-000000000001';
  clients   uuid[];
  m         record;
  v_appt    uuid;
  v_client  uuid;
  i         int;
  n         int := 0;
  titles    text[] := array['Incredible detail', 'Exactly what I wanted', 'Clean & professional', 'Worth every euro'];
  bodies    text[] := array['The studio was spotless and the artist nailed the design.',
                            'Welcoming space, great communication throughout.',
                            'Booked again already — fantastic experience.',
                            'Beautiful linework, healed perfectly.'];
begin
  -- a pool of seeker clients (non-artists, not the owner)
  select array_agg(id) into clients from (
    select id from public.profiles
    where id not in (select id from public.artists) and id <> v_owner
    order by created_at limit 6
  ) q;
  if clients is null or array_length(clients, 1) < 2 then
    return; -- no seekers to attribute revenue/reviews to
  end if;

  -- seed bookings once (skip if this studio already has any appointment)
  if not exists (
    select 1 from public.appointments ap
    join public.studio_memberships mm on mm.artist_id = ap.artist_id and mm.studio_id = v_studio and mm.status = 'active'
    where ap.studio_id = v_studio
  ) then
    for m in
      select artist_id from public.studio_memberships
      where studio_id = v_studio and status = 'active'
    loop
      -- 3 completed sessions (revenue) each with a studio-tagged review
      for i in 1..3 loop
        v_client := clients[1 + ((i - 1) % array_length(clients, 1))];
        v_appt := gen_random_uuid();
        insert into public.appointments (id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, completed_at)
        values (v_appt, v_client, m.artist_id, v_studio,
                now() - ((i * 21) || ' days')::interval,
                now() - ((i * 21) || ' days')::interval + interval '2 hours',
                'completed', 130 + i * 45 + (random() * 90)::int,
                now() - ((i * 21) || ' days')::interval + interval '2 hours');
        insert into public.reviews (appointment_id, author_id, artist_id, studio_id, overall_rating, title, body, is_published)
        values (v_appt, v_client, m.artist_id, v_studio, 4 + (i % 2), titles[1 + (i % 4)], bodies[1 + (i % 4)], true);
      end loop;

      -- one upcoming session
      insert into public.appointments (id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount)
      values (gen_random_uuid(), clients[1], m.artist_id, v_studio, now() + interval '6 days', now() + interval '6 days 2 hours', 'scheduled', 180);

      -- one cancelled for the first couple of artists
      if n < 2 then
        insert into public.appointments (id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, cancelled_at, cancellation_reason)
        values (gen_random_uuid(), clients[1], m.artist_id, v_studio, now() - interval '9 days', now() - interval '9 days' + interval '2 hours', 'cancelled', 160, now() - interval '10 days', 'Client rescheduled elsewhere');
      end if;
      n := n + 1;
    end loop;
  end if;

  -- studio favourites ("Saved by") — idempotent
  insert into public.favorites (profile_id, target_type, target_id)
  select unnest(clients), 'studio', v_studio
  on conflict (profile_id, target_type, target_id) do nothing;
end $$;
