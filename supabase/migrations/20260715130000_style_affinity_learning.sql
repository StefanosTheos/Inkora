-- =====================================================================
-- 0036  BEHAVIOURAL STYLE AFFINITY — keep recommendations learning
-- ---------------------------------------------------------------------
-- The onboarding questionnaire seeds user_style_preferences once. This makes
-- those weights keep evolving from real behaviour, so the "Recommended for you"
-- feed grows more tailored over time instead of reflecting a 60-second quiz
-- forever. Each positive signal nudges the weight of the associated styles:
--   * favourite an artist            → their styles      (+2.0)
--   * favourite a portfolio image    → that artist's styles (+1.5)
--   * favourite an idea              → the idea's styles  (+1.0)
--   * complete a booking             → the artist's styles (+3.0, strongest)
--   * visit an artist profile        → their styles      (+0.3, deduped/day)
--   * AI try-on with a style         → that style        (+1.0)
-- Weights are only ever nudged up; the recommender normalises by the user's
-- total weight, so different accumulation rates stay comparable. (A future pass
-- could add time decay.)
-- =====================================================================

-- Increment a user's weight for each of the given styles (creating rows as
-- needed). SECURITY DEFINER so triggers can read taxonomy + write prefs
-- regardless of the acting user's RLS scope; profile_id is always the actor.
create or replace function public.bump_style_affinity(p_profile uuid, p_style_ids uuid[], p_delta numeric)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_style_preferences (profile_id, style_id, weight)
  select p_profile, sid, greatest(p_delta, 0)
  from unnest(p_style_ids) as t(sid)
  where p_profile is not null
  on conflict (profile_id, style_id)
  do update set weight = public.user_style_preferences.weight + excluded.weight,
                updated_at = now();
$$;

-- ---- favourites ------------------------------------------------------
create or replace function public.trg_fav_affinity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_styles uuid[]; v_delta numeric;
begin
  if NEW.target_type = 'artist' then
    select array_agg(style_id) into v_styles from public.artist_styles where artist_id = NEW.target_id;
    v_delta := 2.0;
  elsif NEW.target_type = 'portfolio_image' then
    select array_agg(ast.style_id) into v_styles
    from public.portfolio_images pi
    join public.artist_styles ast on ast.artist_id = pi.artist_id
    where pi.id = NEW.target_id;
    v_delta := 1.5;
  elsif NEW.target_type = 'idea' then
    select array_agg(style_id) into v_styles from public.idea_styles where idea_id = NEW.target_id;
    v_delta := 1.0;
  else
    return NEW; -- studios have no style signal
  end if;
  if v_styles is not null and array_length(v_styles, 1) > 0 then
    perform public.bump_style_affinity(NEW.profile_id, v_styles, v_delta);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_favorites_affinity on public.favorites;
create trigger trg_favorites_affinity after insert on public.favorites
  for each row execute function public.trg_fav_affinity();

-- ---- completed bookings ---------------------------------------------
create or replace function public.trg_appt_affinity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_styles uuid[];
begin
  if NEW.status = 'completed' and (TG_OP = 'INSERT' or OLD.status is distinct from 'completed') then
    select array_agg(style_id) into v_styles from public.artist_styles where artist_id = NEW.artist_id;
    if v_styles is not null and array_length(v_styles, 1) > 0 then
      perform public.bump_style_affinity(NEW.client_id, v_styles, 3.0);
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_appointments_affinity on public.appointments;
create trigger trg_appointments_affinity after insert or update of status on public.appointments
  for each row execute function public.trg_appt_affinity();

-- ---- profile visits (artist) ----------------------------------------
create or replace function public.trg_visit_affinity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_styles uuid[];
begin
  if NEW.target_type = 'artist' and NEW.viewer_id is not null then
    select array_agg(style_id) into v_styles from public.artist_styles where artist_id = NEW.target_id;
    if v_styles is not null and array_length(v_styles, 1) > 0 then
      perform public.bump_style_affinity(NEW.viewer_id, v_styles, 0.3);
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_profile_visits_affinity on public.profile_visits;
create trigger trg_profile_visits_affinity after insert on public.profile_visits
  for each row execute function public.trg_visit_affinity();

-- ---- AI try-on ------------------------------------------------------
create or replace function public.trg_aiprev_affinity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.style_id is not null then
    perform public.bump_style_affinity(NEW.profile_id, array[NEW.style_id], 1.0);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_ai_previews_affinity on public.ai_previews;
create trigger trg_ai_previews_affinity after insert on public.ai_previews
  for each row execute function public.trg_aiprev_affinity();
