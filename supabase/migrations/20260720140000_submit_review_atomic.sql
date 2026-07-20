-- =====================================================================
-- 0050  REVIEWS: atomic submit (review + dimension ratings in one txn)
-- ---------------------------------------------------------------------
-- submitReview inserted the reviews row, then the five `ratings` rows in a
-- second round-trip. If the ratings insert failed the review persisted
-- (appointment_id is UNIQUE) so the seeker could never retry, and the
-- multi-dimension breakdown was lost forever (getAppointmentReview -> scores
-- null). This RPC writes both in a single transaction — either all six rows
-- commit or none do. It also derives artist_id + studio_id from the appointment
-- (so studio-booking reviews attribute to the studio) and authorizes the caller
-- server-side (must be the appointment's client, on a completed booking).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.submit_review(
  p_appointment_id uuid,
  p_scores         jsonb,
  p_title          text default null,
  p_body           text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  a        public.appointments;
  v_review uuid;
  v_dims   text[] := array['quality', 'cleanliness', 'professionalism', 'communication', 'value'];
  d        text;
  v_score  int;
  v_sum    int := 0;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if a.client_id <> v_uid then
    raise exception 'You can only review your own appointment.' using errcode = 'check_violation';
  end if;
  if a.status <> 'completed' then
    raise exception 'You can review a booking once it is completed.' using errcode = 'check_violation';
  end if;

  -- Validate the five dimensions and sum for the overall average.
  foreach d in array v_dims loop
    v_score := (p_scores ->> d)::int;
    if v_score is null or v_score < 1 or v_score > 5 then
      raise exception 'Each rating must be between 1 and 5.' using errcode = 'check_violation';
    end if;
    v_sum := v_sum + v_score;
  end loop;

  -- One transaction. UNIQUE(appointment_id) enforces one review per booking;
  -- a re-submit raises unique_violation for the caller to surface.
  insert into reviews (appointment_id, author_id, artist_id, studio_id, overall_rating, title, body)
  values (
    p_appointment_id, v_uid, a.artist_id, a.studio_id,
    greatest(1, least(5, round(v_sum::numeric / array_length(v_dims, 1))::int)),
    nullif(btrim(p_title), ''), nullif(btrim(p_body), '')
  )
  returning id into v_review;

  foreach d in array v_dims loop
    insert into ratings (review_id, dimension, score) values (v_review, d, (p_scores ->> d)::int);
  end loop;

  return v_review;
end $$;
grant execute on function public.submit_review(uuid, jsonb, text, text) to authenticated;
