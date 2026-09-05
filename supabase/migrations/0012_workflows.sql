-- 0012 — Reconciliation, KYC and notice-tracker workflows.
-- All new records retain the firm-scoped RLS model introduced in 0005.

-- ADD VALUE cannot be used inside a transaction and then immediately referenced
-- in the same transaction, so it runs outside the begin/commit block.
alter type document_request_status add value if not exists 'submitted';

begin;

create type kyc_item_status as enum ('pending', 'uploaded', 'verified', 'reupload_requested');
create type reconciliation_status as enum ('in_progress', 'done');
create type reconciliation_match_type as enum ('purchase_only', 'gstr_only', 'amount_mismatch');
create type reconciliation_resolution as enum ('unresolved', 'follow_up_supplier', 'accepted_difference', 'resolved');
create type notice_case_status as enum (
  'received', 'response_drafted', 'response_sent', 'hearing_scheduled',
  'order_received', 'closed', 'appeal_filed', 'appeal_pending', 'appeal_order'
);

-- A KYC classification is deliberately separate from the old, broad client
-- type: changing historical client classifications would be a data migration,
-- not an onboarding improvement.
alter table clients add column kyc_entity_type text;
alter table clients add constraint clients_kyc_entity_type_check check (
  kyc_entity_type is null or kyc_entity_type in (
    'individual', 'proprietorship', 'partnership', 'llp',
    'private_limited', 'public_limited', 'huf'
  )
);

alter table document_requests add column request_kind text not null default 'general'
  check (request_kind in ('general', 'kyc'));
alter table document_request_items add column verification_status kyc_item_status not null default 'pending';
alter table document_request_items add column verification_note text;
create unique index document_requests_one_active_kyc_idx
  on document_requests (client_id)
  where request_kind = 'kyc' and status in ('open', 'submitted');

-- Existing draft data remains valid; manually-created tracked matters do not
-- require text to feed an AI model.
alter table notices alter column notice_text drop not null;
alter table notices add column tracker_enabled boolean not null default false;
alter table notices add column case_status notice_case_status;
alter table notices add column notice_date date;
alter table notices add column response_deadline date;
alter table notices add column amount_in_dispute_paise bigint check (amount_in_dispute_paise >= 0);
alter table notices add column assigned_to uuid references auth.users on delete set null;
create index notices_tracker_status_idx on notices (firm_id, case_status) where tracker_enabled;
create index notices_response_deadline_idx on notices (response_deadline) where tracker_enabled and response_deadline is not null;

create table notice_hearings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  notice_id uuid not null references notices on delete cascade,
  hearing_date date not null,
  notes text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notice_hearings_firm_date_idx on notice_hearings (firm_id, hearing_date);
create trigger notice_hearings_set_updated_at before update on notice_hearings for each row execute function set_updated_at();
alter table notice_hearings enable row level security;
create policy "notice_hearings_all_firm" on notice_hearings for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

create table notice_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  notice_id uuid not null references notices on delete cascade,
  event_type text not null check (event_type in ('note', 'status_change')),
  body text,
  from_status notice_case_status,
  to_status notice_case_status,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index notice_events_notice_idx on notice_events (notice_id, created_at desc);
alter table notice_events enable row level security;
create policy "notice_events_all_firm" on notice_events for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

alter table documents add column notice_id uuid references notices on delete set null;
create index documents_notice_idx on documents (notice_id) where notice_id is not null;

create table reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  client_id uuid not null references clients on delete cascade,
  period_month date not null check (date_trunc('month', period_month) = period_month),
  status reconciliation_status not null default 'in_progress',
  purchase_file_path text not null,
  gstr_file_path text not null,
  purchase_total integer not null default 0,
  gstr_total integer not null default 0,
  mismatch_total integer not null default 0,
  created_by uuid references auth.users on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period_month)
);
create index reconciliation_runs_firm_period_idx on reconciliation_runs (firm_id, period_month desc);
create trigger reconciliation_runs_set_updated_at before update on reconciliation_runs for each row execute function set_updated_at();
alter table reconciliation_runs enable row level security;
create policy "reconciliation_runs_all_firm" on reconciliation_runs for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

create table reconciliation_mismatches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  run_id uuid not null references reconciliation_runs on delete cascade,
  match_type reconciliation_match_type not null,
  supplier_gstin text not null,
  invoice_number text not null,
  invoice_date date,
  purchase_amount_paise bigint,
  gstr_amount_paise bigint,
  difference_paise bigint not null,
  resolution reconciliation_resolution not null default 'unresolved',
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reconciliation_mismatches_run_idx on reconciliation_mismatches (run_id, resolution);
create trigger reconciliation_mismatches_set_updated_at before update on reconciliation_mismatches for each row execute function set_updated_at();
alter table reconciliation_mismatches enable row level security;
create policy "reconciliation_mismatches_all_firm" on reconciliation_mismatches for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reconciliation-imports', 'reconciliation-imports', false, 10485760,
  array['text/csv', 'application/json', 'text/plain'])
on conflict (id) do nothing;

create policy "reconciliation_imports_select_firm" on storage.objects for select to authenticated using (
  bucket_id = 'reconciliation-imports' and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
);
create policy "reconciliation_imports_insert_firm" on storage.objects for insert to authenticated with check (
  bucket_id = 'reconciliation-imports' and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
);
create policy "reconciliation_imports_delete_firm" on storage.objects for delete to authenticated using (
  bucket_id = 'reconciliation-imports' and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
);

commit;
