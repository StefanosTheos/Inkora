-- =====================================================================
-- REMOTE DEMO SEED — demo artists, studios, and feed ideas.
-- Idempotent (ON CONFLICT DO NOTHING). Safe to re-run.
-- Feed idea images reuse the uploaded `styles/*.jpg` so tiles render.
-- Delete later with: delete from auth.users where email like '%@demo.inkora.dev';
-- =====================================================================

-- 1) Demo artist auth users (trigger creates profile + seeker role + reward points)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001','authenticated','authenticated','aria@demo.inkora.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Aria Vance"}', false, false),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002','authenticated','authenticated','leo@demo.inkora.dev',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Leo Marsh"}', false, false),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000003','authenticated','authenticated','nina@demo.inkora.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Nina Kai"}', false, false),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000004','authenticated','authenticated','sam@demo.inkora.dev',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Sam Rio"}', false, false),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000005','authenticated','authenticated','zoe@demo.inkora.dev',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Zoe Fen"}', false, false)
on conflict (id) do nothing;

-- 2) Flesh out profiles (Athens area)
update public.profiles set city='Athens', latitude=37.9838, longitude=23.7275, onboarded_at=now(),
  bio='Demo artist on Inkora.'
  where id in (
    'a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000005'
  );
update public.profiles set username='aria_ink'  where id='a0000000-0000-4000-8000-000000000001';
update public.profiles set username='leo_marsh'  where id='a0000000-0000-4000-8000-000000000002';
update public.profiles set username='nina_kai'   where id='a0000000-0000-4000-8000-000000000003';
update public.profiles set username='sam_rio'    where id='a0000000-0000-4000-8000-000000000004';
update public.profiles set username='zoe_fen'    where id='a0000000-0000-4000-8000-000000000005';

-- 3) Grant artist role
insert into public.role_grants(profile_id, role) values
  ('a0000000-0000-4000-8000-000000000001','artist'),
  ('a0000000-0000-4000-8000-000000000002','artist'),
  ('a0000000-0000-4000-8000-000000000003','artist'),
  ('a0000000-0000-4000-8000-000000000004','artist'),
  ('a0000000-0000-4000-8000-000000000005','artist')
on conflict do nothing;

-- 4) Artist records (rating_avg/count set directly for demo; varied for featured vs trending)
insert into public.artists(id, headline, years_experience, hourly_rate, currency_code, is_accepting, verified_at, rating_avg, rating_count) values
  ('a0000000-0000-4000-8000-000000000001','Fine line & botanical work', 6, 160, 'EUR', true, now(), 4.9, 32),
  ('a0000000-0000-4000-8000-000000000002','Blackwork & Japanese sleeves', 11, 200, 'EUR', true, now(), 4.7, 58),
  ('a0000000-0000-4000-8000-000000000003','Realism & watercolor', 8, 220, 'EUR', true, now(), 5.0, 12),
  ('a0000000-0000-4000-8000-000000000004','Traditional & neo-traditional', 9, 180, 'EUR', true, now(), 4.6, 41),
  ('a0000000-0000-4000-8000-000000000005','Geometric & lettering', 4, 140, 'EUR', false, null, 4.8, 20)
on conflict (id) do nothing;

-- 5) Artist styles
insert into public.artist_styles(artist_id, style_id, is_primary) values
  ('a0000000-0000-4000-8000-000000000001',(select id from tattoo_styles where slug='fineline'), true),
  ('a0000000-0000-4000-8000-000000000001',(select id from tattoo_styles where slug='dotwork'), false),
  ('a0000000-0000-4000-8000-000000000002',(select id from tattoo_styles where slug='blackwork'), true),
  ('a0000000-0000-4000-8000-000000000002',(select id from tattoo_styles where slug='japanese'), false),
  ('a0000000-0000-4000-8000-000000000003',(select id from tattoo_styles where slug='realism'), true),
  ('a0000000-0000-4000-8000-000000000003',(select id from tattoo_styles where slug='watercolor'), false),
  ('a0000000-0000-4000-8000-000000000004',(select id from tattoo_styles where slug='traditional'), true),
  ('a0000000-0000-4000-8000-000000000004',(select id from tattoo_styles where slug='neo_traditional'), false),
  ('a0000000-0000-4000-8000-000000000005',(select id from tattoo_styles where slug='geometric'), true),
  ('a0000000-0000-4000-8000-000000000005',(select id from tattoo_styles where slug='lettering'), false)
on conflict do nothing;

-- 6) Studios (Athens)
insert into public.studios(id, owner_id, name, slug, city, country, latitude, longitude, is_active) values
  ('50000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Ink & Iron','ink-iron-athens','Athens','GR',37.9838,23.7275,true),
  ('50000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Needle & Thread','needle-thread-athens','Athens','GR',37.9755,23.7348,true)
on conflict (id) do nothing;

-- 7) Feed ideas (image_path reuses uploaded style images so tiles render)
insert into public.tattoo_ideas(id, created_by, source_artist_id, title, image_path, width, height, is_public, moderation_status) values
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Delicate wildflowers','styles/fineline.jpg',1200,1600,true,'approved'),
  ('10000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Bold blackwork koi','styles/blackwork.jpg',1200,1500,true,'approved'),
  ('10000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','Watercolor phoenix','styles/watercolor.jpg',1080,1080,true,'approved'),
  ('10000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','Traditional rose','styles/traditional.jpg',1200,1400,true,'approved'),
  ('10000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005','Geometric mandala','styles/geometric.jpg',1200,1200,true,'approved'),
  ('10000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','Realism portrait','styles/realism.jpg',1000,1400,true,'approved'),
  ('10000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Japanese dragon','styles/japanese.jpg',1200,1700,true,'approved'),
  ('10000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005','Script lettering','styles/lettering.jpg',1200,800,true,'approved'),
  ('10000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Dotwork moth','styles/dotwork.jpg',1080,1350,true,'approved'),
  ('10000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','Neo-traditional fox','styles/neo_traditional.jpg',1200,1500,true,'approved')
on conflict (id) do nothing;

insert into public.idea_styles(idea_id, style_id) values
  ('10000000-0000-4000-8000-000000000001',(select id from tattoo_styles where slug='fineline')),
  ('10000000-0000-4000-8000-000000000002',(select id from tattoo_styles where slug='blackwork')),
  ('10000000-0000-4000-8000-000000000003',(select id from tattoo_styles where slug='watercolor')),
  ('10000000-0000-4000-8000-000000000004',(select id from tattoo_styles where slug='traditional')),
  ('10000000-0000-4000-8000-000000000005',(select id from tattoo_styles where slug='geometric')),
  ('10000000-0000-4000-8000-000000000006',(select id from tattoo_styles where slug='realism')),
  ('10000000-0000-4000-8000-000000000007',(select id from tattoo_styles where slug='japanese')),
  ('10000000-0000-4000-8000-000000000008',(select id from tattoo_styles where slug='lettering')),
  ('10000000-0000-4000-8000-000000000009',(select id from tattoo_styles where slug='dotwork')),
  ('10000000-0000-4000-8000-000000000010',(select id from tattoo_styles where slug='neo_traditional'))
on conflict do nothing;
