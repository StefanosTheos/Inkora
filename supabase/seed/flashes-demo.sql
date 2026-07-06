-- =====================================================================
-- Demo: give every artist a few placeholder flash designs so the Flashes tab
-- is populated before artists upload their own. Reuses public 'styles/*.jpg'.
-- Idempotent: skips artists that already have flashes.
-- =====================================================================
set search_path = public, extensions;

-- Ensure every artist has a portfolio to attach flashes to.
insert into public.portfolios (artist_id, title, is_default)
select a.id, 'Portfolio', true
from public.artists a
where not exists (select 1 from public.portfolios p where p.artist_id = a.id);

insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order, kind)
select p.id, a.id, v.img, v.cap, 'approved', v.ord, 'flash'
from public.artists a
join lateral (
  select id from public.portfolios where artist_id = a.id order by is_default desc limit 1
) p on true
cross join (values
  ('styles/fineline.jpg',     'Fine-line flash',   0),
  ('styles/blackwork.jpg',    'Blackwork flash',   1),
  ('styles/traditional.jpg',  'Traditional flash', 2),
  ('styles/dotwork.jpg',      'Dotwork flash',     3)
) as v(img, cap, ord)
where not exists (
  select 1 from public.portfolio_images pi where pi.artist_id = a.id and pi.kind = 'flash'
);
