-- CAConnect V1 — initial schema
--
-- Tenancy model: every domain row carries user_id = the CA's auth.uid().
-- RLS is enabled on every table with a user_id = auth.uid() policy for all verbs.
-- There is no team/multi-user concept in V1 (that is V2), but user_id is the
-- seam it will grow from. Do not design it away.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type service_type as enum (
  'itr',
  'gstr1',
  'gstr3b',
  'tds',
  'roc',
  'company_registration',
  'other'
);

create type client_type as enum ('individual', 'company', 'firm', 'llp', 'huf', 'trust');

create type deadline_status as enum ('pending', 'in_progress', 'filed', 'done');

create type fee_status as enum ('draft', 'invoiced', 'paid');

create type document_request_status as enum ('open', 'completed', 'expired');

create type document_uploader as enum ('ca', 'client');

create type notice_status as enum ('draft', 'reviewed', 'sent');

create type notice_source as enum ('paste', 'pdf');

create type plan_tier as enum ('starter', 'solo', 'pro', 'team');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per CA (auth user)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  firm_name text,
  full_name text,
  phone text,
  city text,
  plan plan_tier not null default 'starter',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Auto-create a profile row whenever a CA signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  client_type client_type not null default 'individual',
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  email text,
  phone text,
  notes text,
  -- ROC clients: AGM date drives the "within 60 days of AGM" annual return.
  agm_date date,
  -- ITR clients: audit cases file by 31 Oct instead of 31 Jul.
  is_audit_case boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on clients (user_id) where archived_at is null;
create unique index clients_user_pan_idx on clients (user_id, pan) where pan is not null;

create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

alter table clients enable row level security;

create policy "clients_all_own" on clients
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- client_services — service tags per client
-- ---------------------------------------------------------------------------

create table client_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  service_type service_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (client_id, service_type)
);

create index client_services_client_idx on client_services (client_id);

alter table client_services enable row level security;

create policy "client_services_all_own" on client_services
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- deadline_templates — seeded, global, read-only to CAs
-- ---------------------------------------------------------------------------

create table deadline_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  service_type service_type not null,
  label text not null,
  -- 'monthly' | 'quarterly' | 'annual' | 'event'
  frequency text not null,
  -- Shape depends on frequency:
  --   monthly   { "day": 11 }
  --   quarterly { "months": [7,10,1,5], "day": 15 }
  --   annual    { "month": 7, "day": 31 }
  --   event     { "offset_days": 60, "anchor": "agm_date" }
  rule jsonb not null,
  -- Optional extra filter, e.g. {"is_audit_case": true}
  applies_when jsonb,
  description text,
  sort_order int not null default 0
);

alter table deadline_templates enable row level security;

create policy "deadline_templates_read_all" on deadline_templates
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- deadlines — per client, per template, per period
-- ---------------------------------------------------------------------------

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  template_id uuid references deadline_templates on delete set null,
  service_type service_type not null,
  label text not null,
  -- Human-readable period, e.g. 'Sep 2026', 'Q2 FY2026-27', 'AY 2026-27'.
  -- Manual one-off deadlines use 'manual:<uuid>' so they never collide.
  period_label text not null,
  due_date date not null,
  status deadline_status not null default 'pending',
  filed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Makes deadline generation idempotent: re-running never duplicates a row.
create unique index deadlines_unique_period_idx
  on deadlines (client_id, template_id, period_label);
create index deadlines_user_due_idx on deadlines (user_id, due_date);
create index deadlines_client_idx on deadlines (client_id);

create trigger deadlines_set_updated_at
  before update on deadlines
  for each row execute function set_updated_at();

alter table deadlines enable row level security;

create policy "deadlines_all_own" on deadlines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Document collection
-- ---------------------------------------------------------------------------

create table document_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  -- 32 random bytes, base64url. This is the only credential the client has.
  token text not null unique,
  title text not null,
  message text,
  status document_request_status not null default 'open',
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_requests_client_idx on document_requests (client_id);

create trigger document_requests_set_updated_at
  before update on document_requests
  for each row execute function set_updated_at();

alter table document_requests enable row level security;

-- Note: no anon policy. The public upload page reaches this table only through
-- app/api/upload/[token]/, server-side, with the service-role key.
create policy "document_requests_all_own" on document_requests
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  request_id uuid references document_requests on delete set null,
  item_id uuid,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by document_uploader not null default 'client',
  created_at timestamptz not null default now()
);

create index documents_client_idx on documents (client_id);
create index documents_request_idx on documents (request_id);

alter table documents enable row level security;

create policy "documents_all_own" on documents
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table document_request_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  request_id uuid not null references document_requests on delete cascade,
  label text not null,
  is_required boolean not null default true,
  sort_order int not null default 0,
  fulfilled_document_id uuid references documents on delete set null,
  created_at timestamptz not null default now()
);

create index document_request_items_request_idx on document_request_items (request_id);

alter table document_request_items enable row level security;

create policy "document_request_items_all_own" on document_request_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table documents
  add constraint documents_item_id_fkey
  foreign key (item_id) references document_request_items on delete set null;

-- ---------------------------------------------------------------------------
-- fees — amounts are integer paise, never floats
-- ---------------------------------------------------------------------------

create table fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  service_type service_type,
  description text not null,
  amount_paise bigint not null check (amount_paise >= 0),
  status fee_status not null default 'draft',
  due_date date,
  invoiced_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fees_user_status_idx on fees (user_id, status);
create index fees_client_idx on fees (client_id);

create trigger fees_set_updated_at
  before update on fees
  for each row execute function set_updated_at();

alter table fees enable row level security;

create policy "fees_all_own" on fees
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- notices — IT/GST notice text plus the AI draft
-- ---------------------------------------------------------------------------

create table notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id uuid references clients on delete set null,
  title text not null,
  notice_type text,
  source notice_source not null default 'paste',
  notice_text text not null,
  source_file_path text,
  draft_response text,
  edited_response text,
  model text,
  tokens_used int,
  status notice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notices_user_idx on notices (user_id, created_at desc);
create index notices_client_idx on notices (client_id);

create trigger notices_set_updated_at
  before update on notices
  for each row execute function set_updated_at();

alter table notices enable row level security;

create policy "notices_all_own" on notices
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- email_log — dedupe guard for the reminder cron
-- ---------------------------------------------------------------------------

create table email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  -- The thing the email is about (deadline id, document_request id, ...).
  subject_id uuid not null,
  -- Distinguishes the T-7 send from the T-1 send for the same deadline.
  variant text not null default 'default',
  recipient text not null,
  sent_at timestamptz not null default now(),
  unique (kind, subject_id, variant)
);

alter table email_log enable row level security;

create policy "email_log_read_own" on email_log
  for select to authenticated using (user_id = (select auth.uid()));
