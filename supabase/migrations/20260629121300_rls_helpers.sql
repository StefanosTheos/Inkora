-- =====================================================================
-- 0014  RLS HELPER FUNCTIONS (SECURITY DEFINER avoids policy recursion)
-- =====================================================================
create or replace function public.is_conversation_participant(c_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = c_id and profile_id = auth.uid()
  );
$$;

create or replace function public.is_studio_admin(s_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from studios where id = s_id and owner_id = auth.uid())
      or exists (select 1 from studio_memberships
                 where studio_id = s_id and artist_id = auth.uid()
                   and role in ('owner','manager') and status = 'active');
$$;

create or replace function public.has_role(r user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from role_grants where profile_id = auth.uid() and role = r);
$$;
