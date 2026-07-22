-- =====================================================================
-- RE-POINT SEED IMAGERY to the CURRENT contents of the 'portfolio' bucket.
-- Run in the SQL Editor whenever you add / remove / replace images in the
-- seed/ (portfolio + ideas) or flashes/ folders. It rebuilds only the image
-- assignments — artists, studios, appointments, reviews, chats, etc. are left
-- untouched. Idempotent: safe to re-run. Choose "Run without RLS".
--
-- Fixes broken tiles (DB pointing at a deleted file) and surfaces newly-uploaded
-- images, by re-reading live storage and re-assigning portfolio pieces, flashes
-- and feed-idea images from the current pools.
-- =====================================================================
set search_path = public, extensions;
drop table if exists _pool, _flashpool, _ar cascade;

-- PORTFOLIO pool (seed/ folder) + FLASH pool (flashes/ folder). Style matched by
-- normalising the text before " - "; spaces %20-encoded; placeholders skipped;
-- falls back to styles/<slug>.jpg for any style with no uploads.
create temp table _pool as
select ts.slug,
       coalesce(array_agg('portfolio/' || replace(so.name, ' ', '%20') order by so.name)
                  filter (where so.name is not null),
                array['styles/' || ts.slug || '.jpg']) as imgs
from public.tattoo_styles ts
left join storage.objects so
  on so.bucket_id = 'portfolio' and so.name like 'seed/%'
     and so.name not like '%emptyFolderPlaceholder'
     and regexp_replace(lower(split_part(split_part(so.name,'/',2),' - ',1)),'[^a-z0-9]','','g') = replace(ts.slug,'_','')
group by ts.slug;

create temp table _flashpool as
select ts.slug,
       coalesce(array_agg('portfolio/' || replace(so.name, ' ', '%20') order by so.name)
                  filter (where so.name is not null),
                array['styles/' || ts.slug || '.jpg']) as imgs
from public.tattoo_styles ts
left join storage.objects so
  on so.bucket_id = 'portfolio' and so.name like 'flashes/%'
     and so.name not like '%emptyFolderPlaceholder'
     and regexp_replace(lower(split_part(split_part(so.name,'/',2),' - ',1)),'[^a-z0-9]','','g') = replace(ts.slug,'_','')
group by ts.slug;

create temp table _ar as select id as artist_id, row_number() over (order by id) as rn from public.artists;

-- Rebuild portfolio pieces + flashes from the current pools.
delete from public.portfolio_images;

insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order, kind)
select p.id, p.artist_id,
       pl.imgs[1 + ((ar.rn - 1) % array_length(pl.imgs, 1))],
       initcap(replace(ts.slug,'_',' ')) || ' piece', 'approved',
       row_number() over (partition by p.artist_id order by ts.slug), 'portfolio'
from public.portfolios p
join _ar ar on ar.artist_id = p.artist_id
join public.artist_styles ast on ast.artist_id = p.artist_id
join public.tattoo_styles ts on ts.id = ast.style_id
join _pool pl on pl.slug = ts.slug;

insert into public.portfolio_images (portfolio_id, artist_id, image_path, caption, moderation_status, sort_order, kind)
select p.id, p.artist_id,
       fp.imgs[1 + ((ar.rn - 1) % array_length(fp.imgs, 1))],
       initcap(replace(ts.slug,'_',' ')) || ' flash', 'approved',
       row_number() over (partition by p.artist_id order by ts.slug), 'flash'
from public.portfolios p
join _ar ar on ar.artist_id = p.artist_id
join public.artist_styles ast on ast.artist_id = p.artist_id
join public.tattoo_styles ts on ts.id = ast.style_id
join _flashpool fp on fp.slug = ts.slug;

-- Re-point feed-idea images too (they draw from the seed/ pool). Each style's 4
-- ideas rotate through that style's pool by their per-style ordinal.
update public.tattoo_ideas ti
set image_path = pl.imgs[1 + ((r.n - 1) % array_length(pl.imgs, 1))]
from (
  select ti2.id, ts.slug,
         row_number() over (partition by isr.style_id order by ti2.id) as n
  from public.tattoo_ideas ti2
  join public.idea_styles isr on isr.idea_id = ti2.id
  join public.tattoo_styles ts on ts.id = isr.style_id
) r
join _pool pl on pl.slug = r.slug
where ti.id = r.id;
