-- =====================================================================
-- 0048  REVIEW REPLIES
-- ---------------------------------------------------------------------
-- Let the reviewed artist — or the owner of the studio the appointment ran at —
-- post a single public reply to a review. Writes go through a SECURITY DEFINER
-- RPC (not a broad UPDATE policy) so a replier can only touch reply/replied_at,
-- never the rating or body. Passing an empty reply clears it.
-- =====================================================================
set search_path = public, extensions;

alter table public.reviews
  add column if not exists reply       text,
  add column if not exists replied_at  timestamptz;

create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r      public.reviews%rowtype;
  v_text text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  select * into r from public.reviews where id = p_review_id;
  if not found then raise exception 'review_not_found'; end if;
  -- The reviewed artist, or the owner of the studio the appointment ran at.
  if auth.uid() <> r.artist_id
     and not (r.studio_id is not null and public.is_studio_admin(r.studio_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.reviews
     set reply       = v_text,
         replied_at  = case when v_text is null then null else now() end,
         updated_at  = now()
   where id = p_review_id;
end $$;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
