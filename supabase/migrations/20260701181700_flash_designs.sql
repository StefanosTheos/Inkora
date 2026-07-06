-- =====================================================================
-- 0053  Flash designs
-- =====================================================================
-- Flashes are ready-to-tattoo designs an artist uploads (no consultation
-- needed). They reuse portfolio_images (same storage, moderation, detail
-- page) distinguished by a `kind` column: 'portfolio' or 'flash'.
alter table public.portfolio_images
  add column if not exists kind text not null default 'portfolio'
  check (kind in ('portfolio', 'flash'));

create index if not exists idx_pimg_kind on public.portfolio_images (artist_id, kind, sort_order);
