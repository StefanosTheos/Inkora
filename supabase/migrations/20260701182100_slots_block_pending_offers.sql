-- =====================================================================
-- 0057  Open slots must also avoid the artist's PENDING offers
-- =====================================================================
-- An artist could propose a time to seeker B that overlaps a still-pending offer
-- to seeker A — if both accepted, the appointments would collide. Exclude any
-- time covered by a pending offer (its proposed_start..proposed_end) from the
-- bookable start-times, in addition to booked appointments and blocked dates.
-- A declined offer frees the slot again; an accepted one becomes an appointment
-- (already excluded by the appointments check).
set search_path = public, extensions;

create or replace function public.artist_day_slots(
  p_artist uuid, p_date date, p_slot_minutes int default 60)
returns setof timestamptz
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_dow  int := extract(dow from p_date);
  r      record;
  v_tz   text;
  v_win_start timestamptz;
  v_win_end   timestamptz;
  v_slot timestamptz;
  v_dur  interval := make_interval(mins => greatest(p_slot_minutes, 15));
begin
  for r in
    select start_time, end_time, timezone
    from public.artist_availability
    where artist_id = p_artist and is_active and day_of_week = v_dow
    order by start_time
  loop
    v_tz := coalesce(r.timezone, 'UTC');
    v_win_start := (p_date::text || ' ' || r.start_time::text)::timestamp at time zone v_tz;
    v_win_end   := (p_date::text || ' ' || r.end_time::text)::timestamp at time zone v_tz;
    v_slot := v_win_start;
    while v_slot + v_dur <= v_win_end loop
      if v_slot > now()
        and not exists (
          select 1 from public.appointments a
          where a.artist_id = p_artist
            and a.status in ('scheduled', 'rescheduled')
            and tstzrange(a.scheduled_start, a.scheduled_end) && tstzrange(v_slot, v_slot + v_dur))
        and not exists (
          select 1 from public.offers o
          where o.artist_id = p_artist
            and o.status = 'pending'
            and o.proposed_start is not null and o.proposed_end is not null
            and tstzrange(o.proposed_start, o.proposed_end) && tstzrange(v_slot, v_slot + v_dur))
        and not exists (
          select 1 from public.artist_unavailable_dates u
          where u.artist_id = p_artist
            and u.during && tsrange((v_slot at time zone v_tz), ((v_slot + v_dur) at time zone v_tz)))
      then
        return next v_slot;
      end if;
      v_slot := v_slot + v_dur;
    end loop;
  end loop;
end $$;
grant execute on function public.artist_day_slots(uuid, date, int) to authenticated;
