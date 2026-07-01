-- =====================================================================
-- 0006  CONTENT  (Portfolios, Portfolio Images, Tattoo Ideas,
--                 Idea Styles, Boards, Favorites, Saved Designs)
-- =====================================================================

create table public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  title       text not null default 'Portfolio',
  description text,
  is_default  boolean not null default false,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_portfolios_updated before update on public.portfolios
  for each row execute function public.set_updated_at();
create index idx_portfolios_artist on public.portfolios (artist_id);

create table public.portfolio_images (
  id                uuid primary key default gen_random_uuid(),
  portfolio_id      uuid not null references public.portfolios(id) on delete cascade,
  artist_id         uuid not null references public.artists(id) on delete cascade,
  image_path        text not null,
  caption           text,
  placement         text,
  width             int,
  height            int,
  sort_order        int  not null default 0,
  moderation_status moderation_status not null default 'approved',
  created_at        timestamptz not null default now()
);
create index idx_pimg_artist on public.portfolio_images (artist_id, sort_order);
create index idx_pimg_portfolio on public.portfolio_images (portfolio_id, sort_order);

-- TATTOO IDEAS = inspiration feed content ("pins")
create table public.tattoo_ideas (
  id                uuid primary key default gen_random_uuid(),
  created_by        uuid not null references public.profiles(id) on delete cascade,
  source_artist_id  uuid references public.artists(id) on delete set null,
  title             text,
  description       text,
  image_path        text not null,
  width             int,
  height            int,
  is_public         boolean not null default true,
  save_count        int     not null default 0,
  moderation_status moderation_status not null default 'pending',
  search_tsv        tsvector generated always as
                    (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,''))) stored,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_ideas_updated before update on public.tattoo_ideas
  for each row execute function public.set_updated_at();
create index idx_ideas_feed on public.tattoo_ideas (created_at desc)
  where is_public and deleted_at is null;
create index idx_ideas_search on public.tattoo_ideas using gin (search_tsv);
create index idx_ideas_source_artist on public.tattoo_ideas (source_artist_id);

-- supporting: ideas tagged with styles
create table public.idea_styles (
  idea_id  uuid not null references public.tattoo_ideas(id) on delete cascade,
  style_id uuid not null references public.tattoo_styles(id) on delete cascade,
  primary key (idea_id, style_id)
);
create index idx_idea_styles_style on public.idea_styles (style_id);

-- BOARDS (collections)
create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  is_private  boolean not null default false,
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_boards_updated before update on public.boards
  for each row execute function public.set_updated_at();
create index idx_boards_profile on public.boards (profile_id);

-- FAVORITES (polymorphic save)
create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  target_type favorite_target not null,
  target_id   uuid not null,
  board_id    uuid references public.boards(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (profile_id, target_type, target_id)
);
create index idx_favorites_profile on public.favorites (profile_id, target_type);
create index idx_favorites_target  on public.favorites (target_type, target_id);

-- SAVED DESIGNS (outputs of Create Idea / AI preview); ai_preview_id FK added in 0013
create table public.saved_designs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  ai_preview_id  uuid,
  source_idea_id uuid references public.tattoo_ideas(id) on delete set null,
  title          text,
  image_path     text not null,
  placement      text,
  style_id       uuid references public.tattoo_styles(id),
  notes          text,
  created_at     timestamptz not null default now()
);
create index idx_saved_designs_profile on public.saved_designs (profile_id);
