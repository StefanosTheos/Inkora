-- =====================================================================
-- Populate a specific artist account for demo/testing.
-- Target: artist2@inkora.com  (edit the email below to reuse for another artist)
-- Idempotent: fixed ids + ON CONFLICT / NOT EXISTS. Safe to re-run.
-- All inserts join auth.users by email, so nothing happens if the account
-- doesn't exist (no errors).
-- =====================================================================
set search_path = public, extensions;

-- 0) Role + artist record + login hygiene + location -------------------
insert into role_grants (profile_id, role)
select id, 'artist' from auth.users where email = 'artist2@inkora.com'
on conflict (profile_id, role) do nothing;

delete from role_grants
where role = 'seeker' and profile_id in (select id from auth.users where email = 'artist2@inkora.com');

insert into artists (id, headline, years_experience, hourly_rate, min_charge, currency_code, is_accepting, rating_avg, rating_count)
select id, 'Fine-line & blackwork', 7, 120, 90, 'EUR', true, 0, 0
from auth.users where email = 'artist2@inkora.com'
on conflict (id) do update set
  headline = coalesce(artists.headline, excluded.headline),
  hourly_rate = coalesce(artists.hourly_rate, excluded.hourly_rate),
  min_charge = coalesce(artists.min_charge, excluded.min_charge),
  is_accepting = true;

update public.profiles set
  display_name = coalesce(nullif(display_name, ''), 'Artist Two'),
  city = coalesce(nullif(city, ''), 'Athens'),
  onboarded_at = coalesce(onboarded_at, now())
where id in (select id from auth.users where email = 'artist2@inkora.com');

insert into public.profiles_private (id, latitude, longitude)
select id, 37.9838, 23.7275 from auth.users where email = 'artist2@inkora.com'
on conflict (id) do update set latitude = excluded.latitude, longitude = excluded.longitude;

update auth.users set
  confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''), email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, ''),
  email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'artist2@inkora.com';

-- 1) Styles ------------------------------------------------------------
insert into public.artist_styles (artist_id, style_id, is_primary)
select u.id, ts.id, (ts.slug = 'fineline')
from auth.users u cross join public.tattoo_styles ts
where u.email = 'artist2@inkora.com' and ts.slug in ('fineline', 'blackwork', 'dotwork')
on conflict (artist_id, style_id) do nothing;

-- 2) Weekly availability (Tue–Sat 11:00–19:00) if none yet -------------
insert into public.artist_availability (artist_id, day_of_week, start_time, end_time, timezone)
select u.id, d.dow, '11:00', '19:00', 'Europe/Athens'
from auth.users u cross join (values (2), (3), (4), (5), (6)) as d(dow)
where u.email = 'artist2@inkora.com'
  and not exists (select 1 from public.artist_availability a where a.artist_id = u.id)
on conflict (artist_id, day_of_week, start_time, end_time) do nothing;

-- 3) Portfolio (default portfolio + a few pieces) if none yet ----------
insert into public.portfolios (id, artist_id, title, is_default)
select 'f0000000-0000-4000-8000-000000000001', u.id, 'Portfolio', true
from auth.users u where u.email = 'artist2@inkora.com'
on conflict (id) do nothing;

insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order)
select 'f0000000-0000-4000-8000-000000000001', u.id, ts.image_path, initcap(ts.slug) || ' piece', 'approved',
       row_number() over (order by ts.slug)
from auth.users u cross join public.tattoo_styles ts
where u.email = 'artist2@inkora.com' and ts.slug in ('fineline', 'blackwork', 'dotwork', 'realism')
  and not exists (select 1 from public.portfolio_images pi where pi.artist_id = u.id);

