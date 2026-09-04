-- CAConnect V2 — the firm/staff multi-tenancy model.
--
-- This is the one-way door. Before this migration a CA account WAS a firm:
-- every domain row carried `user_id` = the single CA's auth uid, and every
-- RLS policy read `user_id = auth.uid()`. After it, a firm is its own entity
-- that several people can belong to with different roles.
--
-- ── The one trick worth understanding ──────────────────────────────────────
-- Legacy firms are created with `firms.id` set to the founder's auth uid,
-- rather than a fresh uuid. That is deliberate and it buys three things:
--
--   1. Zero data movement. Every domain table already stores that exact value
--      in `user_id`, so the column is renamed to `firm_id` and its foreign key
--      repointed — no backfill, no rewrite, no downtime window.
--   2. Storage keeps working. Object paths are `<user_id>/<client_id>/<file>`
--      and the storage policies match on the first path segment. Because the
--      legacy firm id equals that old user_id, every already-uploaded file
--      stays reachable without moving a single object.
--   3. It costs nothing later. `firms.id` is a real independent primary key
--      with its own default; firms created from here on get fresh uuids. The
--      equality is a one-time coincidence for pre-existing rows, not a rule
--      anything depends on.
--
-- What we deliberately did NOT do: reuse the owner's uid as the firm id
-- forever. Ownership is held in `firm_members.role`, so a firm can change
-- hands and one person can belong to several firms.

-- Wrapped in an explicit transaction. Postgres DDL is transactional, so if any
-- statement below fails the whole migration rolls back and the schema is left
-- exactly as it was — rather than half-migrated, which is the genuinely
-- expensive failure to unpick by hand.
begin;

-- ---------------------------------------------------------------------------
-- Firms and membership
-- ---------------------------------------------------------------------------

create type firm_role as enum ('owner', 'staff');

create table firms (
  id uuid primary key default gen_random_uuid(),
  name text,
  city text,
  -- Who created this firm. Used by the founding-owner policy below: without
  -- it, "a firm with no members yet" is claimable by anyone, including an
  -- orphaned firm whose owner's auth user was deleted.
  created_by uuid references auth.users on delete set null,
  -- Billing is per firm, not per person. These moved off `profiles`, where
  -- they never belonged once a firm could have more than one login.
  plan plan_tier not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger firms_set_updated_at
  before update on firms
  for each row execute function set_updated_at();

create table firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role firm_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create index firm_members_user_idx on firm_members (user_id);

-- Exactly one owner per firm. Without this, a bug or a race could leave a
-- firm with two owners or none, and "who can invite people" becomes ambiguous.
create unique index firm_members_one_owner_idx
  on firm_members (firm_id) where role = 'owner';

-- ---------------------------------------------------------------------------
-- The membership lookup every policy depends on
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER on purpose: firm_members itself has RLS, and a policy that
-- had to read firm_members to decide whether you may read firm_members is
-- infinitely recursive. This function is the one place that breaks the cycle.
-- It exposes nothing beyond "which firms does the CALLER belong to" — it takes
-- no arguments, so it cannot be pointed at anyone else.
create or replace function auth_firm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from firm_members where user_id = auth.uid()
$$;

revoke all on function auth_firm_ids() from public;
grant execute on function auth_firm_ids() to authenticated;

-- True only for a firm the caller created that nobody has joined yet.
-- SECURITY DEFINER because it must see firm_members rows the caller cannot
-- (they are not a member yet — that is the entire point).
create or replace function firm_is_unclaimed(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from firms f where f.id = target and f.created_by = auth.uid())
     and not exists (select 1 from firm_members m where m.firm_id = target)
$$;

revoke all on function firm_is_unclaimed(uuid) from public;
grant execute on function firm_is_unclaimed(uuid) to authenticated;

alter table firms enable row level security;
alter table firm_members enable row level security;

create policy "firms_read_own" on firms
  for select to authenticated using (id in (select auth_firm_ids()));

-- Only an owner may rename the firm or change its plan.
create policy "firms_update_owner" on firms
  for update to authenticated
  using (
    id in (select firm_id from firm_members where user_id = (select auth.uid()) and role = 'owner')
  )
  with check (
    id in (select firm_id from firm_members where user_id = (select auth.uid()) and role = 'owner')
  );

-- A firm is created during onboarding by the person who will own it. There is
-- no membership yet at that instant, so this cannot be gated on membership.
create policy "firms_insert_any_authenticated" on firms
  for insert to authenticated with check (true);

create policy "firm_members_read_own_firms" on firm_members
  for select to authenticated using (firm_id in (select auth_firm_ids()));

-- The ONLY membership row a user may insert directly is the founding owner row
-- for a firm they themselves just created, which still has no members.
--
-- An earlier draft of this policy checked only `user_id = auth.uid()` — that
-- you were adding yourself. A dry run against a seeded two-firm database
-- caught what that actually allows: any authenticated user who knows a firm's
-- id can insert themselves into it and read every client, deadline, document
-- and fee that firm owns. Adding yourself is not the same as being allowed in.
--
-- Joining an EXISTING firm goes through accept_firm_invite() below, never
-- through this policy.
create policy "firm_members_insert_founding_owner" on firm_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and firm_is_unclaimed(firm_id)
  );

