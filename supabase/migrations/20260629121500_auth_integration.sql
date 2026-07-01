-- =====================================================================
-- 0016  SUPABASE AUTH INTEGRATION
-- =====================================================================

-- Auto-provision profile + reward account + seeker role + welcome points
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  insert into public.reward_points (profile_id, balance, lifetime_earned)
  values (new.id, 100, 100);

  insert into public.role_grants (profile_id, role)
  values (new.id, 'seeker');

  insert into public.reward_transactions (profile_id, type, reason, amount, balance_after, idempotency_key)
  values (new.id, 'earn', 'signup', 100, 100, 'signup:' || new.id::text);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Custom access-token hook: inject app roles into the JWT ---------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  claims     jsonb;
  user_roles text[];
begin
  select array_agg(role::text) into user_roles
  from public.role_grants
  where profile_id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb)
            || jsonb_build_object('app_roles', coalesce(to_jsonb(user_roles), '[]'::jsonb));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The hook is executed by the auth admin role; lock it down to that role.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.role_grants to supabase_auth_admin;
