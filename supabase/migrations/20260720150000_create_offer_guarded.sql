-- =====================================================================
-- 0051  OFFERS: guarded, atomic offer creation
-- ---------------------------------------------------------------------
-- createOffer inserted the offer, then blindly did
--   update appointment_requests set status = 'offered'
-- with no status guard. Offering on a request the client had just
-- cancelled/declined/expired (stale view or race) revived it to 'offered' and
-- left a live, acceptable offer on a dead request. This RPC does the check +
-- insert + status flip in one transaction, locking the request row so a
-- concurrent cancel can't interleave, and only the request's assigned artist
-- may offer while it's still open (pending/reviewing).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.create_offer(
  p_request_id     uuid,
  p_proposed_start timestamptz,
  p_proposed_end   timestamptz,
  p_price_amount   numeric,
  p_deposit_amount numeric     default null,
  p_currency_code  text        default 'EUR',
  p_message        text        default null,
  p_expires_at     timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  r       public.appointment_requests;
  v_offer uuid;
begin
  select * into r from appointment_requests where id = p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if r.artist_id <> v_uid then
    raise exception 'You can only offer on a request sent to you.' using errcode = 'check_violation';
  end if;
  if r.status not in ('pending', 'reviewing') then
    raise exception 'This request is no longer open.' using errcode = 'check_violation';
  end if;
  if p_proposed_end <= p_proposed_start then
    raise exception 'end must be after start' using errcode = 'check_violation';
  end if;

  insert into offers (
    request_id, artist_id, proposed_start, proposed_end, price_amount,
    deposit_amount, currency_code, message, expires_at, status)
  values (
    p_request_id, v_uid, p_proposed_start, p_proposed_end, p_price_amount,
    p_deposit_amount, coalesce(p_currency_code, 'EUR'), p_message,
    coalesce(p_expires_at, least(now() + interval '7 days', p_proposed_start)), 'pending')
  returning id into v_offer;

  update appointment_requests set status = 'offered' where id = p_request_id;

  return v_offer;
end $$;
grant execute on function public.create_offer(uuid, timestamptz, timestamptz, numeric, numeric, text, text, timestamptz) to authenticated;
