-- =====================================================================
-- SEED DATA  (run automatically by `supabase db reset`)
-- =====================================================================
-- NOTE: inserting into auth.users fires handle_new_user(), which creates
-- the matching profiles, reward_points, role_grants('seeker') and a
-- welcome reward_transactions row for each user.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CANONICAL TATTOO STYLES
--    Moved to migration 20260629121800_seed_styles.sql so the taxonomy
--    deploys to every environment (including production). The demo data
--    below references these slugs, which that migration provides.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 2. DEMO USERS  (password for all: "password123")
-- ---------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','maya@inkora.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Maya R."}', false, false),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','aria@inkora.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Aria Vance"}', false, false),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','leo@inkora.dev',  extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Leo Marsh"}', false, false),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','theo@inkora.dev', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"display_name":"Theo Black"}', false, false)
on conflict (id) do nothing;

-- email/password identities (enables local login)
insert into auth.identities
  (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','{"sub":"11111111-1111-1111-1111-111111111111","email":"maya@inkora.dev"}','email','maya@inkora.dev', now(), now(), now()),
  (gen_random_uuid(),'22222222-2222-2222-2222-222222222222','{"sub":"22222222-2222-2222-2222-222222222222","email":"aria@inkora.dev"}','email','aria@inkora.dev', now(), now(), now()),
  (gen_random_uuid(),'33333333-3333-3333-3333-333333333333','{"sub":"33333333-3333-3333-3333-333333333333","email":"leo@inkora.dev"}','email','leo@inkora.dev', now(), now(), now()),
  (gen_random_uuid(),'44444444-4444-4444-4444-444444444444','{"sub":"44444444-4444-4444-4444-444444444444","email":"theo@inkora.dev"}','email','theo@inkora.dev', now(), now(), now())
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. FLESH OUT PROFILES (rows already created by the auth trigger)
-- ---------------------------------------------------------------------
update public.profiles set username='maya', city='New York', latitude=40.7128, longitude=-74.0060,
  bio='First tattoo soon — collecting fine line inspiration.', onboarded_at=now()
  where id='11111111-1111-1111-1111-111111111111';
update public.profiles set username='aria_ink', city='New York', latitude=40.7282, longitude=-73.9942,
  bio='Fine line & botanical specialist.', onboarded_at=now()
  where id='22222222-2222-2222-2222-222222222222';
update public.profiles set username='leo_marsh', city='Brooklyn', latitude=40.6782, longitude=-73.9442,
  bio='Blackwork and Japanese large-scale work.', onboarded_at=now()
  where id='33333333-3333-3333-3333-333333333333';
update public.profiles set username='theo_black', city='New York', latitude=40.7308, longitude=-73.9973,
  bio='Owner, Ink & Iron Studio.', onboarded_at=now()
  where id='44444444-4444-4444-4444-444444444444';

-- ---------------------------------------------------------------------
-- 4. ROLE GRANTS (everyone already has 'seeker' from the trigger)
-- ---------------------------------------------------------------------
insert into public.role_grants (profile_id, role) values
  ('22222222-2222-2222-2222-222222222222','artist'),
  ('33333333-3333-3333-3333-333333333333','artist'),
  ('44444444-4444-4444-4444-444444444444','studio_admin')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5. ARTISTS
-- ---------------------------------------------------------------------
-- rating_avg/rating_count are left at 0 and maintained by trg_reviews_sync_rating;
-- the seeded review below recomputes Aria's rating automatically.
insert into public.artists (id, headline, years_experience, hourly_rate, min_charge, is_accepting, instagram_handle, verified_at) values
  ('22222222-2222-2222-2222-222222222222','Fine line & botanical tattoos', 6, 180.00, 120.00, true, 'aria.ink', now()),
  ('33333333-3333-3333-3333-333333333333','Blackwork & Japanese sleeves', 11, 220.00, 200.00, true, 'leo.marsh', now())
on conflict (id) do nothing;

insert into public.artist_styles (artist_id, style_id, is_primary) values
  ('22222222-2222-2222-2222-222222222222', (select id from public.tattoo_styles where slug='fineline'),   true),
  ('22222222-2222-2222-2222-222222222222', (select id from public.tattoo_styles where slug='dotwork'),     false),
  ('33333333-3333-3333-3333-333333333333', (select id from public.tattoo_styles where slug='blackwork'),   true),
  ('33333333-3333-3333-3333-333333333333', (select id from public.tattoo_styles where slug='japanese'),    false)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 6. STUDIO + MEMBERSHIPS
-- ---------------------------------------------------------------------
insert into public.studios (id, owner_id, name, slug, bio, city, country, latitude, longitude, opening_hours) values
  ('55555555-5555-5555-5555-555555555501','44444444-4444-4444-4444-444444444444','Ink & Iron','ink-and-iron',
   'A private studio in Manhattan hosting resident and guest artists.','New York','US',40.7308,-73.9973,
   '{"mon":[["11:00","19:00"]],"tue":[["11:00","19:00"]],"wed":[["11:00","19:00"]],"thu":[["11:00","20:00"]],"fri":[["11:00","20:00"]],"sat":[["12:00","18:00"]]}')
on conflict (id) do nothing;

insert into public.studio_memberships (studio_id, artist_id, role, status, joined_at) values
  ('55555555-5555-5555-5555-555555555501','22222222-2222-2222-2222-222222222222','artist','active', now()),
  ('55555555-5555-5555-5555-555555555501','33333333-3333-3333-3333-333333333333','artist','active', now())
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 7. PORTFOLIOS + IMAGES
-- ---------------------------------------------------------------------
insert into public.portfolios (id, artist_id, title, is_default) values
  ('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Fine Line Work', true),
  ('c0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333','Blackwork Gallery', true)
on conflict (id) do nothing;

insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, placement, sort_order) values
  ('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','portfolio/22222222-2222-2222-2222-222222222222/floral-1.jpg','Botanical forearm','forearm',1),
  ('c0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','portfolio/22222222-2222-2222-2222-222222222222/floral-2.jpg','Minimal wildflower','ankle',2),
  ('c0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333','portfolio/33333333-3333-3333-3333-333333333333/dragon-1.jpg','Half sleeve dragon','arm',1);

