-- =====================================================================
-- 0020  CACHE MAINTENANCE
--   (1) reward_points  -> privileged write path (RPC), NOT a trigger
--   (2) artists.rating_avg/count -> trigger on reviews
--   (3) tattoo_ideas.save_count  -> trigger on favorites
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) REWARDS: the single, atomic, idempotent ledger write path.
--     Edge Functions (service_role) call this; clients never write the
--     ledger directly (no RLS insert policy exists). Inserting a ledger
--     row and updating the materialized balance happen in one tx so the
--     balance can never diverge from sum(amount).
-- ---------------------------------------------------------------------
create or replace function public.apply_reward_transaction(
  p_profile_id     uuid,
  p_type           reward_txn_type,
  p_reason         reward_reason,
  p_amount         int,
  p_reference_type text default null,
  p_reference_id   uuid default null,
  p_idempotency_key text default null
)
returns public.reward_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing            public.reward_transactions;
  v_balance             int;
  v_new_balance         int;
  v_new_lifetime_earned int;
  v_new_tier            reward_tier;
  v_txn                 public.reward_transactions;
begin
  -- idempotency: a retried call with the same key returns the prior result
  if p_idempotency_key is not null then
    select * into v_existing
      from reward_transactions where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- ensure the account exists, then lock it for the duration of the tx
  insert into reward_points(profile_id) values (p_profile_id)
    on conflict (profile_id) do nothing;

  select balance into v_balance
    from reward_points where profile_id = p_profile_id
    for update;

  v_new_balance := v_balance + p_amount;
  if v_new_balance < 0 then
    raise exception 'insufficient_points: balance % cannot apply %', v_balance, p_amount
      using errcode = 'check_violation';
  end if;

  insert into reward_transactions
    (profile_id, type, reason, amount, balance_after, reference_type, reference_id, idempotency_key)
  values
    (p_profile_id, p_type, p_reason, p_amount, v_new_balance, p_reference_type, p_reference_id, p_idempotency_key)
  returning * into v_txn;

  v_new_lifetime_earned :=
    (select lifetime_earned from reward_points where profile_id = p_profile_id)
    + greatest(p_amount, 0);

  v_new_tier := case
    when v_new_lifetime_earned >= 5000 then 'platinum'
    when v_new_lifetime_earned >= 2000 then 'gold'
    when v_new_lifetime_earned >= 500  then 'silver'
    else 'bronze'
  end::reward_tier;

  update reward_points set
    balance           = v_new_balance,
    lifetime_earned   = v_new_lifetime_earned,
    lifetime_redeemed = lifetime_redeemed + greatest(-p_amount, 0),
    tier              = v_new_tier,
    tier_updated_at   = case when tier <> v_new_tier then now() else tier_updated_at end
  where profile_id = p_profile_id;

  return v_txn;
end;
$$;

-- privileged-only: revoke from clients, grant to service_role (Edge Functions)
revoke execute on function public.apply_reward_transaction(uuid, reward_txn_type, reward_reason, int, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.apply_reward_transaction(uuid, reward_txn_type, reward_reason, int, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------
-- (2) ARTIST RATING CACHE
-- ---------------------------------------------------------------------
create or replace function public.recompute_artist_rating(p_artist_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update artists a set
    rating_avg = coalesce(
      (select round(avg(overall_rating), 2)
         from reviews r where r.artist_id = p_artist_id and r.is_published), 0),
    rating_count =
      (select count(*)
         from reviews r where r.artist_id = p_artist_id and r.is_published)
  where a.id = p_artist_id;
$$;

create or replace function public.sync_artist_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- recompute for the new artist (INSERT / UPDATE)
  if new.artist_id is not null then
    perform public.recompute_artist_rating(new.artist_id);
  end if;
  -- recompute for the old artist on DELETE, or if artist_id changed
  if old.artist_id is not null and old.artist_id is distinct from new.artist_id then
    perform public.recompute_artist_rating(old.artist_id);
  end if;
  return null;
end;
$$;

create trigger trg_reviews_sync_rating
  after insert or update or delete on public.reviews
  for each row execute function public.sync_artist_rating();

-- ---------------------------------------------------------------------
-- (3) IDEA SAVE-COUNT CACHE
--     Recompute-by-count (not increment) so it is self-healing and
--     correct even if a write is ever missed.
-- ---------------------------------------------------------------------
create or replace function public.recompute_idea_save_count(p_idea_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update tattoo_ideas i set
    save_count = (select count(*) from favorites f
                  where f.target_type = 'idea' and f.target_id = p_idea_id)
  where i.id = p_idea_id;
$$;

create or replace function public.sync_idea_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op in ('INSERT','UPDATE')) and new.target_type = 'idea' then
    perform public.recompute_idea_save_count(new.target_id);
  end if;
  if (tg_op in ('DELETE','UPDATE')) and old.target_type = 'idea'
     and old.target_id is distinct from new.target_id then
    perform public.recompute_idea_save_count(old.target_id);
  end if;
  return null;
end;
$$;

create trigger trg_favorites_sync_save_count
  after insert or update or delete on public.favorites
  for each row execute function public.sync_idea_save_count();
