-- =====================================================================
-- 0024  USER STYLE PREFERENCES  (onboarding questionnaire)
--   - style snapshot images for the questionnaire cards
--   - weighted per-user style preferences (weights -> % in the app)
--   - recommendation RPC (artists overlapping the user's top styles)
-- =====================================================================

-- snapshot image per style (public 'styles' bucket; uploaded by admins later)
alter table public.tattoo_styles add column if not exists image_path text;
update public.tattoo_styles set image_path = 'styles/' || slug || '.jpg' where image_path is null;

-- per-user weighted preferences. weight accumulates reaction signal
-- (skip=0, like=1, love=3); percentages are derived in the client.
create table public.user_style_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  style_id   uuid not null references public.tattoo_styles(id) on delete cascade,
  weight     numeric not null default 0 check (weight >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, style_id)
);
create index idx_usp_profile on public.user_style_preferences (profile_id);
create trigger trg_usp_updated before update on public.user_style_preferences
  for each row execute function public.set_updated_at();

alter table public.user_style_preferences enable row level security;
create policy usp_owner on public.user_style_preferences for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- recommendations: accepting artists whose styles overlap the user's top styles,
-- ranked by overlap count then rating. SECURITY INVOKER -> RLS applies (artists are public).
create or replace function public.recommended_artists(p_style_slugs text[], p_limit int default 10)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  headline text,
  rating_avg numeric,
  rating_count int,
  match_count bigint,
  styles text[]
)
language sql
stable
set search_path = public
as $$
  select a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count,
         count(*) filter (where ts.slug = any(p_style_slugs)) as match_count,
         array_agg(distinct ts.slug) as styles
  from artists a
  join profiles p on p.id = a.id
  join artist_styles ast on ast.artist_id = a.id
  join tattoo_styles ts on ts.id = ast.style_id
  where a.is_accepting
  group by a.id, p.display_name, p.avatar_path, a.headline, a.rating_avg, a.rating_count
  having count(*) filter (where ts.slug = any(p_style_slugs)) > 0
  order by match_count desc, a.rating_avg desc nulls last
  limit greatest(p_limit, 1);
$$;

-- public bucket for style snapshot images (world-readable; writes are privileged)
insert into storage.buckets (id, name, public) values ('styles', 'styles', true)
on conflict (id) do nothing;
create policy styles_bucket_read on storage.objects for select using (bucket_id = 'styles');