-- ---------------------------------------------------------------------
-- 8. TATTOO IDEAS (inspiration feed) + STYLE TAGS
-- ---------------------------------------------------------------------
insert into public.tattoo_ideas (id, created_by, source_artist_id, title, description, image_path, is_public, moderation_status) values
  ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Delicate wildflowers','Single-needle wildflower spray','ideas/22222222-2222-2222-2222-222222222222/wf.jpg', true,'approved'),
  ('b0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Fine line snake','Subtle wrap-around serpent','ideas/22222222-2222-2222-2222-222222222222/snake.jpg', true,'approved'),
  ('b0000000-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','Blackwork koi','Bold negative-space koi','ideas/33333333-3333-3333-3333-333333333333/koi.jpg', true,'approved'),
  ('b0000000-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','Geometric mandala','Dotwork mandala back piece','ideas/33333333-3333-3333-3333-333333333333/mandala.jpg', true,'approved'),
  ('b0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111', null,'Tiny moon phases','Saved idea for my first piece','ideas/11111111-1111-1111-1111-111111111111/moon.jpg', true,'approved')
on conflict (id) do nothing;

insert into public.idea_styles (idea_id, style_id) values
  ('b0000000-0000-0000-0000-000000000001',(select id from public.tattoo_styles where slug='fineline')),
  ('b0000000-0000-0000-0000-000000000002',(select id from public.tattoo_styles where slug='fineline')),
  ('b0000000-0000-0000-0000-000000000003',(select id from public.tattoo_styles where slug='blackwork')),
  ('b0000000-0000-0000-0000-000000000004',(select id from public.tattoo_styles where slug='dotwork')),
  ('b0000000-0000-0000-0000-000000000004',(select id from public.tattoo_styles where slug='geometric')),
  ('b0000000-0000-0000-0000-000000000005',(select id from public.tattoo_styles where slug='fineline'))
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 9. ARTIST AVAILABILITY (Aria: Mon–Fri)
-- ---------------------------------------------------------------------
insert into public.artist_availability (artist_id, day_of_week, start_time, end_time, timezone) values
  ('22222222-2222-2222-2222-222222222222',1,'11:00','19:00','America/New_York'),
  ('22222222-2222-2222-2222-222222222222',2,'11:00','19:00','America/New_York'),
  ('22222222-2222-2222-2222-222222222222',3,'11:00','19:00','America/New_York'),
  ('22222222-2222-2222-2222-222222222222',4,'11:00','20:00','America/New_York'),
  ('22222222-2222-2222-2222-222222222222',5,'11:00','20:00','America/New_York')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10. MAYA'S BOARD + FAVORITES
