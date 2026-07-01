-- =====================================================================
-- 0013  AI PREVIEWS (placeholder — no inference in MVP)
-- =====================================================================
create table public.ai_previews (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  source_image_path text,
  source_idea_id    uuid references public.tattoo_ideas(id) on delete set null,
  prompt            text,
  style_id          uuid references public.tattoo_styles(id),
  placement         text,
  status            ai_preview_status not null default 'draft',
  result_image_path text,                 -- NULL in MVP
  error             text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);
create index idx_ai_previews_profile on public.ai_previews (profile_id, created_at desc);

-- deferred FK from saved_designs -> ai_previews
alter table public.saved_designs
  add constraint saved_designs_ai_preview_fk
  foreign key (ai_preview_id) references public.ai_previews(id) on delete set null;