create policy "firm_members_delete_by_owner" on firm_members
  for delete to authenticated
  using (
    firm_id in (select firm_id from firm_members where user_id = (select auth.uid()) and role = 'owner')
  );

-- ---------------------------------------------------------------------------
-- Backfill: one firm per existing CA, keyed by their own uid (see header)
-- ---------------------------------------------------------------------------

insert into firms (id, name, city, plan, created_by, created_at)
select p.id, p.firm_name, p.city, p.plan, p.id, p.created_at
from profiles p;

insert into firm_members (firm_id, user_id, role)
select p.id, p.id, 'owner' from profiles p;

-- ---------------------------------------------------------------------------
-- profiles becomes strictly per-person
-- ---------------------------------------------------------------------------

alter table profiles drop column firm_name;
alter table profiles drop column city;
alter table profiles drop column plan;

-- ---------------------------------------------------------------------------
-- Domain tables: user_id -> firm_id, plus created_by for provenance
-- ---------------------------------------------------------------------------

-- created_by answers "which person in the firm did this", which was
-- unanswerable while a firm had exactly one login. Backfilling it to the old
-- user_id is factually correct for every legacy row: a single-member firm had
-- nobody else who could have created anything.

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'client_services', 'deadlines', 'document_requests',
    'document_request_items', 'documents', 'fees', 'notices',
    'client_emails', 'email_log'
  ]
  loop
    execute format('alter table %I rename column user_id to firm_id', t);
    execute format('alter table %I drop constraint %I', t, t || '_user_id_fkey');
    execute format(
      'alter table %I add constraint %I foreign key (firm_id) references firms(id) on delete cascade',
      t, t || '_firm_id_fkey'
    );
    execute format(
      'alter table %I add column created_by uuid references auth.users on delete set null', t
    );
    execute format('update %I set created_by = firm_id', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS rewrite: ownership by person -> membership of a firm
-- ---------------------------------------------------------------------------

drop policy "clients_all_own" on clients;
create policy "clients_all_firm" on clients
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "client_services_all_own" on client_services;
create policy "client_services_all_firm" on client_services
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "deadlines_all_own" on deadlines;
create policy "deadlines_all_firm" on deadlines
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "document_requests_all_own" on document_requests;
create policy "document_requests_all_firm" on document_requests
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "document_request_items_all_own" on document_request_items;
create policy "document_request_items_all_firm" on document_request_items
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "documents_all_own" on documents;
create policy "documents_all_firm" on documents
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "fees_all_own" on fees;
create policy "fees_all_firm" on fees
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "notices_all_own" on notices;
create policy "notices_all_firm" on notices
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "client_emails_all_own" on client_emails;
create policy "client_emails_all_firm" on client_emails
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

drop policy "email_log_read_own" on email_log;
create policy "email_log_read_firm" on email_log
  for select to authenticated using (firm_id in (select auth_firm_ids()));

-- ---------------------------------------------------------------------------
-- Storage: same objects, membership-based access
-- ---------------------------------------------------------------------------
--
-- Paths are unchanged (`<firm_id>/<client_id>/<file>`) because the legacy firm
-- id equals the old user_id. What changes is who matches: any member of the
-- firm, not just the one person whose uid happens to be in the path.

drop policy "client_documents_select_own" on storage.objects;
drop policy "client_documents_insert_own" on storage.objects;
drop policy "client_documents_delete_own" on storage.objects;
drop policy "notice_sources_select_own" on storage.objects;
drop policy "notice_sources_insert_own" on storage.objects;
drop policy "notice_sources_delete_own" on storage.objects;

create policy "client_documents_select_firm" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
  );

