-- =====================================================================
-- 0045  STUDIO EDIT: logo, currency, multi-interval hours
-- ---------------------------------------------------------------------
-- The edit screen couldn't set a logo or currency, and its hours editor kept
-- only the first interval per day (silently dropping split shifts). The hours
-- payload was always valid jsonb (arrays of [from,to]); the loss was client-side
-- and is fixed there. Here we add:
--   * studios.currency_code (drives money formatting on the dashboard);
--   * update_studio params for the logo path and currency.
-- =====================================================================
set search_path = public, extensions;

alter table public.studios add column if not exists currency_code char(3) not null default 'EUR';

-- Drop the old 9-arg signature so the two new params don't create a lingering
-- overload (Postgres keys functions by argument list, not name alone).
drop function if exists public.update_studio(uuid, text, text, text, text, text, text, text, jsonb);

create or replace function public.update_studio(
  p_studio_id     uuid,
  p_name          text,
  p_bio           text,
  p_email         text,
  p_phone         text,
  p_website       text,
  p_address_line  text,
  p_city          text,
  p_opening_hours jsonb,
  p_logo_path     text default null,
  p_currency_code text default null
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
    -- keep the current logo when no new one is provided (null = unchanged)
    logo_path     = coalesce(p_logo_path, logo_path),
    currency_code = coalesce(nullif(btrim(coalesce(p_currency_code, '')), ''), currency_code),
    updated_at    = now()
  where id = p_studio_id;
end;
$$;
grant execute on function public.update_studio(uuid, text, text, text, text, text, text, text, jsonb, text, text) to authenticated;
