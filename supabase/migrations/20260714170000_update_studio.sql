-- =====================================================================
-- 0055  STUDIO OWNER: edit studio profile
--   Owner-guarded update of the editable studio fields (name, about/bio,
--   contact, city/address, opening hours). Slug and map coordinates are left
--   immutable here — changing the slug breaks public links, and moving the map
--   pin needs a geocoder (a later enhancement).
-- =====================================================================
set search_path = public, extensions;

create or replace function public.update_studio(
  p_studio_id     uuid,
  p_name          text,
  p_bio           text,
  p_email         text,
  p_phone         text,
  p_website       text,
  p_address_line  text,
  p_city          text,
  p_opening_hours jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_studio_admin(p_studio_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Studio name is required' using errcode = 'check_violation';
  end if;

  update public.studios set
    name          = btrim(p_name),
    bio           = nullif(btrim(coalesce(p_bio, '')), ''),
    email         = nullif(btrim(coalesce(p_email, '')), ''),
    phone         = nullif(btrim(coalesce(p_phone, '')), ''),
    website       = nullif(btrim(coalesce(p_website, '')), ''),
    address_line  = nullif(btrim(coalesce(p_address_line, '')), ''),
    city          = nullif(btrim(coalesce(p_city, '')), ''),
    opening_hours = coalesce(p_opening_hours, opening_hours),
    updated_at    = now()
  where id = p_studio_id;
end;
$$;
grant execute on function public.update_studio(uuid, text, text, text, text, text, text, text, jsonb) to authenticated;
