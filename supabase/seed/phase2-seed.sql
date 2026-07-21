-- =====================================================================
-- PHASE 2 — COMPREHENSIVE TESTER SEED
-- Run in the hosted project's SQL Editor AFTER phase1-wipe.sql.
-- Runs as postgres → bypasses RLS. Idempotent (stable ids + ON CONFLICT),
-- safe to re-run. Reuses the uploaded styles/*.jpg assets for all imagery;
-- avatars fall back to initials (as the app already renders them).
--
-- Seeds every surface: artists (styles, availability, portfolios, flashes,
-- rates + min charge, ratings), studios (rosters incl. suspended + pending
-- applications, opening hours, revenue, studio reviews, profile visits),
-- seekers (bios, saved lists, journeys, reviews), appointments in EVERY state
-- (scheduled / rescheduled / completed / cancelled / no_show), booking requests
-- (pending / reviewing / offered) + offers, client↔artist chats, rewards ledger,
-- and notifications.
--
-- THREE LOGIN-ABLE TESTER ACCOUNTS (all password: password123):
--   seeker@inkora.test  — seeker  "Alex Rivera"     d1000000-…-000000000001
--   artist@inkora.test  — artist  "Jordan Blake"    b1000000-…-000000000001
--   studio@inkora.test  — studio  "Mara Vasquez"    e1000000-…-000000000001 (owns Iron Lotus)
-- =====================================================================
set search_path = public, extensions;

-- Defensive: drop leftover temp tables if this is re-run in the same session.
drop table if exists _u, _a, _c, _s, _it, _ni, _tpl, _ar, _cli, _rv, _pool, _flashpool cascade;

-- =====================================================================
-- 0) ALL AUTH USERS  (trigger makes profile + reward_points + seeker role)
--    Bulk: 16 artists, 9 seekers, 4 studio owners. Plus the 3 testers.
-- =====================================================================
create temp table _u (
  id uuid, email text, name text, kind text  -- kind: artist|seeker|owner|tester_*
);
insert into _u values
  -- 16 marketplace artists
  ('a1000000-0000-4000-8000-000000000001','iris.vale@seed.inkora.dev','Iris Vale','artist'),
  ('a1000000-0000-4000-8000-000000000002','dorian.feld@seed.inkora.dev','Dorian Feld','artist'),
  ('a1000000-0000-4000-8000-000000000003','mara.sol@seed.inkora.dev','Mara Sol','artist'),
  ('a1000000-0000-4000-8000-000000000004','kaito.mori@seed.inkora.dev','Kaito Mori','artist'),
  ('a1000000-0000-4000-8000-000000000005','elsa.nord@seed.inkora.dev','Elsa Nord','artist'),
  ('a1000000-0000-4000-8000-000000000006','ravi.anand@seed.inkora.dev','Ravi Anand','artist'),
  ('a1000000-0000-4000-8000-000000000007','bruno.costa@seed.inkora.dev','Bruno Costa','artist'),
  ('a1000000-0000-4000-8000-000000000008','lena.ford@seed.inkora.dev','Lena Ford','artist'),
  ('a1000000-0000-4000-8000-000000000009','nadia.rue@seed.inkora.dev','Nadia Rue','artist'),
  ('a1000000-0000-4000-8000-000000000010','tom.vega@seed.inkora.dev','Tom Vega','artist'),
  ('a1000000-0000-4000-8000-000000000011','yara.bloom@seed.inkora.dev','Yara Bloom','artist'),
  ('a1000000-0000-4000-8000-000000000012','milo.ash@seed.inkora.dev','Milo Ash','artist'),
  ('a1000000-0000-4000-8000-000000000013','sena.kaya@seed.inkora.dev','Sena Kaya','artist'),
  ('a1000000-0000-4000-8000-000000000014','rafa.pino@seed.inkora.dev','Rafa Pino','artist'),
  ('a1000000-0000-4000-8000-000000000015','ida.berg@seed.inkora.dev','Ida Berg','artist'),
  ('a1000000-0000-4000-8000-000000000016','otto.lang@seed.inkora.dev','Otto Lang','artist'),
  -- 9 seeker clients
  ('c1000000-0000-4000-8000-000000000001','emma.stone@seed.inkora.dev','Emma Stone','seeker'),
  ('c1000000-0000-4000-8000-000000000002','liam.park@seed.inkora.dev','Liam Park','seeker'),
  ('c1000000-0000-4000-8000-000000000003','sofia.ren@seed.inkora.dev','Sofia Ren','seeker'),
  ('c1000000-0000-4000-8000-000000000004','noah.hale@seed.inkora.dev','Noah Hale','seeker'),
  ('c1000000-0000-4000-8000-000000000005','ava.moor@seed.inkora.dev','Ava Moor','seeker'),
  ('c1000000-0000-4000-8000-000000000006','ethan.cole@seed.inkora.dev','Ethan Cole','seeker'),
  ('c1000000-0000-4000-8000-000000000007','mia.frost@seed.inkora.dev','Mia Frost','seeker'),
  ('c1000000-0000-4000-8000-000000000008','leo.diaz@seed.inkora.dev','Leo Diaz','seeker'),
  ('c1000000-0000-4000-8000-000000000009','zoe.lang@seed.inkora.dev','Zoe Lang','seeker'),
  -- 4 studio owners (studio_admin only)
  ('f1000000-0000-4000-8000-000000000001','owner.agora@seed.inkora.dev','Cosmo Diamantis','owner'),
  ('f1000000-0000-4000-8000-000000000002','owner.prisma@seed.inkora.dev','Petra Klein','owner'),
  ('f1000000-0000-4000-8000-000000000003','owner.aurora@seed.inkora.dev','Rosa Marín','owner'),
  ('f1000000-0000-4000-8000-000000000004','owner.thames@seed.inkora.dev','Grace Holt','owner'),
  -- 3 testers
  ('d1000000-0000-4000-8000-000000000001','seeker@inkora.test','Alex Rivera','tester_seeker'),
  ('b1000000-0000-4000-8000-000000000001','artist@inkora.test','Jordan Blake','tester_artist'),
  ('e1000000-0000-4000-8000-000000000001','studio@inkora.test','Mara Vasquez','tester_owner');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('display_name', name), false, false
from _u
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id,
       jsonb_build_object('sub', id::text, 'email', email),
       'email', email, now(), now(), now()
from _u
on conflict do nothing;

-- Hosted GoTrue reads these token columns into non-null strings; manual inserts
-- leave them NULL, which breaks sign-in with "Database error querying schema".
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where id in (select id from _u);

-- =====================================================================
-- 1) ARTISTS  (16 marketplace + the artist tester) — profile, artist record,
--    styles, availability, portfolio + flashes.
-- =====================================================================
create temp table _a (
  id uuid, username text, city text, country char(2), lat double precision, lng double precision,
  tz text, headline text, bio text, years int, rate numeric, min_charge numeric, currency char(3),
  instagram text, verified boolean, accepting boolean, rating numeric, rating_count int,
  styles text[], days int[], open_t time, close_t time
);
insert into _a values
  ('a1000000-0000-4000-8000-000000000001','iris_vale','Athens','GR',37.9838,23.7275,'Europe/Athens','Botanical fine-line & ornamental','Fine-line and delicate botanical work. Slow, considered sessions.',6,95,80,'EUR','iris.ink',true ,true ,4.8,27,array['fineline','dotwork'],array[2,3,4,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000002','dorian_feld','Berlin','DE',52.5200,13.4050,'Europe/Berlin','Blackwork & ornamental patterns','Bold blackwork and ornamental pattern specialist based in Mitte.',9,120,110,'EUR','dorian.blk',false,true ,4.6,19,array['blackwork','geometric'],array[1,2,3,4,5],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000003','mara_sol','Barcelona','ES',41.3874,2.1686,'Europe/Madrid','Vivid watercolor & fine-line','Colour-forward watercolor pieces with a fine-line backbone.',7,105,100,'EUR','mara.aqua',true ,true ,4.9,41,array['watercolor','fineline'],array[2,3,4,5,6],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000004','kaito_mori','London','GB',51.5074,-0.1278,'Europe/London','Irezumi & neo-Japanese sleeves','Traditional Japanese and neo-Japanese large-scale work.',12,150,160,'GBP','kaito.irezumi',true ,true ,4.9,63,array['japanese','blackwork'],array[2,3,4,5,6],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000005','elsa_nord','Copenhagen','DK',55.6761,12.5683,'Europe/Copenhagen','Minimal geometric & fine-line','Minimalist geometry and single-needle fine-line.',5,100,90,'EUR','elsa.geo',false,false,4.5,12,array['geometric','fineline'],array[1,3,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000006','ravi_anand','London','GB',51.5000,-0.1200,'Europe/London','Dotwork mandalas & sacred geometry','Stippled mandalas and sacred geometry, freehand.',8,110,120,'GBP','ravi.dots',true ,true ,4.7,33,array['dotwork','geometric'],array[3,4,5,6,0],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000007','bruno_costa','Lisbon','PT',38.7223,-9.1393,'Europe/Lisbon','American traditional & lettering','Bold traditional and hand-drawn lettering.',10,115,120,'EUR','bruno.trad',true ,true ,4.8,48,array['traditional','lettering'],array[2,3,4,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000008','lena_ford','Dublin','IE',53.3498,-6.2603,'Europe/Dublin','Neo-traditional color work','Neo-traditional colour with a botanical leaning.',7,105,100,'EUR','lena.neo',false,true ,4.6,22,array['neo_traditional','traditional'],array[1,2,4,5,6],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000009','nadia_rue','Paris','FR',48.8566,2.3522,'Europe/Paris','Black-and-grey realism & portraits','Photo-real black-and-grey portraits and pet memorials.',13,160,180,'EUR','nadia.real',true ,true ,5.0,71,array['realism','blackwork'],array[2,3,4,5,6],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000010','tom_vega','Madrid','ES',40.4168,-3.7038,'Europe/Madrid','Script & calligraphy lettering','Calligraphy, script and fine lettering.',6,90,80,'EUR','tom.script',false,true ,4.4,14,array['lettering','fineline'],array[1,2,3,4,5],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000011','yara_bloom','Amsterdam','NL',52.3676,4.9041,'Europe/Amsterdam','Soft watercolor florals','Soft, painterly florals in watercolour.',6,100,95,'EUR','yara.bloom',false,true ,4.7,29,array['watercolor','neo_traditional'],array[3,4,5,6,0],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000012','milo_ash','Berlin','DE',52.5100,13.4000,'Europe/Berlin','Heavy blackwork & Japanese','Heavy blackwork, blast-over and Japanese motifs.',11,130,140,'EUR','milo.ash',true ,true ,4.8,52,array['blackwork','japanese'],array[2,3,4,5,6],'10:00','18:00'),
  ('a1000000-0000-4000-8000-000000000013','sena_kaya','Vienna','AT',48.2082,16.3738,'Europe/Vienna','Fine-line minimal & geometric','Minimal fine-line and small geometric pieces.',5,95,85,'EUR','sena.line',false,true ,4.6,17,array['fineline','geometric'],array[1,3,5,6],'11:00','19:00'),
  ('a1000000-0000-4000-8000-000000000014','rafa_pino','Rome','IT',41.9028,12.4964,'Europe/Rome','Realism portraits & neo-traditional','Realism portraits and colour neo-traditional.',14,170,190,'EUR','rafa.real',true ,true ,4.9,58,array['realism','neo_traditional'],array[2,3,4,5,6],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000015','ida_berg','Stockholm','SE',59.3293,18.0686,'Europe/Stockholm','Dotwork & sacred geometry','Dotwork, sacred geometry and ornamental.',8,110,110,'EUR','ida.dot',false,true ,4.7,31,array['dotwork','blackwork'],array[3,4,5,6,0],'12:00','20:00'),
  ('a1000000-0000-4000-8000-000000000016','otto_lang','Prague','CZ',50.0755,14.4378,'Europe/Prague','Traditional bold & lettering','Old-school traditional and bold lettering.',9,100,100,'EUR','otto.trad',false,true ,4.5,20,array['traditional','lettering'],array[1,2,4,5,6],'10:00','18:00'),
  -- ARTIST TESTER (Jordan Blake) — Athens, fine-line + blackwork, accepting
  ('b1000000-0000-4000-8000-000000000001','jordan_blake','Athens','GR',37.9770,23.7360,'Europe/Athens','Fine-line, blackwork & script','Testing artist account. Fine-line, blackwork and lettering. DM to book.',7,120,100,'EUR','jordan.blake',true ,true ,4.8,15,array['fineline','blackwork','lettering'],array[1,2,3,4,5],'10:00','19:00');

update public.profiles p set
  display_name = u.name, username = a.username, city = a.city, bio = a.bio,
  onboarded_at = now()
from _a a join _u u on u.id = a.id where p.id = a.id;

insert into public.profiles_private (id, latitude, longitude)
select id, lat, lng from _a
on conflict (id) do update set latitude = excluded.latitude, longitude = excluded.longitude;

insert into public.role_grants (profile_id, role)
select id, 'artist' from _a on conflict (profile_id, role) do nothing;

insert into public.artists
  (id, headline, years_experience, hourly_rate, min_charge, currency_code,
   is_accepting, instagram_handle, verified_at, rating_avg, rating_count)
select id, headline, years, rate, min_charge, currency, accepting, instagram,
       case when verified then now() - interval '120 days' else null end, rating, rating_count
from _a
on conflict (id) do update set
  headline = excluded.headline, hourly_rate = excluded.hourly_rate,
  min_charge = excluded.min_charge, is_accepting = excluded.is_accepting,
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
on conflict do nothing;

insert into public.portfolios (artist_id, title, is_default)
select id, 'Portfolio', true from _a
where not exists (select 1 from public.portfolios p where p.artist_id = _a.id);

-- Match an uploaded object to a style by normalising the text before the
-- " - " separator (strip case + all non-alphanumerics), so it tolerates the
-- actual filenames ("blackwork - 1.jpg", "neo_traditional - 1.jpg" in seed/ and
-- "neo-traditional - 1.jpg" in flashes/). Spaces are %20-encoded in the stored
-- path (raw spaces don't resolve; encoded ones return 200). '.emptyFolderPlaceholder'
-- rows (created by the dashboard for empty folders) are skipped.

-- PORTFOLIO pool: finished-work / on-skin photos from the 'seed/' folder. Used
-- for portfolio pieces and the feed ideas. Falls back to styles/<slug>.jpg.
create temp table _pool as
select ts.slug,
       coalesce(
         array_agg('portfolio/' || replace(so.name, ' ', '%20') order by so.name)
           filter (where so.name is not null),
         array['styles/' || ts.slug || '.jpg']
       ) as imgs
from public.tattoo_styles ts
left join storage.objects so
  on so.bucket_id = 'portfolio'
     and so.name like 'seed/%'
     and so.name not like '%emptyFolderPlaceholder'
     and regexp_replace(lower(split_part(split_part(so.name, '/', 2), ' - ', 1)), '[^a-z0-9]', '', 'g')
         = replace(ts.slug, '_', '')
group by ts.slug;

-- FLASH pool: flat flash sheets (white bg, black design → multiply-blend cleanly
-- in the try-on compositor) from the 'flashes/' folder. Falls back to the style
-- image if a style has none.
create temp table _flashpool as
select ts.slug,
       coalesce(
         array_agg('portfolio/' || replace(so.name, ' ', '%20') order by so.name)
           filter (where so.name is not null),
         array['styles/' || ts.slug || '.jpg']
       ) as imgs
from public.tattoo_styles ts
left join storage.objects so
  on so.bucket_id = 'portfolio'
     and so.name like 'flashes/%'
     and so.name not like '%emptyFolderPlaceholder'
     and regexp_replace(lower(split_part(split_part(so.name, '/', 2), ' - ', 1)), '[^a-z0-9]', '', 'g')
         = replace(ts.slug, '_', '')
group by ts.slug;

create temp table _ar as select id as artist_id, row_number() over (order by id) as rn from _a;

-- Portfolio pieces: one per style the artist works in. The image is picked
-- per-artist from that style's pool (round-robin) so artists don't share a pic.
insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order, kind)
select p.id, p.artist_id,
       pl.imgs[1 + ((ar.rn - 1) % array_length(pl.imgs, 1))],
       initcap(replace(ts.slug,'_',' ')) || ' piece', 'approved',
       row_number() over (partition by p.artist_id order by ts.slug), 'portfolio'
from public.portfolios p
join _ar ar on ar.artist_id = p.artist_id
join public.artist_styles ast on ast.artist_id = p.artist_id
join public.tattoo_styles ts on ts.id = ast.style_id
join _pool pl on pl.slug = ts.slug
where not exists (select 1 from public.portfolio_images pi where pi.artist_id = p.artist_id and pi.kind = 'portfolio');

-- Flashes (kind='flash'): one per style the artist works in, drawn from the
-- dedicated FLASH pool (proper flat sheets) so try-on composites believably.
insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order, kind)
select p.id, p.artist_id,
       fp.imgs[1 + ((ar.rn - 1) % array_length(fp.imgs, 1))],
       initcap(replace(ts.slug,'_',' ')) || ' flash', 'approved',
       row_number() over (partition by p.artist_id order by ts.slug), 'flash'
from public.portfolios p
join _ar ar on ar.artist_id = p.artist_id
join public.artist_styles ast on ast.artist_id = p.artist_id
join public.tattoo_styles ts on ts.id = ast.style_id
join _flashpool fp on fp.slug = ts.slug
where not exists (select 1 from public.portfolio_images pi where pi.artist_id = p.artist_id and pi.kind = 'flash');

-- =====================================================================
-- 2) SEEKERS  (9 clients + the seeker tester) — bios, cities, coords, prefs.
-- =====================================================================
create temp table _c (
  id uuid, username text, city text, lat double precision, lng double precision, bio text, styles text[]
);
insert into _c values
  ('c1000000-0000-4000-8000-000000000001','emma_stone','Athens',37.9838,23.7275,'First-timer, saving fine-line ideas.',array['fineline','watercolor']),
  ('c1000000-0000-4000-8000-000000000002','liam_park','London',51.5074,-0.1278,'Blackwork collector. Sleeve in progress.',array['blackwork','japanese']),
  ('c1000000-0000-4000-8000-000000000003','sofia_ren','Barcelona',41.3874,2.1686,'Into watercolor and neo-traditional.',array['watercolor','neo_traditional']),
  ('c1000000-0000-4000-8000-000000000004','noah_hale','Berlin',52.5200,13.4050,'Geometry and dotwork enthusiast.',array['geometric','dotwork']),
  ('c1000000-0000-4000-8000-000000000005','ava_moor','Paris',48.8566,2.3522,'Realism portraits are my thing.',array['realism']),
  ('c1000000-0000-4000-8000-000000000006','ethan_cole','Dublin',53.3498,-6.2603,'Traditional and lettering fan.',array['traditional','lettering']),
  ('c1000000-0000-4000-8000-000000000007','mia_frost','Amsterdam',52.3676,4.9041,'Soft florals and fine-line.',array['watercolor','fineline']),
  ('c1000000-0000-4000-8000-000000000008','leo_diaz','Madrid',40.4168,-3.7038,'Lettering and script only.',array['lettering']),
  ('c1000000-0000-4000-8000-000000000009','zoe_lang','Rome',41.9028,12.4964,'Building a neo-traditional half-sleeve.',array['neo_traditional','realism']),
  -- SEEKER TESTER (Alex Rivera)
  ('d1000000-0000-4000-8000-000000000001','alex_rivera','Athens',37.9838,23.7275,'Collecting fine-line and blackwork. Testing Inkora.',array['fineline','blackwork']);

update public.profiles p set
  display_name = u.name, username = c.username, city = c.city, bio = c.bio, onboarded_at = now()
from _c c join _u u on u.id = c.id where p.id = c.id;

insert into public.profiles_private (id, latitude, longitude)
select id, lat, lng from _c
on conflict (id) do update set latitude = excluded.latitude, longitude = excluded.longitude;

insert into public.user_style_preferences (profile_id, style_id, weight)
select c.id, ts.id, 3
from _c c cross join lateral unnest(c.styles) as g(slug)
join public.tattoo_styles ts on ts.slug = g.slug
on conflict (profile_id, style_id) do nothing;

-- =====================================================================
-- 3) STUDIO OWNERS  (studio_admin, not artists) + the studio tester.
-- =====================================================================
delete from public.role_grants
where role = 'seeker'
  and profile_id in (
    'f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000004',
    'e1000000-0000-4000-8000-000000000001');
insert into public.role_grants (profile_id, role)
select id, 'studio_admin' from _u where kind in ('owner','tester_owner')
on conflict (profile_id, role) do nothing;

update public.profiles set city = 'Athens', onboarded_at = now()
  where id in ('f1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001');
update public.profiles set city = 'Berlin',    onboarded_at = now() where id = 'f1000000-0000-4000-8000-000000000002';
update public.profiles set city = 'Barcelona', onboarded_at = now() where id = 'f1000000-0000-4000-8000-000000000003';
update public.profiles set city = 'London',    onboarded_at = now() where id = 'f1000000-0000-4000-8000-000000000004';

-- =====================================================================
-- 4) STUDIOS  (5) — opening hours, bios, rosters (active + suspended +
--    pending applications).
-- =====================================================================
create temp table _s (
  id uuid, owner uuid, name text, slug text, city text, country char(2),
  lat double precision, lng double precision, bio text, hours jsonb,
  active_members uuid[], suspended_members uuid[], applicants uuid[]
);
insert into _s values
  ('50000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Iron Lotus','iron-lotus','Athens','GR',37.9838,23.7275,
    'A fine-line, blackwork and neo-traditional collective in the heart of Athens. By appointment.',
    '{"mon":[["11:00","19:00"]],"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","20:00"]],"fri":[["11:00","20:00"]],"sat":[["12:00","18:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000007']::uuid[],
    array['a1000000-0000-4000-8000-000000000013']::uuid[],
    array['a1000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000005']::uuid[]),
  ('50000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','Prisma Berlin','prisma-berlin','Berlin','DE',52.5200,13.4050,
    'Blackwork, geometry and Japanese in Mitte.',
    '{"mon":[["10:00","18:00"]],"tue":[["10:00","18:00"]],"wed":[["10:00","18:00"]],"thu":[["10:00","18:00"]],"fri":[["10:00","18:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000012']::uuid[],
    array[]::uuid[],
    array['a1000000-0000-4000-8000-000000000015']::uuid[]),
  ('50000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','Aurora Barcelona','aurora-barcelona','Barcelona','ES',41.3874,2.1686,
    'Watercolor and neo-traditional in the Gothic Quarter.',
    '{"tue":[["12:00","20:00"]],"wed":[["12:00","20:00"]],"thu":[["12:00","20:00"]],"fri":[["12:00","20:00"]],"sat":[["12:00","20:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000011']::uuid[],
    array[]::uuid[],
    array[]::uuid[]),
  ('50000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004','Thames Ink','thames-ink','London','GB',51.5074,-0.1278,
    'Japanese and dotwork in Shoreditch.',
    '{"tue":[["10:00","18:00"]],"wed":[["10:00","18:00"]],"thu":[["10:00","18:00"]],"fri":[["10:00","18:00"]],"sat":[["10:00","17:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000006']::uuid[],
    array[]::uuid[],
    array[]::uuid[]),
  ('50000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000001','Agora Ink','agora-ink','Athens','GR',37.9755,23.7348,
    'Traditional, realism and lettering near Monastiraki.',
    '{"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","19:00"]],"fri":[["11:00","19:00"]],"sat":[["11:00","18:00"]]}'::jsonb,
    array['a1000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000016']::uuid[],
    array[]::uuid[],
    array[]::uuid[]);

insert into public.studios
  (id, owner_id, name, slug, bio, city, country, latitude, longitude, opening_hours, is_active)
select id, owner, name, slug, bio, city, country, lat, lng, hours, true from _s
on conflict (id) do update set name = excluded.name, bio = excluded.bio, opening_hours = excluded.opening_hours;

insert into public.studio_memberships (studio_id, artist_id, role, status, joined_at)
select s.id, m, 'artist', 'active', now() - interval '90 days'
from _s s, unnest(s.active_members) m
on conflict (studio_id, artist_id) do update set status = 'active';

insert into public.studio_memberships (studio_id, artist_id, role, status, suspension_reason, joined_at)
select s.id, m, 'artist', 'suspended', 'Temporary suspension pending review', now() - interval '120 days'
from _s s, unnest(s.suspended_members) m
on conflict (studio_id, artist_id) do update set status = 'suspended';

insert into public.studio_memberships (studio_id, artist_id, role, status, created_at)
select s.id, m, 'artist', 'requested', now() - (random() * interval '4 days')
from _s s, unnest(s.applicants) m
on conflict (studio_id, artist_id) do nothing;

-- =====================================================================
-- 5) FEED IDEAS  (4 uniquely-named designs per style → Explore search is useful)
-- =====================================================================
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

-- 4 ideas per style; image rotates through that style's pool (_pool, from §1) so
-- the 4 ideas of a style are distinct when enough images were uploaded.
create temp table _ni as
select ('30000000-0000-4000-8000-' || lpad((row_number() over (order by ts.sort_order, g.n))::text, 12, '0'))::uuid as id,
       ast.artist_id, ts.id as style_id, ts.name as style_name,
       coalesce(it.title, ts.name || ' study #' || g.n) as title,
       pl.imgs[1 + ((g.n - 1) % array_length(pl.imgs, 1))] as image_path, g.n
from public.tattoo_styles ts
join _pool pl on pl.slug = ts.slug
cross join generate_series(1,4) g(n)
left join _it it on it.slug = ts.slug and it.n = g.n
join lateral (
  select a2.artist_id from public.artist_styles a2
  where a2.style_id = ts.id order by a2.artist_id
  offset ((g.n - 1) % greatest((select count(*) from public.artist_styles a3 where a3.style_id = ts.id),1)) limit 1
) ast on true;

insert into public.tattoo_ideas
  (id, created_by, source_artist_id, title, description, image_path, width, height, is_public, moderation_status, save_count)
select id, artist_id, artist_id, title,
       'A ' || lower(style_name) || ' piece — demo artwork.', image_path, 1200, 1200 + (n*90), true, 'approved', (n*17+3) % 60
from _ni
on conflict (id) do update set title = excluded.title;

insert into public.idea_styles (idea_id, style_id)
select id, style_id from _ni on conflict do nothing;

-- =====================================================================
-- 6) COMPLETED APPOINTMENTS + REVIEWS backing every artist's rating.
--    Each review is backed by a completed appointment; a few carry an artist
--    reply. Ratings recompute via the sync_artist_rating trigger.
-- =====================================================================
create temp table _tpl (k int, rating int, title text, body text, reply text);
insert into _tpl values
  (1,5,'Absolutely worth it','Incredible linework and a calm, professional session. Already planning my next piece.','Thank you so much — was a pleasure! See you for the next one.'),
  (2,5,'Exceeded expectations','Took my rough idea and made it better than I imagined. Healed perfectly.',null),
  (3,4,'Great experience','Really happy with the result. Clean studio, relaxed vibe.','Appreciate the review — glad you love it!'),
  (4,5,'A true artist','The detail is unreal. Sat for hours and barely noticed the time.',null),
  (5,4,'Solid work','Precise and exactly what we discussed. Will be back for colour.',null);

-- Deterministic helper: the 9 NON-tester seekers numbered (_ar built in §1).
create temp table _cli as
  select id, row_number() over (order by id) as rn
  from _c where id <> 'd1000000-0000-4000-8000-000000000001';

-- 4..6 reviews per artist, clients + templates picked round-robin (no hashing).
create temp table _rv as
select ('60000000-0000-4000-8000-' || lpad((row_number() over (order by ar.rn, g.n))::text, 12, '0'))::uuid as appt_id,
       ar.artist_id, cl.id as author_id, tpl.rating, tpl.title, tpl.body, tpl.reply,
       ((ar.rn*13 + g.n*7) % 150) + 6 as days_ago
from _ar ar
cross join lateral generate_series(1, 4 + (ar.rn % 3)) as g(n)
join _cli cl  on cl.rn  = 1 + ((ar.rn + g.n) % 9)
join _tpl tpl on tpl.k  = 1 + ((ar.rn + g.n) % 5);

insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, created_at)
select appt_id, author_id, artist_id,
       now() - (days_ago || ' days')::interval,
       now() - (days_ago || ' days')::interval + interval '2 hours',
       'completed', 120 + (rating*20), true,
       now() - (days_ago || ' days')::interval,
       now() - ((days_ago+20) || ' days')::interval
from _rv
on conflict (id) do nothing;

insert into public.reviews
  (appointment_id, author_id, artist_id, overall_rating, title, body, reply, replied_at, is_published, created_at)
select appt_id, author_id, artist_id, rating, title, body, reply,
       case when reply is not null then now() - (days_ago || ' days')::interval + interval '2 days' else null end,
       true, now() - (days_ago || ' days')::interval
from _rv
on conflict (appointment_id) do nothing;

-- =====================================================================
-- 7) STUDIO REVENUE + studio-tagged reviews + profile visits (dashboard stats).
--    Completed studio bookings across each studio's active roster.
-- =====================================================================
do $$
declare
  s record; m uuid; cli uuid; i int; appt uuid;
  clients uuid[] := array[
    'c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-000000000006'];
  titles text[] := array['Incredible detail','Exactly what I wanted','Clean & professional','Worth every euro'];
  bodies text[] := array['The studio was spotless and the artist nailed the design.','Welcoming space, great communication throughout.','Booked again already — fantastic experience.','Beautiful linework, healed perfectly.'];
begin
  for s in select id as studio_id from public.studios loop
    -- Idempotent: skip a studio that already has completed bookings seeded.
    if exists (select 1 from public.appointments where studio_id = s.studio_id and status = 'completed') then
      continue;
    end if;
    -- profile visits to the studio
    insert into public.profile_visits (target_type, target_id, viewer_id, created_at)
    select 'studio', s.studio_id, c, now() - (random()*interval '25 days')
    from unnest(clients) c;

    for m in select artist_id from public.studio_memberships where studio_id = s.studio_id and status = 'active' loop
      -- artist profile visits
      insert into public.profile_visits (target_type, target_id, viewer_id, created_at)
      select 'artist', m, c, now() - (random()*interval '20 days') from unnest(clients) c;
      -- 3 completed studio bookings each, with a studio-tagged review
      for i in 1..3 loop
        cli := clients[1 + ((i + length(m::text)) % array_length(clients,1))];
        appt := gen_random_uuid();
        insert into public.appointments (id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, created_at)
        values (appt, cli, m, s.studio_id,
                now() - ((i*17) || ' days')::interval, now() - ((i*17) || ' days')::interval + interval '2 hours',
                'completed', 140 + i*40, true, now() - ((i*17) || ' days')::interval, now() - ((i*17+15) || ' days')::interval);
        insert into public.reviews (appointment_id, author_id, artist_id, studio_id, overall_rating, title, body, is_published, created_at)
        values (appt, cli, m, s.studio_id, 4 + (i%2), titles[1+(i%4)], bodies[1+(i%4)], true, now() - ((i*17) || ' days')::interval);
      end loop;
    end loop;
  end loop;
end $$;

-- =====================================================================
-- 8) THE SEEKER TESTER (Alex) — bookings in EVERY state, requests+offers,
--    saved lists, journey, chats, notifications.
--    Prefix 7000… = Alex's own interactive rows (stable, idempotent).
-- =====================================================================
-- Saved artists + designs
insert into public.favorites (profile_id, target_type, target_id)
select 'd1000000-0000-4000-8000-000000000001','artist', t from unnest(array[
  'a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000009','b1000000-0000-4000-8000-000000000001']::uuid[]) t
on conflict do nothing;
insert into public.favorites (profile_id, target_type, target_id)
select 'd1000000-0000-4000-8000-000000000001','idea', id from _ni where n <= 2 limit 6
on conflict do nothing;

-- Upcoming (scheduled) + rescheduled + a pending-reschedule
insert into public.appointments
  (id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, deposit_amount, deposit_paid, location_note, created_at)
values
  ('70000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003',
   now()+interval '4 days'+interval '14 hours', now()+interval '4 days'+interval '16 hours','scheduled',180,50,true,'Aurora Barcelona — Studio A', now()-interval '6 days'),
  ('70000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
   now()+interval '12 days'+interval '11 hours', now()+interval '12 days'+interval '13 hours','rescheduled',150,40,true,'Iron Lotus', now()-interval '15 days')
on conflict (id) do nothing;
-- pending reschedule (artist proposed a new time; Alex must respond)
insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, reschedule_status, reschedule_start, reschedule_end, reschedule_by, created_at)
values
  ('70000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
   now()+interval '7 days'+interval '15 hours', now()+interval '7 days'+interval '17 hours','scheduled',140,true,'pending_client',
   now()+interval '9 days'+interval '15 hours', now()+interval '9 days'+interval '17 hours','a1000000-0000-4000-8000-000000000001', now()-interval '3 days')
on conflict (id) do nothing;

-- Completed (2 reviewed, 1 awaiting review) + cancelled + no_show
insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, cancelled_at, cancellation_reason, created_at)
values
  ('70000000-0000-4000-8000-000000000010','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000009',
   now()-interval '40 days', now()-interval '40 days'+interval '2 hours','completed',220,true, now()-interval '40 days', null,null, now()-interval '60 days'),
  ('70000000-0000-4000-8000-000000000011','d1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',
   now()-interval '70 days', now()-interval '70 days'+interval '3 hours','completed',180,true, now()-interval '70 days', null,null, now()-interval '90 days'),
  ('70000000-0000-4000-8000-000000000012','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000007',
   now()-interval '18 days', now()-interval '18 days'+interval '2 hours','completed',160,true, now()-interval '18 days', null,null, now()-interval '35 days'),
  ('70000000-0000-4000-8000-000000000013','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005',
   now()-interval '12 days', now()-interval '12 days'+interval '2 hours','cancelled',150,false, null, now()-interval '14 days','Had to reschedule around work', now()-interval '30 days'),
  ('70000000-0000-4000-8000-000000000014','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000010',
   now()-interval '9 days', now()-interval '9 days'+interval '1 hours','no_show',120,true, null,null,null, now()-interval '25 days')
on conflict (id) do nothing;

insert into public.reviews (appointment_id, author_id, artist_id, overall_rating, title, body, is_published, created_at)
values
  ('70000000-0000-4000-8000-000000000010','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000009',5,'Flawless realism','Nadia nailed the portrait — healed beautifully.', true, now()-interval '38 days'),
  ('70000000-0000-4000-8000-000000000011','d1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',5,'Amazing fine-line','Jordan was meticulous. Best tattoo experience yet.', true, now()-interval '68 days')
on conflict (appointment_id) do nothing;
-- (70…12 left unreviewed on purpose → exercises the "Leave a review" flow.)

-- Booking requests: pending, reviewing, offered (+ an offer to respond to)
insert into public.appointment_requests
  (id, client_id, artist_id, title, description, placement, approx_size, is_color, preferred_time_of_day, budget_min, budget_max, status, created_at)
values
  ('71000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','Japanese half-sleeve','Koi and waves, black and grey.','Forearm','Large',false,'afternoon',600,900,'pending', now()-interval '2 days'),
  ('71000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','Watercolor hummingbird','Small colourful piece.','Shoulder','Small',true,'morning',150,250,'reviewing', now()-interval '4 days'),
  ('71000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Fine-line wildflowers','Delicate botanical band.','Wrist','Small',false,'afternoon',150,220,'offered', now()-interval '5 days')
on conflict (id) do nothing;

insert into public.offers
  (id, request_id, artist_id, price_amount, currency_code, proposed_start, proposed_end, deposit_amount, message, status, expires_at, created_at)
values
  ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001',190,'EUR',
   now()+interval '14 days'+interval '11 hours', now()+interval '14 days'+interval '13 hours', 50,
   'Happy to do this! Proposed a morning slot — let me know if it works.', 'pending', now()+interval '5 days', now()-interval '1 days')
on conflict (id) do nothing;

-- Journey for Alex
insert into public.tattoo_journey_entries (id, profile_id, appointment_id, artist_id, entry_type, title, notes, occurred_on)
values
  ('73000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001',null,null,'idea','Started my collection','Saving fine-line + blackwork ideas.', (now()-interval '95 days')::date),
  ('73000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000011','b1000000-0000-4000-8000-000000000001','consultation','Consult with Jordan','Discussed placement and sizing.', (now()-interval '78 days')::date),
  ('73000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000009','appointment','Portrait session','Full black-and-grey portrait.', (now()-interval '40 days')::date),
  ('73000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000009','healing','Healing well','Aftercare on track.', (now()-interval '33 days')::date),
  ('73000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000009','completed','Portrait complete','Fully healed.', (now()-interval '20 days')::date)
on conflict (id) do nothing;

-- =====================================================================
-- 9) CHATS  — client↔artist conversations (text + a booking card).
--    Stable conversation ids so re-runs don't duplicate. Messages inserted
--    oldest→newest so the bump trigger leaves last_message_at correct.
-- =====================================================================
-- Alex ↔ Jordan (artist tester)
insert into public.conversations (id, type, created_by, created_at) values
  ('74000000-0000-4000-8000-000000000001','direct','d1000000-0000-4000-8000-000000000001', now()-interval '80 days'),
  ('74000000-0000-4000-8000-000000000002','direct','d1000000-0000-4000-8000-000000000001', now()-interval '6 days')
on conflict (id) do nothing;
insert into public.conversation_participants (conversation_id, profile_id) values
  ('74000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001')
on conflict do nothing;
insert into public.messages (id, conversation_id, sender_id, type, body, created_at) values
  ('74100000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','text','Hey Jordan! Loved your fine-line work — do you have any slots this month?', now()-interval '80 days'),
  ('74100000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','text','Thanks Alex! Yes — send me a reference and placement and I''ll sort a time.', now()-interval '80 days'+interval '20 min'),
  ('74100000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','text','Amazing, booking now. Thank you!', now()-interval '79 days'),
  ('74100000-0000-4000-8000-000000000004','74000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','text','Hi Iris — is the wildflower band still possible for this month?', now()-interval '6 days'),
  ('74100000-0000-4000-8000-000000000005','74000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','text','Hi Alex! I just sent you an offer with a proposed time — take a look.', now()-interval '1 days')
on conflict (id) do nothing;

-- =====================================================================
-- 10) THE ARTIST TESTER (Jordan) — incoming requests to act on + a chat.
--     Requests FROM seeker clients TO Jordan, in pending/reviewing states.
-- =====================================================================
insert into public.appointment_requests
  (id, client_id, artist_id, title, description, placement, approx_size, is_color, preferred_time_of_day, budget_min, budget_max, status, created_at)
values
  ('75000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','Blackwork forearm band','Solid black band, ~8cm.','Forearm','Medium',false,'evening',200,350,'pending', now()-interval '1 days'),
  ('75000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000008','b1000000-0000-4000-8000-000000000001','Script lettering','A short quote in fine script.','Ribs','Small',false,'afternoon',150,250,'pending', now()-interval '2 days'),
  ('75000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Fine-line fern','Single fern, minimal.','Ankle','Small',false,'morning',120,180,'reviewing', now()-interval '3 days')
on conflict (id) do nothing;

-- Jordan ↔ a client chat (client asking about a piece)
insert into public.conversations (id, type, created_by, created_at) values
  ('76000000-0000-4000-8000-000000000001','direct','c1000000-0000-4000-8000-000000000002', now()-interval '2 days')
on conflict (id) do nothing;
insert into public.conversation_participants (conversation_id, profile_id) values
  ('76000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002'),
  ('76000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001')
on conflict do nothing;
insert into public.messages (id, conversation_id, sender_id, type, body, created_at) values
  ('76100000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','text','Hi Jordan, sent a request for a forearm band — flexible on timing.', now()-interval '2 days'),
  ('76100000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','text','Got it — reviewing now, will send an offer shortly.', now()-interval '1 days'+interval '2 hours')
on conflict (id) do nothing;

-- =====================================================================
-- 11) THE STUDIO TESTER (Mara / Iron Lotus) — application chats so the
--     Applications inbox + Team tab are populated. (Roster/revenue/reviews
--     already seeded in §4 + §7.) booking_card 'application' messages mirror
--     what the app sends.
-- =====================================================================
-- The two Iron Lotus applicants (a1…010 Tom Vega, a1…005 Elsa Nord) each get an
-- application conversation (booking_card message) + an owner notification.
insert into public.conversations (id, type, studio_id, created_by, created_at) values
  ('77000000-0000-4000-8000-000000000010','direct','50000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000010', now()-interval '3 days'),
  ('77000000-0000-4000-8000-000000000005','direct','50000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005', now()-interval '2 days')
on conflict (id) do nothing;
insert into public.conversation_participants (conversation_id, profile_id) values
  ('77000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000010'),
  ('77000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000001'),
  ('77000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005'),
  ('77000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000001')
on conflict do nothing;
insert into public.messages (id, conversation_id, sender_id, type, body, metadata, created_at) values
  ('77100000-0000-4000-8000-000000000010','77000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000010','booking_card','🎨 Application to join your studio',
   jsonb_build_object('kind','application','studioId','50000000-0000-4000-8000-000000000001','artistId','a1000000-0000-4000-8000-000000000010'), now()-interval '3 days'),
  ('77100000-0000-4000-8000-000000000005','77000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','booking_card','🎨 Application to join your studio',
   jsonb_build_object('kind','application','studioId','50000000-0000-4000-8000-000000000001','artistId','a1000000-0000-4000-8000-000000000005'), now()-interval '2 days')
on conflict (id) do nothing;

-- Application notifications to the studio owner (drives the #53 badge).
insert into public.notifications (id, recipient_id, type, title, body, entity_type, entity_id, data, created_at) values
  ('78000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000001','membership_request','New artist application','Tom Vega applied to join Iron Lotus.','studio','50000000-0000-4000-8000-000000000001',
   jsonb_build_object('artistId','a1000000-0000-4000-8000-000000000010','studioId','50000000-0000-4000-8000-000000000001'), now()-interval '3 days'),
  ('78000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000001','membership_request','New artist application','Elsa Nord applied to join Iron Lotus.','studio','50000000-0000-4000-8000-000000000001',
   jsonb_build_object('artistId','a1000000-0000-4000-8000-000000000005','studioId','50000000-0000-4000-8000-000000000001'), now()-interval '2 days')
on conflict (id) do nothing;

-- =====================================================================
-- 12) NOTIFICATIONS + REWARDS for the seeker tester (populated inbox + badges).
-- =====================================================================
insert into public.notifications (id, recipient_id, type, title, body, entity_type, entity_id, created_at)
values
  ('79000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','offer','New offer','Iris Vale sent you an offer.','appointment_request','71000000-0000-4000-8000-000000000003', now()-interval '1 days'),
  ('79000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','booking_update','Reschedule proposed','Iris Vale proposed a new time for your appointment.','appointment','70000000-0000-4000-8000-000000000003', now()-interval '3 days'),
  ('79000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','review','How was your session?','Leave a review for your appointment with Bruno Costa.','appointment','70000000-0000-4000-8000-000000000012', now()-interval '17 days'),
  ('79000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001','message','New message','Iris Vale sent you a message.','conversation','74000000-0000-4000-8000-000000000002', now()-interval '1 days')
on conflict (id) do nothing;

-- Rewards ledger for Alex: base signup (100, from trigger) + a few earns.
insert into public.reward_transactions (profile_id, type, reason, amount, balance_after, idempotency_key, created_at)
values
  ('d1000000-0000-4000-8000-000000000001','earn','booking_completed',50,150,'seed:alex:bc1', now()-interval '38 days'),
  ('d1000000-0000-4000-8000-000000000001','earn','review_left',20,170,'seed:alex:rl1', now()-interval '37 days'),
  ('d1000000-0000-4000-8000-000000000001','earn','booking_completed',50,220,'seed:alex:bc2', now()-interval '19 days'),
  ('d1000000-0000-4000-8000-000000000001','earn','save',5,225,'seed:alex:sv1', now()-interval '10 days')
on conflict (idempotency_key) do nothing;
update public.reward_points set balance = 225, lifetime_earned = 225, tier = 'silver'
  where profile_id = 'd1000000-0000-4000-8000-000000000001';

-- =====================================================================
-- 13) AUTH TOKEN HYGIENE (re-affirm for every seeded user).
-- =====================================================================
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@seed.inkora.dev' or email like '%@inkora.test';

-- Done. Sign in with seeker@inkora.test / artist@inkora.test / studio@inkora.test (password123).
