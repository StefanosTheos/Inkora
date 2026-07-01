-- =====================================================================
-- 0008  BOOKING  (Availability, Requests, Offers, Appointments,
--                 Price Estimations)
-- =====================================================================
-- btree_gist (uuid gist opclass) lives in the `extensions` schema and is
-- needed by the exclusion constraint below.
set search_path = public, extensions;

create table public.artist_availability (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  timezone    text not null default 'UTC',
  is_active   boolean not null default true,
  check (end_time > start_time),
  unique (artist_id, day_of_week, start_time, end_time)
);
create index idx_availability_artist on public.artist_availability (artist_id);

create table public.artist_unavailable_dates (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists(id) on delete cascade,
  during     tsrange not null,
  reason     text,
  created_at timestamptz not null default now(),
  exclude using gist (artist_id with =, during with &&)
);

create table public.appointment_requests (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  artist_id       uuid not null references public.artists(id) on delete cascade,
  studio_id       uuid references public.studios(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  idea_id         uuid references public.tattoo_ideas(id) on delete set null,
  title           text not null,
  description     text,
  placement       text,
  approx_size     text,
  is_color        boolean,
  budget_min      numeric(12,2),
  budget_max      numeric(12,2),
  preferred_dates daterange[],
  reference_paths text[] not null default '{}',
  status          request_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_requests_updated before update on public.appointment_requests
  for each row execute function public.set_updated_at();
create index idx_requests_artist on public.appointment_requests (artist_id, status, created_at desc);
create index idx_requests_client on public.appointment_requests (client_id, status);

create table public.offers (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.appointment_requests(id) on delete cascade,
  artist_id      uuid not null references public.artists(id) on delete cascade,
  proposed_start timestamptz,
  proposed_end   timestamptz,
  price_amount   numeric(12,2) not null,
  deposit_amount numeric(12,2),
  currency_code  char(3) not null default 'USD',
  message        text,
  status         offer_status not null default 'pending',
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_offers_updated before update on public.offers
  for each row execute function public.set_updated_at();
create index idx_offers_request on public.offers (request_id, status);

create table public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid references public.appointment_requests(id) on delete set null,
  offer_id            uuid references public.offers(id) on delete set null,
  client_id           uuid not null references public.profiles(id) on delete restrict,
  artist_id           uuid not null references public.artists(id) on delete restrict,
  studio_id           uuid references public.studios(id) on delete set null,
  scheduled_start     timestamptz not null,
  scheduled_end       timestamptz not null,
  status              appointment_status not null default 'scheduled',
  price_amount        numeric(12,2),
  deposit_amount      numeric(12,2),
  deposit_paid        boolean not null default false,
  location_note       text,
  notes               text,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (scheduled_end > scheduled_start)
);
create trigger trg_appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();
create index idx_appointments_artist on public.appointments (artist_id, scheduled_start);
create index idx_appointments_client on public.appointments (client_id, scheduled_start);

create table public.price_estimations (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.appointment_requests(id) on delete cascade,
  idea_id       uuid references public.tattoo_ideas(id) on delete set null,
  artist_id     uuid not null references public.artists(id) on delete cascade,
  client_id     uuid references public.profiles(id) on delete set null,
  placement     text,
  approx_size   text,
  complexity    text check (complexity in ('simple','medium','complex')),
  est_hours     numeric(5,1),
  amount_min    numeric(12,2) not null,
  amount_max    numeric(12,2) not null,
  currency_code char(3) not null default 'USD',
  status        estimation_status not null default 'draft',
  notes         text,
  created_at    timestamptz not null default now(),
  check (amount_max >= amount_min)
);
create index idx_estimations_artist on public.price_estimations (artist_id);
create index idx_estimations_request on public.price_estimations (request_id);

-- deferred FK from messages -> appointment_requests
alter table public.messages
  add constraint messages_request_fk
  foreign key (request_id) references public.appointment_requests(id) on delete set null;
