-- =====================================================================
-- 0049  CLIENT REVIEWS  (artist -> client, Airbnb-style)
--   After a session the artist rates the CLIENT across five categories
--   (1-5 each) plus an optional written comment. Other artists read these
--   aggregates + comments to decide whether to take on the case.
--
--   Double-blind: the written comment stays hidden (from the client and from
--   other artists) until either (a) ~14 days pass, or (b) the client also
--   reviews the artist for that appointment. Category stars are always
--   visible; only the free text is gated. This protects candour and blunts
--   tit-for-tat retaliation. The author always sees their own comment.
-- =====================================================================
set search_path = public, extensions;

create table public.client_reviews (
  id             uuid primary key default gen_random_uuid(),
  -- one review per booking (schema-enforced, mirrors public.reviews)
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  author_id      uuid not null references public.artists(id) on delete cascade,  -- reviewing artist
  client_id      uuid not null references public.profiles(id) on delete cascade, -- subject (seeker)
  punctuality    smallint not null check (punctuality   between 1 and 5),
  communication  smallint not null check (communication between 1 and 5),
  preparedness   smallint not null check (preparedness  between 1 and 5),
  sat_well       smallint not null check (sat_well       between 1 and 5),
  respect        smallint not null check (respect        between 1 and 5),
  -- overall is derived (rounded average) so it can never drift from the parts
  overall        smallint generated always as
                   ((punctuality + communication + preparedness + sat_well + respect + 2) / 5) stored,
  comment        text,
  -- when the free-text becomes readable to others / the client (see triggers)
  text_visible_at timestamptz not null default (now() + interval '14 days'),
  created_at     timestamptz not null default now()
);
create index idx_client_reviews_client on public.client_reviews (client_id);

-- ---- Double-blind reveal --------------------------------------------
-- If the client already reviewed this appointment when the artist submits,
-- reveal the comment immediately (both sides are in).
create or replace function public.client_review_reveal_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from reviews r where r.appointment_id = new.appointment_id) then
    new.text_visible_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_client_review_reveal before insert on public.client_reviews
  for each row execute function public.client_review_reveal_on_insert();

-- When the client posts their (seeker->artist) review, reveal any waiting
-- artist comment for the same appointment.
create or replace function public.reveal_client_review_on_seeker_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update client_reviews cr
    set text_visible_at = least(cr.text_visible_at, now())
    where cr.appointment_id = new.appointment_id;
  return null;
end;
$$;
create trigger trg_reveal_client_review after insert on public.reviews
  for each row execute function public.reveal_client_review_on_seeker_review();

-- ---- RLS -------------------------------------------------------------
-- Direct table access is limited to the two parties (the author checks
-- "have I already reviewed?"; the subject may read their own rows). All
-- cross-artist reads go through the SECURITY DEFINER RPC below, which also
-- applies the comment gate that row-level RLS can't express per-column.
alter table public.client_reviews enable row level security;
create policy client_reviews_own_read on public.client_reviews for select
  using (author_id = auth.uid() or client_id = auth.uid());
create policy client_reviews_author_write on public.client_reviews for all
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ---- Read RPC (aggregates + gated comments) --------------------------
-- Any artist may read a client's reviews (to make a booking decision); the
-- subject may read their own. Others get nothing. The comment is nulled and
-- `text_locked` is true until it unlocks (except for the author).
drop function if exists public.client_reviews_for(uuid);
create function public.client_reviews_for(p_client_id uuid)
returns table (
  id            uuid,
  author_name   text,
  author_avatar text,
  punctuality   smallint,
  communication smallint,
  preparedness  smallint,
  sat_well      smallint,
  respect       smallint,
  overall       smallint,
  comment       text,
  text_locked   boolean,
  created_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    cr.id,
    pr.display_name as author_name,
    pr.avatar_path  as author_avatar,
    cr.punctuality, cr.communication, cr.preparedness, cr.sat_well, cr.respect, cr.overall,
    case when cr.text_visible_at <= now() or cr.author_id = auth.uid() then cr.comment end as comment,
    (cr.text_visible_at > now() and cr.author_id <> auth.uid()) as text_locked,
    cr.created_at
  from client_reviews cr
  join profiles pr on pr.id = cr.author_id
  where cr.client_id = p_client_id
    and (
      exists (select 1 from artists a where a.id = auth.uid())  -- any artist may view
      or cr.client_id = auth.uid()                              -- subject views their own
    )
  order by cr.created_at desc
  limit 50;
$$;
grant execute on function public.client_reviews_for(uuid) to authenticated;
