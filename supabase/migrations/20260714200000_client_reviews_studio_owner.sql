-- =====================================================================
-- 0058  Let studio owners read client reviews
--   Studio owners run the business clients book with, so — like artists — they
--   should see how artists rate a client (e.g. when a client reviews their
--   studio). Extend client_reviews_for to also serve studio_admin. Comment
--   double-blind gating is unchanged (only author/subject-after-unlock).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.client_reviews_for(p_client_id uuid)
returns table (
  id            uuid,
  author_name   text,
  author_avatar text,
  punctuality   smallint,
  communication smallint,
  preparedness  smallint,
  sat_well      smallint,
  respect       smallint,
  overall       smallint,
  comment       text,
  text_locked   boolean,
  created_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    cr.id,
    pr.display_name as author_name,
    pr.avatar_path  as author_avatar,
    cr.punctuality, cr.communication, cr.preparedness, cr.sat_well, cr.respect, cr.overall,
    case when cr.text_visible_at <= now() or cr.author_id = auth.uid() then cr.comment end as comment,
    (cr.text_visible_at > now() and cr.author_id <> auth.uid()) as text_locked,
    cr.created_at
  from client_reviews cr
  join profiles pr on pr.id = cr.author_id
  where cr.client_id = p_client_id
    and (
      exists (select 1 from artists a where a.id = auth.uid())  -- any artist
      or public.has_role('studio_admin')                       -- any studio owner
      or cr.client_id = auth.uid()                             -- the subject
    )
  order by cr.created_at desc
  limit 50;
$$;
grant execute on function public.client_reviews_for(uuid) to authenticated;
