-- CAConnect V2 — AI Client Email Drafter
--
-- Mirrors the notices table shape (draft/edited split, model, status), but
-- client_id is NOT NULL: unlike a notice, a client email is always about a
-- specific client — the vision doc's feature is literally "CA selects a
-- client and a topic".

create type client_email_topic as enum (
  'deadline_reminder',
  'document_followup',
  'fee_reminder',
  'custom'
);

create table client_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  topic client_email_topic not null,
  -- Which deadline/document_request/fee this email is about, when the topic
  -- names one. Null for 'custom'. Not a foreign key to a specific table since
  -- the referent varies by topic — the draft route resolves it and re-checks
  -- ownership via RLS before ever reading it.
  subject_id uuid,
  -- The CA's own topic line for 'custom', or extra instructions for any topic.
  notes text,
  -- Split the same way as the body: the AI's original vs. the CA's edit, so
  -- "revert to AI draft" restores both subject and body from what the model
  -- actually wrote, not from whatever the CA has since typed over it.
  draft_subject text,
  edited_subject text,
  draft_body text,
  edited_body text,
  model text,
  status notice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_emails_user_idx on client_emails (user_id, created_at desc);
create index client_emails_client_idx on client_emails (client_id);

create trigger client_emails_set_updated_at
  before update on client_emails
  for each row execute function set_updated_at();

alter table client_emails enable row level security;

create policy "client_emails_all_own" on client_emails
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
