-- =====================================================================
-- 0005  TAXONOMY  (Tattoo Styles, Artist Styles)
-- =====================================================================
set search_path = public, extensions;  -- citext lives in `extensions`

create table public.tattoo_styles (
  id          uuid primary key default gen_random_uuid(),
  slug        citext not null unique,
  name        text   not null,
  description text,
  sort_order  int    not null default 0,
  is_active   boolean not null default true
);

create table public.artist_styles (
  artist_id  uuid not null references public.artists(id) on delete cascade,
  style_id   uuid not null references public.tattoo_styles(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (artist_id, style_id)
);
create index idx_artist_styles_style on public.artist_styles (style_id);
