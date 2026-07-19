-- =====================================================================
-- DEMO: Studio insights — completed-bookings history for "Iron Lotus"
--   Run in the hosted project's SQL Editor (runs as postgres → bypasses RLS).
--   Prereq: studio-owner-demo.sql (creates the studio + roster) and migration
--           20260719120000_studio_completed_bookings.sql.
--
--   Fills the studio insights page (tap "See all completed bookings" on the
--   dashboard) with a realistic spread of COMPLETED bookings so the day / week /
--   month filters all show data: a few today & yesterday, several this week,
--   more this month, and a long tail over the last ~5 months. Each booking has a
--   random roster artist, seeker client, session length, price, and a linked
--   request (placement / size / colour / title) so every detail chip renders.
--
--   Idempotent: it deletes its own previously-seeded rows (tagged
--   appointments.notes = 'insights-demo' and appointment_requests.description =
--   'insights-demo-req') before re-inserting, so re-running just refreshes them.
-- =====================================================================
do $$
declare
  v_studio  uuid := 'e1000000-0000-4000-8000-000000000001';
  v_owner   uuid := 'e0000000-0000-4000-8000-000000000001';
  v_artists uuid[];
  v_clients uuid[];
  v_offsets int[] := array[]::int[];
  v_off     int;
  v_art     uuid;
  v_cli     uuid;
  v_dur     int;
  v_hh      int;
  v_mm      int;
  v_rate    int;
  v_price   numeric;
  v_start   timestamptz;
  v_end     timestamptz;
  v_req     uuid;
  i         int;
  placements text[] := array['Forearm','Upper arm','Calf','Thigh','Back','Shoulder','Ribs','Ankle','Hand','Chest','Neck','Sternum'];
  sizes      text[] := array['Small (~5cm)','Medium (~12cm)','Large (~20cm)','Half sleeve','Palm-sized','A5 sheet'];
  titles     text[] := array['Fine-line floral','Blackwork mandala','Neo-traditional rose','Geometric dotwork','Minimal script','Snake & peony','Ornamental band','Portrait study','Botanical spray','Wave & koi','Lettering piece','Abstract linework'];
  durations  int[]  := array[60,90,120,150,180,210,240,300];
begin
  -- Active roster + a seeker client pool.
  select array_agg(artist_id) into v_artists
  from public.studio_memberships where studio_id = v_studio and status = 'active';

  select array_agg(id) into v_clients from (
    select id from public.profiles
    where id not in (select id from public.artists) and id <> v_owner
    order by created_at limit 12
  ) q;

  if v_artists is null or array_length(v_artists, 1) < 1
     or v_clients is null or array_length(v_clients, 1) < 1 then
    raise notice 'insights-demo: no roster or clients to seed; skipping';
    return;
  end if;

  -- Clear anything this script seeded before (keep real bookings untouched).
  delete from public.appointments
    where studio_id = v_studio and notes = 'insights-demo';
  delete from public.appointment_requests
    where studio_id = v_studio and description = 'insights-demo-req';

  -- Build a spread of day-offsets so every filter grain has data.
  for i in 1..4  loop v_offsets := v_offsets || 0; end loop;                       -- today
  for i in 1..3  loop v_offsets := v_offsets || 1; end loop;                       -- yesterday
  for i in 1..10 loop v_offsets := v_offsets || (2 + trunc(random() * 5))::int; end loop;   -- rest of this week
  for i in 1..25 loop v_offsets := v_offsets || trunc(random() * 30)::int; end loop;        -- this month
  for i in 1..40 loop v_offsets := v_offsets || trunc(random() * 150)::int; end loop;       -- last ~5 months

  foreach v_off in array v_offsets loop
    v_art   := v_artists[1 + trunc(random() * array_length(v_artists, 1))::int];
    v_cli   := v_clients[1 + trunc(random() * array_length(v_clients, 1))::int];
    v_dur   := durations[1 + trunc(random() * array_length(durations, 1))::int];
    -- Keep today's sessions in the morning so they read as already completed.
    v_hh    := case when v_off = 0 then 9 + trunc(random() * 4)::int else 10 + trunc(random() * 7)::int end;
    v_mm    := (array[0, 30])[1 + trunc(random() * 2)::int];
    v_rate  := 80 + trunc(random() * 70)::int;                                     -- per-hour rate
    v_price := round((v_dur / 60.0) * v_rate / 5.0) * 5;                           -- nearest 5
    v_start := date_trunc('day', now()) - (v_off || ' days')::interval
               + make_interval(hours => v_hh, mins => v_mm);
    v_end   := v_start + make_interval(mins => v_dur);

    insert into public.appointment_requests
      (id, client_id, artist_id, studio_id, title, description, placement, approx_size, is_color, status, created_at)
    values
      (gen_random_uuid(), v_cli, v_art, v_studio,
       titles[1 + trunc(random() * array_length(titles, 1))::int],
       'insights-demo-req',
       placements[1 + trunc(random() * array_length(placements, 1))::int],
       sizes[1 + trunc(random() * array_length(sizes, 1))::int],
       random() < 0.5,
       'converted',
       v_start - interval '7 days')
    returning id into v_req;

    insert into public.appointments
      (id, request_id, client_id, artist_id, studio_id, scheduled_start, scheduled_end,
       status, price_amount, completed_at, notes)
    values
      (gen_random_uuid(), v_req, v_cli, v_art, v_studio, v_start, v_end,
       'completed', v_price, v_end, 'insights-demo');
  end loop;

  raise notice 'insights-demo: seeded % completed bookings for Iron Lotus', array_length(v_offsets, 1);
end $$;
