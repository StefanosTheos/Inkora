-- =====================================================================
-- REMOTE DEMO SEED (DEEP) — fills every surface with lots of data.
-- Idempotent (stable ids + ON CONFLICT DO NOTHING). Safe to re-run.
-- Run in the hosted project's SQL Editor (runs as postgres → bypasses RLS).
-- Companion to remote-demo.sql; assumes the style taxonomy + base demo data
-- already exist. Image paths reuse the uploaded styles/*.jpg so tiles render.
--
-- Includes a LOGIN-ABLE tester account for exercising the personal dashboard:
--     email: tester@demo.inkora.dev   password: password123
-- Delete later with: delete from auth.users where email like '%@demo.inkora.dev';
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1) MANY MORE ARTISTS  (12 in studios + 6 independent, all styles covered)
-- ---------------------------------------------------------------------
create temp table _a (
  rn int, id uuid, email text, name text, username text, city text, country char(2),
  lat double precision, lng double precision, tz text, headline text,
  years int, rate numeric, min_charge numeric, currency char(3), instagram text,
  verified boolean, rating numeric, rating_count int,
  styles text[], days int[], open_t time, close_t time
);
insert into _a values
  (1 ,'a3000000-0000-4000-8000-000000000001','iris.vale@demo.inkora.dev','Iris Vale','iris_vale','Athens','GR',37.9838,23.7275,'Europe/Athens','Botanical fine-line & ornamental',6,95,80,'EUR','iris.ink',true ,4.8,27,array['fineline','dotwork'],array[2,3,4,5,6],'11:00','19:00'),
  (2 ,'a3000000-0000-4000-8000-000000000002','dorian.feld@demo.inkora.dev','Dorian Feld','dorian_feld','Berlin','DE',52.5200,13.4050,'Europe/Berlin','Blackwork & ornamental patterns',9,120,110,'EUR','dorian.blk',false,4.6,19,array['blackwork','geometric'],array[1,2,3,4,5],'10:00','18:00'),
  (3 ,'a3000000-0000-4000-8000-000000000003','mara.sol@demo.inkora.dev','Mara Sol','mara_sol','Barcelona','ES',41.3874,2.1686,'Europe/Madrid','Vivid watercolor & fine-line',7,105,100,'EUR','mara.aqua',true ,4.9,41,array['watercolor','fineline'],array[2,3,4,5,6],'12:00','20:00'),
  (4 ,'a3000000-0000-4000-8000-000000000004','kaito.mori@demo.inkora.dev','Kaito Mori','kaito_mori','London','GB',51.5074,-0.1278,'Europe/London','Irezumi & neo-Japanese sleeves',12,150,160,'GBP','kaito.irezumi',true ,4.9,63,array['japanese','blackwork'],array[2,3,4,5,6],'10:00','18:00'),
  (5 ,'a3000000-0000-4000-8000-000000000005','elsa.nord@demo.inkora.dev','Elsa Nord','elsa_nord','Copenhagen','DK',55.6761,12.5683,'Europe/Copenhagen','Minimal geometric & fine-line',5,100,90,'EUR','elsa.geo',false,4.5,12,array['geometric','fineline'],array[1,3,5,6],'11:00','19:00'),
  (6 ,'a3000000-0000-4000-8000-000000000006','ravi.anand@demo.inkora.dev','Ravi Anand','ravi_anand','London','GB',51.5000,-0.1200,'Europe/London','Dotwork mandalas & sacred geometry',8,110,120,'GBP','ravi.dots',false,4.7,33,array['dotwork','geometric'],array[3,4,5,6,0],'12:00','20:00'),
  (7 ,'a3000000-0000-4000-8000-000000000007','bruno.costa@demo.inkora.dev','Bruno Costa','bruno_costa','Lisbon','PT',38.7223,-9.1393,'Europe/Lisbon','American traditional & lettering',10,115,120,'EUR','bruno.trad',true ,4.8,48,array['traditional','lettering'],array[2,3,4,5,6],'11:00','19:00'),
  (8 ,'a3000000-0000-4000-8000-000000000008','lena.ford@demo.inkora.dev','Lena Ford','lena_ford','Dublin','IE',53.3498,-6.2603,'Europe/Dublin','Neo-traditional color work',7,105,100,'EUR','lena.neo',false,4.6,22,array['neo_traditional','traditional'],array[1,2,4,5,6],'10:00','18:00'),
  (9 ,'a3000000-0000-4000-8000-000000000009','nadia.rue@demo.inkora.dev','Nadia Rue','nadia_rue','Paris','FR',48.8566,2.3522,'Europe/Paris','Black-and-grey realism & portraits',13,160,180,'EUR','nadia.real',true ,5.0,71,array['realism','blackwork'],array[2,3,4,5,6],'12:00','20:00'),
  (10,'a3000000-0000-4000-8000-000000000010','tom.vega@demo.inkora.dev','Tom Vega','tom_vega','Madrid','ES',40.4168,-3.7038,'Europe/Madrid','Script & calligraphy lettering',6,90,80,'EUR','tom.script',false,4.4,14,array['lettering','fineline'],array[1,2,3,4,5],'11:00','19:00'),
  (11,'a3000000-0000-4000-8000-000000000011','yara.bloom@demo.inkora.dev','Yara Bloom','yara_bloom','Amsterdam','NL',52.3676,4.9041,'Europe/Amsterdam','Soft watercolor florals',6,100,95,'EUR','yara.bloom',false,4.7,29,array['watercolor','neo_traditional'],array[3,4,5,6,0],'12:00','20:00'),
  (12,'a3000000-0000-4000-8000-000000000012','milo.ash@demo.inkora.dev','Milo Ash','milo_ash','Berlin','DE',52.5100,13.4000,'Europe/Berlin','Heavy blackwork & Japanese',11,130,140,'EUR','milo.ash',true ,4.8,52,array['blackwork','japanese'],array[2,3,4,5,6],'10:00','18:00'),
  (13,'a3000000-0000-4000-8000-000000000013','sena.kaya@demo.inkora.dev','Sena Kaya','sena_kaya','Vienna','AT',48.2082,16.3738,'Europe/Vienna','Fine-line minimal & geometric',5,95,85,'EUR','sena.line',false,4.6,17,array['fineline','geometric'],array[1,3,5,6],'11:00','19:00'),
  (14,'a3000000-0000-4000-8000-000000000014','rafa.pino@demo.inkora.dev','Rafa Pino','rafa_pino','Rome','IT',41.9028,12.4964,'Europe/Rome','Realism portraits & neo-traditional',14,170,190,'EUR','rafa.real',true ,4.9,58,array['realism','neo_traditional'],array[2,3,4,5,6],'12:00','20:00'),
  (15,'a3000000-0000-4000-8000-000000000015','ida.berg@demo.inkora.dev','Ida Berg','ida_berg','Stockholm','SE',59.3293,18.0686,'Europe/Stockholm','Dotwork & sacred geometry',8,110,110,'EUR','ida.dot',false,4.7,31,array['dotwork','blackwork'],array[3,4,5,6,0],'12:00','20:00'),
  (16,'a3000000-0000-4000-8000-000000000016','otto.lang@demo.inkora.dev','Otto Lang','otto_lang','Prague','CZ',50.0755,14.4378,'Europe/Prague','Traditional bold & lettering',9,100,100,'EUR','otto.trad',false,4.5,20,array['traditional','lettering'],array[1,2,4,5,6],'10:00','18:00'),
  (17,'a3000000-0000-4000-8000-000000000017','vera.sing@demo.inkora.dev','Vera Sing','vera_sing','Warsaw','PL',52.2297,21.0122,'Europe/Warsaw','Japanese color & watercolor',10,120,130,'EUR','vera.jp',true ,4.8,44,array['japanese','watercolor'],array[2,3,4,5,6],'11:00','19:00'),
  (18,'a3000000-0000-4000-8000-000000000018','cleo.mars@demo.inkora.dev','Cleo Mars','cleo_mars','Porto','PT',41.1579,-8.6291,'Europe/Lisbon','Geometric fine-line',6,95,90,'EUR','cleo.geo',false,4.6,25,array['geometric','fineline'],array[1,2,3,4,5],'11:00','19:00');

-- auth users (trigger creates profile + seeker role + reward account)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('display_name', name), false, false
from _a
on conflict (id) do nothing;

update public.profiles p set
  display_name = a.name, username = a.username, city = a.city,
  bio = a.headline || '. Based in ' || a.city || '.', onboarded_at = now()
from _a a where p.id = a.id;

-- precise location lives owner-only since 0036; search reads it server-side
insert into public.profiles_private (id, latitude, longitude)
select id, lat, lng from _a
on conflict (id) do update set latitude = excluded.latitude, longitude = excluded.longitude;

insert into public.role_grants (profile_id, role)
select id, 'artist' from _a on conflict (profile_id, role) do nothing;

insert into public.artists
  (id, headline, years_experience, hourly_rate, min_charge, currency_code,
   is_accepting, instagram_handle, verified_at, rating_avg, rating_count)
select id, headline, years, rate, min_charge, currency,
       (rn not in (5,10,13)), instagram,
       case when verified then now() else null end, rating, rating_count
from _a
on conflict (id) do update set
  headline = excluded.headline, hourly_rate = excluded.hourly_rate,
  rating_avg = excluded.rating_avg, rating_count = excluded.rating_count;

insert into public.artist_styles (artist_id, style_id, is_primary)
select a.id, ts.id, (st.ord = 1)
from _a a
cross join lateral unnest(a.styles) with ordinality as st(slug, ord)
join public.tattoo_styles ts on ts.slug = st.slug
on conflict (artist_id, style_id) do nothing;

insert into public.artist_availability (artist_id, day_of_week, start_time, end_time, timezone)
select a.id, dow, a.open_t, a.close_t, a.tz
from _a a, unnest(a.days) as dow
on conflict (artist_id, day_of_week, start_time, end_time) do nothing;

insert into public.portfolios (artist_id, title, is_default)
select id, 'Portfolio', true from _a
where not exists (select 1 from public.portfolios p where p.artist_id = _a.id);

insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order)
select p.id, p.artist_id, ts.image_path, initcap(ts.slug) || ' piece', 'approved',
       row_number() over (partition by p.artist_id order by ts.slug)
from public.portfolios p
join _a a on a.id = p.artist_id
join public.artist_styles ast on ast.artist_id = p.artist_id
join public.tattoo_styles ts on ts.id = ast.style_id
where ts.image_path is not null
  and not exists (select 1 from public.portfolio_images pi where pi.artist_id = p.artist_id);

-- ---------------------------------------------------------------------
-- 2) MORE STUDIOS + rosters (mix new & existing artists; 6 artists stay solo)
-- ---------------------------------------------------------------------
create temp table _s (
  id uuid, owner uuid, name text, slug text, city text, country char(2),
  lat double precision, lng double precision, bio text, hours jsonb, members uuid[]
);
insert into _s values
  ('52000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Agora Ink','agora-ink','Athens','GR',37.9838,23.7275,'Fine-line and dotwork collective near the Acropolis.',
    '{"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","19:00"]],"fri":[["11:00","19:00"]],"sat":[["11:00","18:00"]]}'::jsonb,
    array['a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001']::uuid[]),
  ('52000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000002','Prisma Berlin','prisma-berlin','Berlin','DE',52.5200,13.4050,'Blackwork, geometry and Japanese in Mitte.',
    '{"mon":[["10:00","18:00"]],"tue":[["10:00","18:00"]],"wed":[["10:00","18:00"]],"thu":[["10:00","18:00"]],"fri":[["10:00","18:00"]]}'::jsonb,
    array['a3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000004']::uuid[]),
  ('52000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000003','Aurora Barcelona','aurora-barcelona','Barcelona','ES',41.3874,2.1686,'Watercolor and neo-traditional in the Gothic Quarter.',
    '{"tue":[["12:00","20:00"]],"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]]}'::jsonb,
    array['a3000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000010']::uuid[]),
  ('52000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000004','Thames Ink','thames-ink','London','GB',51.5074,-0.1278,'Japanese and dotwork in Shoreditch.',
    '{"tue":[["10:00","18:00"]],"wed":[["10:00","18:00"]],"thu":[["10:00","18:00"]],"fri":[["10:00","18:00"]],"sat":[["10:00","17:00"]]}'::jsonb,
    array['a3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000007']::uuid[]),
  ('52000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000009','Lumen Paris','lumen-paris','Paris','FR',48.8566,2.3522,'Realism and black-and-grey in Le Marais.',
    '{"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]],"sun":[["12:00","19:00"]]}'::jsonb,
    array['a3000000-0000-4000-8000-000000000009','a3000000-0000-4000-8000-000000000017','a0000000-0000-4000-8000-000000000003']::uuid[]),
  ('52000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000014','Tiber Rome','tiber-rome','Rome','IT',41.9028,12.4964,'Realism and traditional near Trastevere.',
    '{"tue":[["12:00","20:00"]],"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]]}'::jsonb,
    array['a3000000-0000-4000-8000-000000000014','a3000000-0000-4000-8000-000000000016']::uuid[]);

insert into public.studios
  (id, owner_id, name, slug, bio, city, country, latitude, longitude, opening_hours, is_active)
select id, owner, name, slug, bio, city, country, lat, lng, hours, true
from _s
on conflict (id) do update set name = excluded.name, bio = excluded.bio, opening_hours = excluded.opening_hours;

insert into public.studio_memberships (studio_id, artist_id, role, status, joined_at)
select s.id, m.artist_id,
       case when m.artist_id = s.owner then 'owner' else 'artist' end::membership_role,
       'active'::membership_status, now()
from _s s, unnest(s.members) as m(artist_id)
on conflict (studio_id, artist_id) do nothing;

-- ---------------------------------------------------------------------
-- 3) DESIGNS for every style (placeholder pics), linked to matching artists.
--    4 UNIQUELY-NAMED designs per style so Explore keyword search is useful;
--    source artist rotates through the artists of that style. Ids are stable
--    (derived from style order + n) and the insert upserts titles, so re-running
--    renames any previously-seeded "<Style> study #N" placeholders.
-- ---------------------------------------------------------------------
create temp table _it (slug text, n int, title text);
insert into _it values
  ('fineline',1,'Wildflower Bouquet'),('fineline',2,'North Star Lines'),('fineline',3,'Minimalist Mountain'),('fineline',4,'Delicate Butterfly'),
  ('blackwork',1,'Solid Raven'),('blackwork',2,'Ornamental Band'),('blackwork',3,'Blackout Koi'),('blackwork',4,'Shadow Wolf'),
  ('traditional',1,'Classic Anchor'),('traditional',2,'Rose & Dagger'),('traditional',3,'Swallow Pair'),('traditional',4,'Flaming Heart'),
  ('neo_traditional',1,'Ornate Fox'),('neo_traditional',2,'Neo Peony'),('neo_traditional',3,'Gilded Moth'),('neo_traditional',4,'Crowned Lion'),
  ('realism',1,'Portrait Study'),('realism',2,'Lion''s Gaze'),('realism',3,'Pocket Watch'),('realism',4,'Grayscale Rose'),
  ('watercolor',1,'Watercolor Hummingbird'),('watercolor',2,'Splashed Feather'),('watercolor',3,'Abstract Wash'),('watercolor',4,'Cosmic Galaxy'),
  ('japanese',1,'Koi & Waves'),('japanese',2,'Hannya Mask'),('japanese',3,'Dragon Sleeve'),('japanese',4,'Cherry Blossom'),
  ('geometric',1,'Sacred Mandala'),('geometric',2,'Geometric Wolf'),('geometric',3,'Polygon Stag'),('geometric',4,'Symmetry Lines'),
  ('dotwork',1,'Moon Phases'),('dotwork',2,'Stippled Skull'),('dotwork',3,'Dotwork Mandala'),('dotwork',4,'Constellation Map'),
  ('lettering',1,'Script Quote'),('lettering',2,'Roman Numerals'),('lettering',3,'Gothic Monogram'),('lettering',4,'Fine Script Name');

create temp table _ni as
select ('30000000-0000-4000-8000-' || lpad((row_number() over (order by ts.sort_order, g.n))::text, 12, '0'))::uuid as id,
       ast.artist_id, ts.id as style_id, ts.name as style_name,
       coalesce(it.title, ts.name || ' study #' || g.n) as title,
       ts.image_path, g.n
from public.tattoo_styles ts
cross join generate_series(1, 4) g(n)
left join _it it on it.slug = ts.slug and it.n = g.n
join lateral (
  select a2.artist_id
  from public.artist_styles a2
  where a2.style_id = ts.id
  order by a2.artist_id
  offset ((g.n - 1) % greatest((select count(*) from public.artist_styles a3 where a3.style_id = ts.id), 1))
  limit 1
) ast on true;

insert into public.tattoo_ideas
  (id, created_by, source_artist_id, title, description, image_path, width, height, is_public, moderation_status, save_count)
select id, artist_id, artist_id,
       title,
       'A ' || lower(style_name) || ' piece — placeholder demo artwork.',
       image_path, 1200, 1200 + (n * 90), true, 'approved', (n * 17 + 3) % 60
from _ni
on conflict (id) do update set title = excluded.title, description = excluded.description;

insert into public.idea_styles (idea_id, style_id)
select id, style_id from _ni
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4) REVIEWS for the new artists (each backed by a completed appointment).
--    Ratings recompute automatically via the sync_artist_rating trigger.
-- ---------------------------------------------------------------------
create temp table _cust (k int, id uuid);
insert into _cust values
  (1,'c1000000-0000-4000-8000-000000000001'),(2,'c1000000-0000-4000-8000-000000000002'),
  (3,'c1000000-0000-4000-8000-000000000003'),(4,'c1000000-0000-4000-8000-000000000004'),
  (5,'c1000000-0000-4000-8000-000000000005'),(6,'c1000000-0000-4000-8000-000000000006');

create temp table _tpl (k int, rating int, title text, body text);
insert into _tpl values
  (1,5,'Absolutely worth it','Incredible linework and such a calm, professional session. Already planning my next piece.'),
  (2,5,'Exceeded expectations','Took my rough idea and made it better than I imagined. Healed perfectly.'),
  (3,4,'Great experience','Really happy with the result. Clean studio, relaxed vibe. Minor wait to book.'),
  (4,5,'A true artist','The detail is unreal. Sat for hours and barely noticed the time. Highly recommend.'),
  (5,4,'Solid work','Precise and exactly what we discussed. Will come back for colour work.');

create temp table _rv as
select ('41000000-0000-4000-8000-' || lpad((row_number() over ())::text, 12, '0'))::uuid as appt_id,
       a.id as artist_id, c.id as author_id, t.rating, t.title, t.body,
       ((a.rn * 7 + t.k * 11) % 140) + 6 as days_ago
from _a a
join _tpl t on t.k <= (3 + (a.rn % 3))
join _cust c on c.k = ((a.rn + t.k) % 6) + 1;

insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, created_at)
select appt_id, author_id, artist_id,
       now() - (days_ago || ' days')::interval,
       now() - (days_ago || ' days')::interval + interval '2 hours',
       'completed', 160, true,
       now() - (days_ago || ' days')::interval,
       now() - ((days_ago + 20) || ' days')::interval
from _rv
on conflict (id) do nothing;

insert into public.reviews
  (appointment_id, author_id, artist_id, overall_rating, title, body, is_published, created_at)
select appt_id, author_id, artist_id, rating, title, body, true,
       now() - (days_ago || ' days')::interval
from _rv
on conflict (appointment_id) do nothing;

-- ---------------------------------------------------------------------
-- 5) LOGIN-ABLE TESTER  (tester@demo.inkora.dev / password123)
--    Loaded so the personal dashboard, bookings, saved lists and the
--    "Leave a review" flow are all populated.
-- ---------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000001','authenticated','authenticated','tester@demo.inkora.dev',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Alex Rivera"}', false, false)
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(),'d0000000-0000-4000-8000-000000000001',
   '{"sub":"d0000000-0000-4000-8000-000000000001","email":"tester@demo.inkora.dev"}',
   'email','tester@demo.inkora.dev', now(), now(), now())
on conflict do nothing;

update public.profiles set
  display_name = 'Alex Rivera', username = 'alex_rivera', city = 'Athens',
  bio = 'Collecting fine-line and blackwork. Testing Inkora.', onboarded_at = now()
where id = 'd0000000-0000-4000-8000-000000000001';

-- Precise coordinates (owner-only) so Nearby / distance sort work for the tester.
insert into public.profiles_private (id, latitude, longitude)
values ('d0000000-0000-4000-8000-000000000001', 37.9838, 23.7275)
on conflict (id) do update set latitude = excluded.latitude, longitude = excluded.longitude;

-- Saved artists (mix of demo + migration + new artists)
insert into public.favorites (profile_id, target_type, target_id)
select 'd0000000-0000-4000-8000-000000000001', 'artist', t
from unnest(array[
  'a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000009',
  'a3000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000003'
]::uuid[]) as t
on conflict (profile_id, target_type, target_id) do nothing;

-- Saved designs (existing stable feed ideas)
insert into public.favorites (profile_id, target_type, target_id)
select 'd0000000-0000-4000-8000-000000000001', 'idea', t
from unnest(array[
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000009'
]::uuid[]) as t
on conflict (profile_id, target_type, target_id) do nothing;

-- Upcoming appointments (future, scheduled) — one booked via a studio
insert into public.appointments
  (id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, deposit_amount, deposit_paid, location_note, created_at)
values
  ('42000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003','52000000-0000-4000-8000-000000000003',
   now() + interval '3 days'  + interval '14 hours', now() + interval '3 days'  + interval '16 hours','scheduled',180,50,true,'Aurora Barcelona — Studio A', now()),
  ('42000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',null,
   now() + interval '10 days' + interval '11 hours', now() + interval '10 days' + interval '13 hours','scheduled',150,40,false,null, now()),
  ('42000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',null,
   now() + interval '21 days' + interval '17 hours', now() + interval '21 days' + interval '19 hours','scheduled',200,60,true,'Aria Vance private studio', now())
on conflict (id) do nothing;

-- Completed appointments — 43-01/02 reviewed, 43-03/04 left for the "Leave a review" flow
insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, created_at)
values
  ('43000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000009',
   now() - interval '40 days', now() - interval '40 days' + interval '2 hours','completed',220,true, now() - interval '40 days', now() - interval '60 days'),
  ('43000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',
   now() - interval '75 days', now() - interval '75 days' + interval '3 hours','completed',180,true, now() - interval '75 days', now() - interval '95 days'),
  ('43000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000004',
   now() - interval '20 days', now() - interval '20 days' + interval '2 hours','completed',160,true, now() - interval '20 days', now() - interval '40 days'),
  ('43000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
   now() - interval '8 days',  now() - interval '8 days'  + interval '1 hours','completed',140,true, now() - interval '8 days',  now() - interval '25 days')
on conflict (id) do nothing;

-- Reviews for the first two completed appointments only
insert into public.reviews
  (appointment_id, author_id, artist_id, overall_rating, title, body, is_published, created_at)
values
  ('43000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000009',5,'Flawless realism','Nadia nailed the portrait — healed beautifully. Worth every minute.', true, now() - interval '38 days'),
  ('43000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',4,'Great black-and-grey','Really clean work and a relaxed session. Would book again.', true, now() - interval '73 days')
on conflict (appointment_id) do nothing;

-- Journey entries
insert into public.tattoo_journey_entries (id, profile_id, appointment_id, artist_id, entry_type, title, notes, occurred_on)
values
  ('44000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',null,null,'idea','Saved my first ideas','Started a fine-line collection.', (now() - interval '90 days')::date),
  ('44000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','consultation','Consultation with Elena','Discussed placement and sizing.', (now() - interval '80 days')::date),
  ('44000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000009','appointment','Portrait session','Full black-and-grey portrait.', (now() - interval '40 days')::date),
  ('44000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000009','healing','Healing well','Aftercare on track.', (now() - interval '33 days')::date),
  ('44000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000009','completed','Portrait complete','Fully healed and settled.', (now() - interval '20 days')::date)
on conflict (id) do nothing;

-- A few notifications for the tester
insert into public.notifications (id, recipient_id, type, title, body, entity_type, entity_id, created_at)
values
  ('45000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','booking_update','Appointment confirmed','Your session with Mara Sol is confirmed.','appointment','42000000-0000-4000-8000-000000000001', now() - interval '1 days'),
  ('45000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','review','How was your session?','Leave a review for your recent appointment.','appointment','43000000-0000-4000-8000-000000000003', now() - interval '18 days'),
  ('45000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','reward','You earned points','Thanks for completing your profile.','profile','d0000000-0000-4000-8000-000000000001', now() - interval '5 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6) AUTH TOKEN HYGIENE — hosted GoTrue scans these token columns into
--    non-nullable strings; manual auth.users inserts leave them NULL, which
--    breaks sign-in with "Database error querying schema". Blank them out.
-- ---------------------------------------------------------------------
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where email like '%@demo.inkora.dev';
