-- =====================================================================
-- 0007  MESSAGING  (Conversations, Participants, Messages)
-- =====================================================================
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  type                 conversation_type not null default 'direct',
  created_by           uuid references public.profiles(id) on delete set null,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz,
  is_archived     boolean not null default false,
  is_muted        boolean not null default false,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index idx_cp_profile on public.conversation_participants (profile_id) where not is_archived;

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  type            message_type not null default 'text',
  body            text,
  attachments     jsonb not null default '[]'::jsonb,
  request_id      uuid,  -- FK -> appointment_requests added in 0008
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_messages_convo on public.messages (conversation_id, created_at desc);
