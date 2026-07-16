-- =====================================================================
-- 0042  Rewards are a SEEKER-ONLY feature
-- ---------------------------------------------------------------------
-- Non-seekers (artists / studio owners) previously ACCRUED points they could
-- never see or spend — the rewards UI is only on the seeker dashboard. Worst
-- offender: booking-completed awarded the artist 150 points into a balance
-- they can't reach. Gate the earn path (award_points) and the spend paths
-- (redeem_voucher / redeem_referral) to seekers so nothing is stranded.
--
-- Welcome points are unaffected: handle_new_user seeds them directly at signup
-- (when every account still holds the seeker grant). A user who later converts
-- to artist/studio simply stops accruing and loses access — as intended.
-- =====================================================================
set search_path = public, extensions;

-- Earn path: no-op for anyone without the seeker role.
create or replace function public.award_points(
  p_profile uuid, p_reason reward_reason, p_amount int,
  p_ref_type text, p_ref_id uuid, p_idem text)
returns public.reward_transactions
language plpgsql security definer set search_path = public as $$
declare v_txn public.reward_transactions;
begin
  if not exists (select 1 from role_grants g where g.profile_id = p_profile and g.role = 'seeker') then
    return null; -- rewards are seeker-only; non-seekers never accrue
  end if;
  v_txn := public.apply_reward_transaction(p_profile, 'earn', p_reason, p_amount, p_ref_type, p_ref_id, p_idem);
  -- notify only on a fresh credit (idempotent replays return an older row)
  if v_txn.created_at > now() - interval '5 seconds' then
    perform public.push_notification(p_profile, 'reward', '+' || p_amount || ' points',
      initcap(replace(p_reason::text, '_', ' ')), 'reward', v_txn.id, '{}'::jsonb);
  end if;
  return v_txn;
end $$;

-- Spend path: vouchers.
create or replace function public.redeem_voucher(p_voucher uuid)
returns public.voucher_redemptions
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.vouchers%rowtype;
  v_me uuid := auth.uid();
  v_code text;
  v_red public.voucher_redemptions;
begin
  if not exists (select 1 from role_grants g where g.profile_id = v_me and g.role = 'seeker') then
    raise exception 'rewards_seeker_only';
  end if;
  select * into v from public.vouchers where id = p_voucher and is_active for update;
  if not found then raise exception 'voucher_unavailable'; end if;
  if v.stock is not null and v.stock <= 0 then raise exception 'out_of_stock'; end if;

  perform public.apply_reward_transaction(v_me, 'redeem', 'redemption', -v.cost_points, 'voucher', p_voucher,
    'voucher:' || gen_random_uuid()::text);
  if v.stock is not null then update public.vouchers set stock = stock - 1 where id = p_voucher; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.voucher_redemptions (profile_id, voucher_id, code, cost_points, expires_at)
    values (v_me, p_voucher, v_code, v.cost_points, now() + interval '90 days')
    returning * into v_red;
  return v_red;
end $$;

-- Referral redemption (both sides earn via the now-guarded award_points).
create or replace function public.redeem_referral(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_me uuid := auth.uid();
begin
  if not exists (select 1 from role_grants g where g.profile_id = v_me and g.role = 'seeker') then
    raise exception 'rewards_seeker_only';
  end if;
  select profile_id into v_referrer from public.referral_codes where code = upper(btrim(p_code));
  if v_referrer is null then raise exception 'invalid_code'; end if;
  if v_referrer = v_me then raise exception 'cannot_refer_self'; end if;
  if exists (select 1 from public.referrals where referred_id = v_me) then raise exception 'already_referred'; end if;
  insert into public.referrals (referrer_id, referred_id, code) values (v_referrer, v_me, upper(btrim(p_code)));
  perform public.award_points(v_referrer, 'referral', 200, 'referral', v_me, 'ref_referrer:' || v_me::text);
  perform public.award_points(v_me, 'referral', 100, 'referral', v_referrer, 'ref_referred:' || v_me::text);
  update public.referrals set rewarded = true where referred_id = v_me;
end $$;
