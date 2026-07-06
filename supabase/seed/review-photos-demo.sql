-- =====================================================================
-- Demo: attach tattoo journey photos to some of artist2's reviews so the
-- review photo strip is visible before the real upload flow exists.
-- Reuses existing public 'styles/*.jpg' images (already served publicly).
-- Idempotent: only sets photos on reviews that currently have none.
-- =====================================================================
set search_path = public, extensions;

update public.reviews r
set photo_paths = array['styles/fineline.jpg', 'styles/blackwork.jpg', 'styles/dotwork.jpg']
where r.artist_id = (select id from auth.users where email = 'artist2@inkora.com')
  and coalesce(array_length(r.photo_paths, 1), 0) = 0
  and r.id in (
    select id from public.reviews
    where artist_id = (select id from auth.users where email = 'artist2@inkora.com')
    order by created_at desc
    limit 2
  );
