-- =====================================================================
-- 0015  ENABLE RLS + POLICIES  (deny-by-default everywhere)
-- =====================================================================
alter table public.profiles                  enable row level security;
alter table public.role_grants               enable row level security;
alter table public.artists                   enable row level security;
alter table public.studios                    enable row level security;
alter table public.studio_memberships         enable row level security;
alter table public.tattoo_styles              enable row level security;
alter table public.artist_styles              enable row level security;
alter table public.portfolios                 enable row level security;
alter table public.portfolio_images           enable row level security;
alter table public.tattoo_ideas               enable row level security;
alter table public.idea_styles                enable row level security;
alter table public.boards                      enable row level security;
alter table public.favorites                   enable row level security;
alter table public.saved_designs               enable row level security;
alter table public.conversations               enable row level security;
alter table public.conversation_participants   enable row level security;
alter table public.messages                    enable row level security;
alter table public.artist_availability         enable row level security;
alter table public.artist_unavailable_dates    enable row level security;
alter table public.appointment_requests        enable row level security;
alter table public.offers                       enable row level security;
alter table public.appointments                 enable row level security;
alter table public.price_estimations            enable row level security;
alter table public.reviews                      enable row level security;
alter table public.ratings                      enable row level security;
alter table public.reward_points                enable row level security;
alter table public.reward_transactions          enable row level security;
alter table public.notifications                enable row level security;
alter table public.tattoo_journey_entries       enable row level security;
alter table public.ai_previews                  enable row level security;

-- ---- PROFILES --------------------------------------------------------
create policy profiles_read_all   on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---- ROLE GRANTS (read own; writes are privileged/service_role) ------
create policy roles_read_own on public.role_grants for select using (profile_id = auth.uid());

-- ---- ARTISTS ---------------------------------------------------------
create policy artists_read_all on public.artists for select using (true);
create policy artists_write_own on public.artists for all
  using (id = auth.uid()) with check (id = auth.uid() and public.has_role('artist'));

-- ---- STUDIOS ---------------------------------------------------------
create policy studios_read_all  on public.studios for select using (is_active or owner_id = auth.uid());
create policy studios_write_admin on public.studios for all
  using (public.is_studio_admin(id)) with check (owner_id = auth.uid() or public.is_studio_admin(id));

-- ---- STUDIO MEMBERSHIPS ----------------------------------------------
create policy memb_read on public.studio_memberships for select
  using (artist_id = auth.uid() or public.is_studio_admin(studio_id));
create policy memb_admin_write on public.studio_memberships for all
  using (public.is_studio_admin(studio_id)) with check (public.is_studio_admin(studio_id));
create policy memb_self_respond on public.studio_memberships for update
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

-- ---- TAXONOMY --------------------------------------------------------
create policy styles_read on public.tattoo_styles for select using (true);
create policy artist_styles_read  on public.artist_styles for select using (true);
create policy artist_styles_write on public.artist_styles for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

-- ---- PORTFOLIOS ------------------------------------------------------
create policy portfolios_read  on public.portfolios for select using (true);
create policy portfolios_write on public.portfolios for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

create policy pimg_read on public.portfolio_images for select
  using (moderation_status <> 'rejected' or artist_id = auth.uid());
create policy pimg_write on public.portfolio_images for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

-- ---- TATTOO IDEAS ----------------------------------------------------
create policy ideas_read on public.tattoo_ideas for select
  using ((is_public and moderation_status = 'approved' and deleted_at is null)
         or created_by = auth.uid());
create policy ideas_write on public.tattoo_ideas for all
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy idea_styles_read  on public.idea_styles for select using (true);
create policy idea_styles_write on public.idea_styles for all
  using (exists (select 1 from tattoo_ideas i where i.id = idea_id and i.created_by = auth.uid()))
  with check (exists (select 1 from tattoo_ideas i where i.id = idea_id and i.created_by = auth.uid()));

-- ---- BOARDS / FAVORITES / SAVED DESIGNS ------------------------------
create policy boards_read  on public.boards for select using (profile_id = auth.uid() or not is_private);
create policy boards_write on public.boards for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy fav_owner on public.favorites for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy saved_owner on public.saved_designs for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---- MESSAGING -------------------------------------------------------
create policy convo_read   on public.conversations for select using (public.is_conversation_participant(id));
create policy convo_insert on public.conversations for insert with check (created_by = auth.uid());

create policy cp_read       on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));
create policy cp_update_own on public.conversation_participants for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy msg_read on public.messages for select
  using (public.is_conversation_participant(conversation_id) and deleted_at is null);
create policy msg_send on public.messages for insert
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));
create policy msg_edit_own on public.messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- ---- AVAILABILITY (public read so seekers see open slots) ------------
create policy avail_read  on public.artist_availability for select using (true);
create policy avail_write on public.artist_availability for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());
create policy unavail_read  on public.artist_unavailable_dates for select using (true);
create policy unavail_write on public.artist_unavailable_dates for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

-- ---- BOOKING ---------------------------------------------------------
create policy req_read on public.appointment_requests for select
  using (client_id = auth.uid() or artist_id = auth.uid() or public.is_studio_admin(studio_id));
create policy req_client_create on public.appointment_requests for insert
  with check (client_id = auth.uid());
create policy req_party_update on public.appointment_requests for update
  using (client_id = auth.uid() or artist_id = auth.uid())
  with check (client_id = auth.uid() or artist_id = auth.uid());

create policy offer_read on public.offers for select
  using (artist_id = auth.uid()
         or exists (select 1 from appointment_requests r where r.id = request_id and r.client_id = auth.uid()));
create policy offer_artist_write on public.offers for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

create policy appt_read on public.appointments for select
  using (client_id = auth.uid() or artist_id = auth.uid() or public.is_studio_admin(studio_id));
create policy appt_party_update on public.appointments for update
  using (client_id = auth.uid() or artist_id = auth.uid())
  with check (client_id = auth.uid() or artist_id = auth.uid());
-- appointment INSERT is privileged (created from an accepted offer by service_role).

create policy est_read on public.price_estimations for select
  using (artist_id = auth.uid() or client_id = auth.uid());
create policy est_artist_write on public.price_estimations for all
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());

-- ---- REVIEWS / RATINGS ----------------------------------------------
create policy reviews_read on public.reviews for select using (is_published or author_id = auth.uid());
create policy reviews_author_write on public.reviews for all
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy ratings_read on public.ratings for select
  using (exists (select 1 from reviews r where r.id = review_id and (r.is_published or r.author_id = auth.uid())));
create policy ratings_write on public.ratings for all
  using (exists (select 1 from reviews r where r.id = review_id and r.author_id = auth.uid()))
  with check (exists (select 1 from reviews r where r.id = review_id and r.author_id = auth.uid()));

-- ---- REWARDS (read own; ledger mutated only by service_role) ---------
create policy points_read on public.reward_points for select using (profile_id = auth.uid());
create policy txn_read     on public.reward_transactions for select using (profile_id = auth.uid());

-- ---- NOTIFICATIONS ---------------------------------------------------
create policy notif_read      on public.notifications for select using (recipient_id = auth.uid());
create policy notif_mark_read on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---- JOURNEY / AI PREVIEWS (owner-private) ---------------------------
create policy journey_owner on public.tattoo_journey_entries for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy ai_owner on public.ai_previews for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
