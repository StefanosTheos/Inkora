-- =====================================================================
-- 0038  AI TRY-ON: link a preview to the flash it was composed from
-- ---------------------------------------------------------------------
-- The MVP AI try-on composites a chosen FLASH design onto the user's body
-- photo on-device and saves the resulting mockup as an ai_previews row
-- (status 'completed', result_image_path set). Recording which flash it came
-- from lets the result screen offer "Book this design with {artist}" — closing
-- the discovery → try-on → booking loop.
-- =====================================================================
alter table public.ai_previews
  add column if not exists source_flash_id uuid references public.portfolio_images(id) on delete set null;

create index if not exists idx_ai_previews_flash on public.ai_previews (source_flash_id);
