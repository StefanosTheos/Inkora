-- =====================================================================
-- 0018  ROLE GRANTS (base privileges; RLS still gates every row)
-- ---------------------------------------------------------------------
-- RLS is layered ON TOP of SQL privileges. Without these grants the
-- API roles are denied before any policy runs. Defense-in-depth:
--   anon          -> SELECT only (writes also blocked by RLS)
--   authenticated -> CRUD (RLS decides which rows)
--   service_role  -> full access (bypasses RLS; used by Edge Functions)
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;

-- existing tables
grant select                          on all tables in schema public to anon;
grant select, insert, update, delete  on all tables in schema public to authenticated;
grant all                              on all tables in schema public to service_role;

-- sequences (harmless if none today; covers future serial/identity columns)
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- future tables created by later migrations inherit the same grants
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
