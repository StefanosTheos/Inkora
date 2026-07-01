-- =====================================================================
-- 0011  NOTIFICATIONS  (in-app inbox)
-- =====================================================================
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         notification_type not null,
  title        text not null,
  body         text,
  data         jsonb not null default '{}'::jsonb,
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index idx_notif_recipient on public.notifications (recipient_id, created_at desc);
create index idx_notif_unread on public.notifications (recipient_id) where read_at is null;
