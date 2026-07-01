-- =====================================================================
-- 0023  AUDIT LOG  (append-only record of privileged transitions)
-- ---------------------------------------------------------------------
-- Written ONLY by privileged code (service_role / SECURITY DEFINER);
-- there is intentionally no client insert/update/delete policy, so it is
-- effectively append-only and tamper-resistant from the API surface.
-- Examples: appointment.transition, moderation.decide, reward.adjust,
-- role.grant. (The reward_transactions ledger is its own audit trail.)
-- =====================================================================
create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references public.profiles(id) on delete set null, -- null = system
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  before         jsonb,
  after          jsonb,
  metadata       jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at     timestamptz not null default now()
);
create index idx_audit_entity on public.audit_log (entity_type, entity_id, created_at desc);
create index idx_audit_actor  on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

-- moderators may read the trail; everyone else is denied (service_role bypasses RLS).
-- No write policy exists -> only privileged code can insert.
create policy audit_moderator_read on public.audit_log for select
  using (public.has_role('moderator'));
