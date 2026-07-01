-- =====================================================================
-- 0004  IDENTITY & MEMBERSHIP  (Users, Artists, Studios)
-- =====================================================================
-- extension types/functions (citext, postgis) live in the `extensions`
-- schema; make them resolvable during this migration session.
set search_path = public, extensions;

-- ---- USERS -----------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         citext unique,
  display_name     text not null,
  avatar_path      text,
  bio              text,
  pronouns         text,
  birthdate        date,
  city             text,
  latitude         double precision,
  longitude        double precision,
  search_radius_km int  not null default 25 check (search_radius_km between 1 and 500),
  onboarded_at     timestamptz,
  is_active        boolean not null default true,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint username_format check (username is null or (username::text) ~ '^[a-z0-9_]{3,30}$')
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---- ROLE GRANTS (multi-role) ---------------------------------------
create table public.role_grants (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       user_role not null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, role)
);

-- ---- ARTISTS (id == profiles.id) ------------------------------------
create table public.artists (
  id               uuid primary key references public.profiles(id) on delete cascade,
  headline         text,
  years_experience int  check (years_experience >= 0),
  hourly_rate      numeric(12,2),
  min_charge       numeric(12,2),
  currency_code    char(3) not null default 'USD',
  is_guest_artist  boolean not null default false,
  is_accepting     boolean not null default true,
  instagram_handle text,
  verified_at      timestamptz,
  rating_avg       numeric(3,2) not null default 0,
  rating_count     int          not null default 0,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);
create trigger trg_artists_updated before update on public.artists
  for each row execute function public.set_updated_at();

-- ---- STUDIOS ---------------------------------------------------------
create table public.studios (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete restrict,
  name          text not null,
  slug          citext not null unique,
  bio           text,
  logo_path     text,
  email         citext,
  phone         text,
  website       text,
  address_line  text,
  city          text,
  country       char(2),
  latitude      double precision not null,
  longitude     double precision not null,
  geo           geography(Point,4326)
                 generated always as
                 (st_setsrid(st_makepoint(longitude, latitude),4326)::geography) stored,
  opening_hours jsonb   not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_studios_updated before update on public.studios
  for each row execute function public.set_updated_at();
create index idx_studios_geo on public.studios using gist (geo);

-- ---- ARTIST <-> STUDIO ----------------------------------------------
create table public.studio_memberships (
  studio_id  uuid not null references public.studios(id) on delete cascade,
  artist_id  uuid not null references public.artists(id) on delete cascade,
  role       membership_role   not null default 'artist',
  status     membership_status not null default 'invited',
  invited_by uuid references public.profiles(id),
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (studio_id, artist_id)
);
create trigger trg_memberships_updated before update on public.studio_memberships
  for each row execute function public.set_updated_at();
create index idx_memberships_artist_active on public.studio_memberships (artist_id) where status = 'active';
