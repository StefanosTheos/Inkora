-- =====================================================================
-- 0001  EXTENSIONS
-- =====================================================================
create extension if not exists "pgcrypto"   with schema extensions;  -- gen_random_uuid()
create extension if not exists "citext"      with schema extensions;  -- case-insensitive text
create extension if not exists "postgis"     with schema extensions;  -- geo radius search
create extension if not exists "pg_trgm"     with schema extensions;  -- fuzzy text search
create extension if not exists "btree_gist"  with schema extensions;  -- exclusion constraints
