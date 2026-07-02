-- =====================================================================
-- 0032  SEED MARKETPLACE  (many demo artists + studios) & signup fix
-- =====================================================================
-- Fix: the reward_signup trigger added in 0031 double-creates the reward
-- account that handle_new_user() already makes (same 'signup:<id>' key),
-- which breaks every new auth.users insert. handle_new_user already awards
-- the signup bonus, so the trigger is redundant — drop it.
set search_path = public, extensions;

drop trigger if exists reward_signup on public.profiles;
drop function if exists public.trg_reward_signup();

-- ---------------------------------------------------------------------
-- Demo artists. Inserting into auth.users fires handle_new_user(), which
-- creates the profile + reward account + seeker role automatically.
-- ---------------------------------------------------------------------
create temp table _seed_artists (
  id uuid, email text, display_name text, username text, city text, country char(2),
  lat double precision, lng double precision, tz text, bio text, headline text,
  years int, rate numeric, min_charge numeric, currency char(3), instagram text,
  verified boolean, rating numeric, rating_count int,
  styles text[], days int[], open_t time, close_t time
);
insert into _seed_artists values
  ('a1000000-0000-4000-8000-000000000001','maria.petrou@inkora.dev','Maria Petrou','maria_petrou','Athens','GR',37.9838,23.7275,'Europe/Athens','Delicate single-needle botanicals and fine ornamental work.','Fine-line & dotwork',7,90,80,'EUR','maria.ink',false,4.8,32,array['fineline','dotwork'],array[2,3,4,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000002','nikos.alexiou@inkora.dev','Nikos Alexiou','nikos_alexiou','Athens','GR',37.9900,23.7300,'Europe/Athens','Bold blackwork and neo-Japanese sleeves.','Blackwork & Japanese',10,110,120,'EUR','nikos.blk',false,4.6,21,array['blackwork','japanese'],array[1,2,3,4,5],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000003','elena.costa@inkora.dev','Elena Costa','elena_costa','Thessaloniki','GR',40.6401,22.9444,'Europe/Athens','Hyper-real portraits and black-and-grey realism.','Realism specialist',12,120,150,'EUR','elena.realism',true,4.9,47,array['realism','blackwork'],array[3,4,5,6,0],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000004','sofia.lindqvist@inkora.dev','Sofia Lindqvist','sofia_lind','Berlin','DE',52.5200,13.4050,'Europe/Berlin','Soft watercolor washes and airy fine-line.','Watercolor & fine-line',6,100,90,'EUR','sofia.aqua',false,4.7,38,array['watercolor','fineline'],array[2,3,4,5,6],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000005','jonas.weber@inkora.dev','Jonas Weber','jonas_weber','Berlin','DE',52.5100,13.4000,'Europe/Berlin','Sacred geometry and precise dotwork mandalas.','Geometric & dotwork',8,95,100,'EUR','jonas.geo',false,4.5,15,array['geometric','dotwork'],array[1,3,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000006','amara.okafor@inkora.dev','Amara Okafor','amara_okafor','London','GB',51.5074,-0.1278,'Europe/London','Bold American traditional and custom lettering.','Traditional & lettering',9,130,140,'GBP','amara.trad',true,4.8,54,array['traditional','lettering'],array[4,5,6,0,1],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000007','oliver.grant@inkora.dev','Oliver Grant','oliver_grant','London','GB',51.5000,-0.1200,'Europe/London','Photo-real black-and-grey and portrait work.','Realism & blackwork',14,140,160,'GBP','oliver.ink',true,4.9,61,array['realism','blackwork'],array[2,3,4,5,6],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000008','beatriz.silva@inkora.dev','Beatriz Silva','beatriz_silva','Lisbon','PT',38.7223,-9.1393,'Europe/Lisbon','Whimsical fine-line and pastel watercolor.','Fine-line & watercolor',5,85,80,'EUR','bea.fineline',false,4.6,29,array['fineline','watercolor'],array[1,2,3,4,5],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000009','tomas.reis@inkora.dev','Tomás Reis','tomas_reis','Lisbon','PT',38.7100,-9.1400,'Europe/Lisbon','Irezumi-inspired Japanese and geometric fusion.','Japanese & geometric',11,105,120,'EUR','tomas.irezumi',false,4.7,33,array['japanese','geometric'],array[3,4,5,6,0],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000010','carla.marin@inkora.dev','Carla Marín','carla_marin','Barcelona','ES',41.3874,2.1686,'Europe/Madrid','Vibrant neo-traditional and ornamental dotwork.','Traditional & dotwork',8,100,110,'EUR','carla.neotrad',false,4.8,40,array['traditional','dotwork'],array[2,3,4,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000011','diego.torres@inkora.dev','Diego Torres','diego_torres','Barcelona','ES',41.3800,2.1700,'Europe/Madrid','Heavy blackwork and script lettering.','Blackwork & lettering',7,95,100,'EUR','diego.blk',false,4.5,18,array['blackwork','lettering'],array[1,2,4,5,6],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000012','sanne.devries@inkora.dev','Sanne de Vries','sanne_devries','Amsterdam','NL',52.3676,4.9041,'Europe/Amsterdam','Minimal geometric and clean fine-line design.','Geometric & fine-line',9,110,120,'EUR','sanne.geo',true,4.9,45,array['geometric','fineline'],array[3,4,5,6,0],'12:00','20:00');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('display_name', display_name), false, false
from _seed_artists
on conflict (id) do nothing;

-- enrich the auto-created profiles
update public.profiles p set
  display_name = a.display_name, username = a.username, bio = a.bio,
  city = a.city, latitude = a.lat, longitude = a.lng
from _seed_artists a where p.id = a.id;

-- grant the artist role
insert into public.role_grants (profile_id, role)
select id, 'artist' from _seed_artists
on conflict (profile_id, role) do nothing;

-- artist records
insert into public.artists
  (id, headline, years_experience, hourly_rate, min_charge, currency_code,
   is_accepting, instagram_handle, verified_at, rating_avg, rating_count)
select id, headline, years, rate, min_charge, currency, true, instagram,
       case when verified then now() else null end, rating, rating_count
from _seed_artists
on conflict (id) do update set
  headline = excluded.headline, hourly_rate = excluded.hourly_rate,
  rating_avg = excluded.rating_avg, rating_count = excluded.rating_count;

-- styles (first style primary)
insert into public.artist_styles (artist_id, style_id, is_primary)
select a.id, ts.id, (st.ord = 1)
from _seed_artists a
cross join lateral unnest(a.styles) with ordinality as st(slug, ord)
join public.tattoo_styles ts on ts.slug = st.slug
on conflict (artist_id, style_id) do nothing;

-- weekly availability
insert into public.artist_availability (artist_id, day_of_week, start_time, end_time, timezone)
select a.id, dow, a.open_t, a.close_t, a.tz
from _seed_artists a, unnest(a.days) as dow
on conflict (artist_id, day_of_week, start_time, end_time) do nothing;

-- a default portfolio per artist
insert into public.portfolios (artist_id, title, is_default)
select id, 'Portfolio', true from _seed_artists
where not exists (select 1 from public.portfolios p where p.artist_id = _seed_artists.id);

-- portfolio images (reuse the public style imagery so tiles actually render)
insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order)
select p.id, p.artist_id, ts.image_path, initcap(ts.slug) || ' piece', 'approved',
       row_number() over (partition by p.artist_id order by ts.slug)
from public.portfolios p
join _seed_artists a on a.id = p.artist_id
join public.artist_styles ast on ast.artist_id = p.artist_id
join public.tattoo_styles ts on ts.id = ast.style_id
where ts.image_path is not null
  and not exists (select 1 from public.portfolio_images pi where pi.artist_id = p.artist_id);

-- ---------------------------------------------------------------------
-- Demo studios + rosters
-- ---------------------------------------------------------------------
create temp table _seed_studios (
  id uuid, owner uuid, name text, slug text, city text, country char(2),
  lat double precision, lng double precision, bio text, hours jsonb, members uuid[]
);
insert into _seed_studios values
  ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Blackline Athens','blackline-athens','Athens','GR',37.9838,23.7275,'A fine-line and blackwork studio in the heart of Athens.',
    '{"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","19:00"]],"fri":[["11:00","19:00"]],"sat":[["11:00","19:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002']::uuid[]),
  ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','Northern Ink','northern-ink','Thessaloniki','GR',40.6401,22.9444,'Realism-focused private studio in Thessaloniki.',
    '{"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]],"sun":[["12:00","20:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000003']::uuid[]),
  ('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004','Kreuzberg Tattoo Collective','kreuzberg-collective','Berlin','DE',52.5200,13.4050,'A collective of watercolor and geometric artists in Kreuzberg.',
    '{"tue":[["12:00","20:00"]],"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000005']::uuid[]),
  ('b1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000006','East End Electric','east-end-electric','London','GB',51.5074,-0.1278,'Traditional and realism in East London since 2012.',
    '{"tue":[["10:00","19:00"]],"wed":[["10:00","19:00"]],"thu":[["10:00","19:00"]],"fri":[["10:00","19:00"]],"sat":[["10:00","18:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000007']::uuid[]),
  ('b1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000008','Ribeira Ink','ribeira-ink','Lisbon','PT',38.7223,-9.1393,'Bright fine-line and Japanese work overlooking the Tejo.',
    '{"mon":[["11:00","19:00"]],"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","19:00"]],"fri":[["11:00","19:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000009']::uuid[]),
  ('b1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000010','Gòtic Tattoo','gotic-tattoo','Barcelona','ES',41.3874,2.1686,'Neo-traditional and blackwork in the Gothic Quarter.',
    '{"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","19:00"]],"fri":[["11:00","19:00"]],"sat":[["11:00","19:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000011']::uuid[]),
  ('b1000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000012','Canal Ink','canal-ink','Amsterdam','NL',52.3676,4.9041,'Minimal geometric and fine-line studio on the canals.',
    '{"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]],"sun":[["12:00","20:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000012']::uuid[]);

insert into public.studios
  (id, owner_id, name, slug, bio, city, country, latitude, longitude, opening_hours, is_active)
select id, owner, name, slug, bio, city, country, lat, lng, hours, true
from _seed_studios
on conflict (id) do update set
  name = excluded.name, bio = excluded.bio, opening_hours = excluded.opening_hours;

insert into public.studio_memberships (studio_id, artist_id, role, status, joined_at)
select s.id, m.artist_id, case when m.artist_id = s.owner then 'owner' else 'artist' end::membership_role,
       'active'::membership_status, now()
from _seed_studios s, unnest(s.members) as m(artist_id)
on conflict (studio_id, artist_id) do nothing;
