-- =====================================================================
-- 0037  Voucher redemption idempotency
-- =====================================================================
-- redeem_voucher used a fresh gen_random_uuid() as the ledger key, so a
-- double-tap / network retry could spend points twice. Make the whole
-- redemption idempotent on a client-supplied key.
set search_path = public, extensions;

alter table public.voucher_redemptions
  add column if not exists idempotency_key text unique;

-- replace the old single-arg version (avoids PostgREST overload ambiguity)
drop function if exists public.redeem_voucher(uuid);

create or replace function public.redeem_voucher(p_voucher uuid, p_idempotency_key text default null)
returns public.voucher_redemptions
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.vouchers%rowtype;
  v_me uuid := auth.uid();
  v_code text;
  v_red public.voucher_redemptions;
  v_key text := coalesce(p_idempotency_key, gen_random_uuid()::text);
begin
  -- idempotency: a retry with the same key returns the existing redemption
  select * into v_red from public.voucher_redemptions where idempotency_key = v_key;
  if found then return v_red; end if;

  select * into v from public.vouchers where id = p_voucher and is_active for update;
  if not found then raise exception 'voucher_unavailable'; end if;
  if v.stock is not null and v.stock <= 0 then raise exception 'out_of_stock'; end if;

  -- spend points (idempotent on the same key; raises insufficient_points when short)
  perform public.apply_reward_transaction(v_me, 'redeem', 'redemption', -v.cost_points, 'voucher', p_voucher, 'voucher:' || v_key);
  if v.stock is not null then update public.vouchers set stock = stock - 1 where id = p_voucher; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.voucher_redemptions (profile_id, voucher_id, code, cost_points, expires_at, idempotency_key)
    values (v_me, p_voucher, v_code, v.cost_points, now() + interval '90 days', v_key)
    returning * into v_red;
  return v_red;
end $$;
grant execute on function public.redeem_voucher(uuid, text) to authenticated;