create policy "client_documents_insert_firm" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
  );

create policy "client_documents_delete_firm" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
  );

create policy "notice_sources_select_firm" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'notice-sources'
    and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
  );

create policy "notice_sources_insert_firm" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'notice-sources'
    and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
  );

create policy "notice_sources_delete_firm" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'notice-sources'
    and (storage.foldername(name))[1] in (select auth_firm_ids()::text)
  );

-- ---------------------------------------------------------------------------
-- Invites (table now, UI next) — so the schema settles in one pass
-- ---------------------------------------------------------------------------

create table firm_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  email text not null,
  role firm_role not null default 'staff',
  -- 32 random bytes, base64url — the same shape as a document upload token.
  token text not null unique,
  invited_by uuid references auth.users on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index firm_invites_firm_idx on firm_invites (firm_id);
create unique index firm_invites_pending_idx
  on firm_invites (firm_id, lower(email)) where accepted_at is null;

alter table firm_invites enable row level security;

create policy "firm_invites_read_own_firm" on firm_invites
  for select to authenticated using (firm_id in (select auth_firm_ids()));

create policy "firm_invites_write_by_owner" on firm_invites
  for all to authenticated
  using (
    firm_id in (select firm_id from firm_members where user_id = (select auth.uid()) and role = 'owner')
  )
  with check (
    firm_id in (select firm_id from firm_members where user_id = (select auth.uid()) and role = 'owner')
  );

-- ---------------------------------------------------------------------------
-- Invite acceptance
-- ---------------------------------------------------------------------------
--
-- An invitee is, by definition, not yet a member — so they cannot read their
-- own invite (the policies above are membership-scoped) and cannot insert
-- their own membership row (the founding-owner policy refuses). Both steps
-- happen here instead, in one SECURITY DEFINER transaction.
--
-- Doing it this way keeps RLS as the authorisation boundary. The alternative
-- was reaching for the service-role client in app code, which would have made
-- a fourth service-role call site and widened the blast radius of the one key
-- that bypasses every policy in the database.

-- What an invitee may see before accepting: the firm's name and the role on
-- offer, nothing else about the firm.
create or replace function firm_invite_preview(invite_token text)
returns table (firm_name text, role firm_role, email text)
language sql
stable
security definer
set search_path = public
as $$
  select f.name, i.role, i.email
  from firm_invites i
  join firms f on f.id = i.firm_id
  where i.token = invite_token
    and i.accepted_at is null
    and i.expires_at > now()
$$;

revoke all on function firm_invite_preview(text) from public;
grant execute on function firm_invite_preview(text) to authenticated;

-- Joins the caller to the firm named by a valid invite. Returns the firm id.
-- Raises rather than silently no-oping, so the caller can tell the difference
-- between "already a member" and "bad token".
create or replace function accept_firm_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite firm_invites%rowtype;
  caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into invite
  from firm_invites
  where token = invite_token
    and accepted_at is null
    and expires_at > now();

  if invite.id is null then
    raise exception 'invite is not valid' using errcode = '22023';
  end if;

  -- The invite is addressed to an email, so only that person may use it even
  -- if the link leaks.
  if lower(invite.email) <> lower(caller_email) then
    raise exception 'invite was issued to a different email address' using errcode = '42501';
  end if;

  insert into firm_members (firm_id, user_id, role)
  values (invite.firm_id, auth.uid(), invite.role)
  on conflict (firm_id, user_id) do nothing;

  update firm_invites set accepted_at = now() where id = invite.id;

  return invite.firm_id;
end;
$$;

revoke all on function accept_firm_invite(text) from public;
grant execute on function accept_firm_invite(text) to authenticated;

commit;
