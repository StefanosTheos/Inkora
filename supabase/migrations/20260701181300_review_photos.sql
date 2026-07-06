-- =====================================================================
-- 0049  Review journey photos
-- =====================================================================
-- Seekers can attach tattoo progress/journey photos to a review (1 week /
-- 1 month / 1 year healed shots). Reviews are world-readable, so the photos
-- live in a public bucket and their paths hang off the review row. The upload
-- UI comes later; this adds the column + display support.
alter table public.reviews add column if not exists photo_paths text[] not null default '{}';
