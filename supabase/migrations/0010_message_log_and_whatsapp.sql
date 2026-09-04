-- ---------------------------------------------------------------------------
-- 0010 — Multi-channel message log, for the WhatsApp integration
--
-- V2's last feature. WhatsApp needs exactly what email already has — a record
-- of what was sent, with a uniqueness rule that stops a retry or an
-- overlapping cron run from messaging a client twice — so it reuses that
-- table rather than growing a parallel one beside it.
--
-- `email_log` is therefore renamed to `message_log`. A table called email_log
-- holding WhatsApp sends is a trap for whoever reads it next, and this is the
-- cheapest moment to fix the name: the table is small, append-only, and has
-- exactly one reader (the reminder cron).
--
-- The dedupe key gains `channel`. Without it a deadline already emailed at
-- T-1 could never also be sent over WhatsApp, because the two sends would
-- collide on (kind, subject_id, variant) — the reminder would silently vanish
-- for whichever channel ran second.
--
-- Delivery columns are new and nullable. WhatsApp reports asynchronously over
-- a webhook (sent → delivered → read, or failed), so the row is written
-- before the send and updated when Meta calls back. Email leaves them null
-- today; Resend has the same shape of webhook if we ever want it.
-- ---------------------------------------------------------------------------

alter table email_log rename to message_log;

-- Constraint names do not follow a table rename, so they still say email_log.
-- Renaming them keeps \d output honest.
alter table message_log rename constraint email_log_pkey to message_log_pkey;
alter table message_log rename constraint email_log_firm_id_fkey to message_log_firm_id_fkey;

alter table message_log
  -- 'email' | 'whatsapp'. Text rather than an enum: adding a channel should
  -- not need a migration that locks the table.
  add column channel text not null default 'email',
  -- The provider's own id (Resend id, or Meta's wamid), for tracing a message
  -- back to their dashboard when a client says they never got it.
  add column provider_message_id text,
  -- null until a webhook says otherwise. 'sent' | 'delivered' | 'read' | 'failed'
  add column status text,
  add column status_at timestamptz,
  add column error text;

-- The old key was (kind, subject_id, variant), which cannot express "emailed
-- AND messaged on WhatsApp about the same deadline". It was declared inline as
-- a UNIQUE constraint, so it has to be dropped as a constraint — dropping the
-- index it owns is refused.
alter table message_log drop constraint if exists email_log_kind_subject_id_variant_key;

create unique index message_log_dedupe_idx
  on message_log (channel, kind, subject_id, variant);

-- Looking up a row from a webhook callback, which knows only the provider id.
create index message_log_provider_idx
  on message_log (provider_message_id) where provider_message_id is not null;

-- The policy was renamed in 0005 but still carries the old table's name.
drop policy if exists "email_log_read_firm" on message_log;

-- Read-only to the firm. Nothing in the app writes this from a user session —
-- the reminder cron and the WhatsApp webhook both write it with the
-- service-role key, because neither has a user.
create policy "message_log_read_firm" on message_log
  for select to authenticated using (firm_id in (select auth_firm_ids()));