-- 4) The artist's own designs (so "Design saves" can count) ------------
insert into public.tattoo_ideas (id, created_by, source_artist_id, title, image_path, width, height, is_public, moderation_status, save_count)
select v.id::uuid, u.id, u.id, v.title, v.img, 1200, 1500, true, 'approved', 0
from auth.users u cross join (values
  ('f1000000-0000-4000-8000-000000000001', 'Fine-line fern', 'styles/fineline.jpg'),
  ('f1000000-0000-4000-8000-000000000002', 'Blackwork raven', 'styles/blackwork.jpg'),
  ('f1000000-0000-4000-8000-000000000003', 'Dotwork moon', 'styles/dotwork.jpg')
) as v(id, title, img)
where u.email = 'artist2@inkora.com'
on conflict (id) do nothing;

insert into public.idea_styles (idea_id, style_id)
select v.id::uuid, ts.id
from (values
  ('f1000000-0000-4000-8000-000000000001', 'fineline'),
  ('f1000000-0000-4000-8000-000000000002', 'blackwork'),
  ('f1000000-0000-4000-8000-000000000003', 'dotwork')
) as v(id, slug) join public.tattoo_styles ts on ts.slug = v.slug
on conflict do nothing;

-- 5) Completed appointments (past) — back the reviews ------------------
insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_paid, completed_at, created_at)
select v.id::uuid, v.client::uuid, u.id,
       now() - (v.days || ' days')::interval,
       now() - (v.days || ' days')::interval + interval '2 hours',
       'completed', v.price, true,
       now() - (v.days || ' days')::interval,
       now() - ((v.days + 20) || ' days')::interval
from auth.users u cross join (values
  ('f2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 160, 28),
  ('f2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 200, 55),
  ('f2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 140, 80),
  ('f2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 180, 110)
) as v(id, client, price, days)
where u.email = 'artist2@inkora.com'
on conflict (id) do nothing;

insert into public.reviews
  (appointment_id, author_id, artist_id, overall_rating, title, body, is_published, created_at)
select v.appt::uuid, v.client::uuid, u.id, v.rating, v.title, v.body, true, now() - (v.days || ' days')::interval
from auth.users u cross join (values
  ('f2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 5, 'Incredible fine-line', 'Delicate and precise — healed perfectly.', 26),
  ('f2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 5, 'Bold and clean', 'Blackwork exactly as we discussed.', 53),
  ('f2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 4, 'Great session', 'Really happy with the result.', 78),
  ('f2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 5, 'A true artist', 'Sat for hours and barely noticed.', 108)
) as v(appt, client, rating, title, body, days)
where u.email = 'artist2@inkora.com'
on conflict (appointment_id) do nothing;

-- 6) Upcoming appointments (future, scheduled) — manage the calendar ---
insert into public.appointments
  (id, client_id, artist_id, scheduled_start, scheduled_end, status, price_amount, deposit_amount, deposit_paid, location_note, created_at)
select v.id::uuid, v.client::uuid, u.id,
       now() + (v.days || ' days')::interval + interval '11 hours',
       now() + (v.days || ' days')::interval + interval '13 hours',
       'scheduled', v.price, v.dep, v.paid, v.note, now()
from auth.users u cross join (values
  ('f3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 180, 50, true,  'Consultation + first session', 3),
  ('f3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005', 150, 40, false, null,                          9),
  ('f3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000006', 220, 60, true,  'Full sleeve — session 1',      18)
) as v(id, client, price, dep, paid, note, days)
where u.email = 'artist2@inkora.com'
on conflict (id) do nothing;

-- 7) People who saved this artist ("Saved you") ------------------------
insert into public.favorites (profile_id, target_type, target_id)
select v.cust::uuid, 'artist', u.id
from auth.users u cross join (values
  ('c1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000003'),
  ('c1000000-0000-4000-8000-000000000005'),
  ('d0000000-0000-4000-8000-000000000001')
) as v(cust)
where u.email = 'artist2@inkora.com'
on conflict (profile_id, target_type, target_id) do nothing;

-- 8) People who saved this artist's designs ("Design saves") -----------
insert into public.favorites (profile_id, target_type, target_id)
select v.cust::uuid, 'idea', v.idea::uuid
from (values
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002')
) as v(cust, idea)
on conflict (profile_id, target_type, target_id) do nothing;