-- ---------------------------------------------------------------------
insert into public.boards (id, profile_id, name) values
  ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','First Tattoo Ideas')
on conflict (id) do nothing;

insert into public.favorites (profile_id, target_type, target_id, board_id) values
  ('11111111-1111-1111-1111-111111111111','idea',  'b0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111','idea',  'b0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111','artist','22222222-2222-2222-2222-222222222222', null)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 11. CONVERSATION + MESSAGES (Maya <-> Aria)
-- ---------------------------------------------------------------------
insert into public.conversations (id, type, created_by, last_message_at, last_message_preview) values
  ('66666666-6666-6666-6666-666666666601','direct','11111111-1111-1111-1111-111111111111', now(), 'Sounds great — let''s book it!')
on conflict (id) do nothing;

insert into public.conversation_participants (conversation_id, profile_id, last_read_at) values
  ('66666666-6666-6666-6666-666666666601','11111111-1111-1111-1111-111111111111', now()),
  ('66666666-6666-6666-6666-666666666601','22222222-2222-2222-2222-222222222222', now())
on conflict do nothing;

insert into public.messages (conversation_id, sender_id, type, body) values
  ('66666666-6666-6666-6666-666666666601','11111111-1111-1111-1111-111111111111','text','Hi Aria! I love your fine line wildflowers — would you do a small one on the forearm?'),
  ('66666666-6666-6666-6666-666666666601','22222222-2222-2222-2222-222222222222','text','Hi Maya! Absolutely, that''s right in my wheelhouse. Want to send a reference?'),
  ('66666666-6666-6666-6666-666666666601','11111111-1111-1111-1111-111111111111','text','Sounds great — let''s book it!');

-- ---------------------------------------------------------------------
-- 12. BOOKING FLOW: request -> offer -> completed appointment -> review
-- ---------------------------------------------------------------------
insert into public.appointment_requests (id, client_id, artist_id, studio_id, conversation_id, idea_id, title, description, placement, approx_size, is_color, budget_min, budget_max, status) values
  ('77777777-7777-7777-7777-777777777701','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555501','66666666-6666-6666-6666-666666666601','b0000000-0000-0000-0000-000000000001','Fine line wildflowers','Small wildflower spray, inner forearm','forearm','~8cm', false, 150.00, 300.00,'converted')
on conflict (id) do nothing;

insert into public.offers (id, request_id, artist_id, proposed_start, proposed_end, price_amount, deposit_amount, status) values
  ('88888888-8888-8888-8888-888888888801','77777777-7777-7777-7777-777777777701','22222222-2222-2222-2222-222222222222', now() - interval '14 days', now() - interval '14 days' + interval '2 hours', 240.00, 50.00,'accepted')
on conflict (id) do nothing;

insert into public.appointments (id, request_id, offer_id, client_id, artist_id, studio_id, scheduled_start, scheduled_end, status, price_amount, deposit_amount, deposit_paid, completed_at) values
  ('99999999-9999-9999-9999-999999999901','77777777-7777-7777-7777-777777777701','88888888-8888-8888-8888-888888888801','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555501', now() - interval '14 days', now() - interval '14 days' + interval '2 hours','completed',240.00,50.00,true, now() - interval '14 days')
on conflict (id) do nothing;

insert into public.reviews (id, appointment_id, author_id, artist_id, studio_id, overall_rating, title, body) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','99999999-9999-9999-9999-999999999901','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555501',5,'Perfect first tattoo','Aria made me so comfortable and the line work is flawless.')
on conflict (id) do nothing;

insert into public.ratings (review_id, dimension, score) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','quality',5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','cleanliness',5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','professionalism',5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','communication',5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','value',4)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 13. SAMPLE NOTIFICATION + AI PREVIEW PLACEHOLDER
-- ---------------------------------------------------------------------
insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id) values
  ('22222222-2222-2222-2222-222222222222','booking_request','New booking request','Maya R. requested a fine line piece.','appointment_request','77777777-7777-7777-7777-777777777701');

insert into public.ai_previews (profile_id, source_idea_id, prompt, style_id, placement, status) values
  ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000005','moon phases along the forearm, fine line',(select id from public.tattoo_styles where slug='fineline'),'forearm','draft');

-- Denormalized caches (artists.rating_avg, tattoo_ideas.save_count) are
-- maintained automatically by triggers from migration 0020 as the rows
-- above are inserted — no manual recompute needed.
