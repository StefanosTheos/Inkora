-- =====================================================================
-- 0033  SEED: reviews, unique per-artist schedules, richer studio rosters
-- =====================================================================
-- Adds testable depth to the demo marketplace:
--   * reviewer customers + completed appointments + published reviews
--     (ratings recompute automatically via the sync_artist_rating trigger)
--   * a distinct weekly timetable for every demo artist
--   * more studio memberships incl. cross-studio guest spots
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Reviewer customers (seekers). handle_new_user() creates their profiles.
-- ---------------------------------------------------------------------
create temp table _cust (k int, id uuid, email text, name text, city text);
insert into _cust values
  (1,'c1000000-0000-4000-8000-000000000001','elani.rivers@inkora.dev','Elani Rivers','Athens'),
  (2,'c1000000-0000-4000-8000-000000000002','marco.bianchi@inkora.dev','Marco Bianchi','Berlin'),
  (3,'c1000000-0000-4000-8000-000000000003','yuki.tanaka@inkora.dev','Yuki Tanaka','London'),
  (4,'c1000000-0000-4000-8000-000000000004','fatima.noor@inkora.dev','Fatima Noor','Lisbon'),
  (5,'c1000000-0000-4000-8000-000000000005','liam.obrien@inkora.dev','Liam O''Brien','Barcelona'),
  (6,'c1000000-0000-4000-8000-000000000006','greta.hoffmann@inkora.dev','Greta Hoffmann','Amsterdam');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('display_name', name), false, false
from _cust
on conflict (id) do nothing;

update public.profiles p set display_name = c.name, city = c.city
from _cust c where p.id = c.id;

-- ---------------------------------------------------------------------
-- Review templates + demo artists ranked 1..12
-- ---------------------------------------------------------------------
create temp table _tpl (k int, rating int, title text, body text);
insert into _tpl values
  (1,5,'Absolutely worth it','Incredible linework and such a calm, professional session. Already planning my next piece.'),
  (2,5,'Exceeded expectations','Took my rough idea and turned it into something better than I imagined. Healed perfectly.'),
  (3,4,'Great experience','Really happy with the result. Studio was clean and the vibe was relaxed. Minor wait to book.'),
  (4,5,'A true artist','The detail is unreal. Sat for hours and barely noticed the time. Highly recommend.'),
  (5,4,'Solid work','Clean, precise and exactly what we discussed. Would come back for colour work.'),
  (6,3,'Good but pricey','Lovely design and friendly, though a little more than I expected to pay.');

create temp table _artists_rank (rn int, id uuid, tz text, days int[], open_h int, close_h int);
insert into _artists_rank values
  (1,'a1000000-0000-4000-8000-000000000001','Europe/Athens',   array[2,3,4,5,6],11,19),
  (2,'a1000000-0000-4000-8000-000000000002','Europe/Athens',   array[1,2,3,4,5],10,18),
  (3,'a1000000-0000-4000-8000-000000000003','Europe/Athens',   array[3,4,5,6,0],12,20),
  (4,'a1000000-0000-4000-8000-000000000004','Europe/Berlin',   array[2,3,4,5,6],12,20),
  (5,'a1000000-0000-4000-8000-000000000005','Europe/Berlin',   array[1,3,5,6],  11,19),
  (6,'a1000000-0000-4000-8000-000000000006','Europe/London',   array[4,5,6,0,1],11,20),
  (7,'a1000000-0000-4000-8000-000000000007','Europe/London',   array[2,3,4,5,6],10,18),
  (8,'a1000000-0000-4000-8000-000000000008','Europe/Lisbon',   array[1,2,3,4,5],11,19),
  (9,'a1000000-0000-4000-8000-000000000009','Europe/Lisbon',   array[3,4,5,6,0],13,21),
  (10,'a1000000-0000-4000-8000-000000000010','Europe/Madrid',  array[2,3,4,5,6],11,19),
  (11,'a1000000-0000-4000-8000-000000000011','Europe/Madrid',  array[1,2,4,5,6],10,18),
  (12,'a1000000-0000-4000-8000-000000000012','Europe/Amsterdam',array[3,4,5,6,0],12,20);

-- ---------------------------------------------------------------------
-- Reviews (each backed by a completed appointment). 3–5 per artist.
-- ---------------------------------------------------------------------
create temp table _seed_reviews (
  appt_id uuid default gen_random_uuid(),
  artist_id uuid, author_id uuid, rating int, title text, body text, days_ago int
);
insert into _seed_reviews (artist_id, author_id, rating, title, body, days_ago)
select ar.id, c.id, t.rating, t.title, t.body, ((ar.rn * 7 + t.k * 11) % 150) + 3
from _artists_rank ar
join _tpl t on t.k <= (3 + (ar.rn % 3))
join _cust c on c.k = ((ar.rn + t.k) % 6) + 1;

insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, created_at)
select appt_id, author_id, artist_id,
       now() - (days_ago || ' days')::interval,
       now() - (days_ago || ' days')::interval + interval '2 hours',
       'completed', 160, true,
       now() - (days_ago || ' days')::interval,
       now() - ((days_ago + 20) || ' days')::interval
from _seed_reviews
on conflict (id) do nothing;

insert into public.reviews
  (appointment_id, author_id, artist_id, overall_rating, title, body, is_published, created_at)
select appt_id, author_id, artist_id, rating, title, body, true,
       now() - (days_ago || ' days')::interval
from _seed_reviews
on conflict (appointment_id) do nothing;

-- ---------------------------------------------------------------------
-- Unique weekly timetable per artist (weekend opens later, Sat ends early)
-- ---------------------------------------------------------------------
delete from public.artist_availability
where artist_id in (select id from _artists_rank);

insert into public.artist_availability (artist_id, day_of_week, start_time, end_time, timezone)
select a.id, d.dow,
       make_time(a.open_h + (case when d.dow in (0, 6) then 1 else 0 end), 0, 0),
       make_time(a.close_h - (case when d.dow = 6 then 2 else 0 end), 0, 0),
       a.tz
from _artists_rank a, unnest(a.days) as d(dow)
on conflict (artist_id, day_of_week, start_time, end_time) do nothing;

-- ---------------------------------------------------------------------
-- Richer studio rosters + cross-studio guest spots
-- ---------------------------------------------------------------------
insert into public.studio_memberships (studio_id, artist_id, role, status, joined_at)
select s.id, e.artist_id::uuid, 'artist'::membership_role, 'active'::membership_status, now()
from (values
  ('kreuzberg-collective','a1000000-0000-4000-8000-000000000012'),
  ('east-end-electric',   'a1000000-0000-4000-8000-000000000003'),
  ('gotic-tattoo',        'a1000000-0000-4000-8000-000000000009'),
  ('ribeira-ink',         'a1000000-0000-4000-8000-000000000010'),
  ('northern-ink',        'a1000000-0000-4000-8000-000000000002'),
  ('canal-ink',           'a1000000-0000-4000-8000-000000000008'),
  ('blackline-athens',    'a1000000-0000-4000-8000-000000000005'),
  ('ink-iron-athens',     'a1000000-0000-4000-8000-000000000001'),
  ('ink-iron-athens',     'a1000000-0000-4000-8000-000000000002'),
  ('needle-thread-athens','a1000000-0000-4000-8000-000000000001'),
  ('needle-thread-athens','a1000000-0000-4000-8000-000000000004')
) e(slug, artist_id)
join public.studios s on s.slug = e.slug
on conflict (studio_id, artist_id) do nothing;
