-- =====================================================================
-- 0038  Harden demo accounts
-- =====================================================================
-- Earlier seed migrations created @inkora.dev demo users with the known
-- password 'password123' and confirmed emails — i.e. real, log-in-able
-- accounts. Scramble their passwords so they can't be used to sign in, while
-- keeping all demo artists/studios/reviews intact for browsing/testing.
-- (OAuth accounts have no password and are unaffected.)
--
-- NOTE: demo/seed DATA must not ship as migrations — it applies to every
-- environment incl. production. New seed data belongs in supabase/seed.sql
-- (local `db reset` only). These historical seeds stay applied; we only
-- neutralize their credentials here.
update auth.users
set encrypted_password = extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf'))
where email like '%@inkora.dev';
