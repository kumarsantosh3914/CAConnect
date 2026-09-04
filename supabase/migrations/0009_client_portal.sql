-- ---------------------------------------------------------------------------
-- 0009 — Client Portal
--
-- V2 feature 4. A CA's client gets ONE persistent, read-only link showing
-- their own filing status, documents and fees. No account, no password.
--
-- This is the same authorisation model as the document-upload link, and
-- deliberately so: a 32-byte CSPRNG token IS the credential, checked
-- server-side with the service-role client because an anonymous browser has
-- no auth.uid() to match against RLS. Read the header of
-- app/api/upload/[token]/route.ts before changing anything here.
--
-- Three differences from an upload link, all intentional:
--
--   1. PERSISTENT, NOT EXPIRING. An upload request is a task with an end; a
--      portal is a standing window the client can bookmark. So there is no
--      expires_at — revocation is `is_active = false`, which the CA controls,
--      instead of a clock nobody remembers setting.
--
--   2. ONE PER CLIENT (unique on client_id). Regenerating issues a new token
--      into the same row, which instantly kills the old link. Without the
--      unique constraint a "regenerate" that inserted instead of updating
--      would leave the old token live — a revocation that silently does not
--      revoke is worse than no revocation at all.
--
--   3. READ-ONLY. Nothing the portal serves can be written by the visitor.
--      The only mutation is the view counter below, written by the server.
--
-- What the portal may show is decided in lib/portal/public.ts, not here, but
-- the rule is worth stating where the table lives: it shows the client their
-- OWN facts. Not draft fees (an unsent figure the CA is still deciding), not
-- notices or their AI drafts (CA work product, and an unreviewed draft in a
-- client's hands is actively harmful), not internal notes, not which staff
-- member is assigned.
-- ---------------------------------------------------------------------------

create table client_portals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  created_by uuid references auth.users on delete set null,
  -- One portal per client. See note 2 above: this constraint is what makes
  -- "regenerate the link" actually revoke the previous one.
  client_id uuid not null references clients on delete cascade unique,
  -- 32 random bytes, base64url. The client's only credential.
  token text not null unique,
  -- Revocation without losing the row's history. A disabled portal returns
  -- the same "not a valid link" response as a token that never existed.
  is_active boolean not null default true,
  -- So the CA can tell whether the client ever actually opened it. Answering
  -- "did they see it?" is most of why a CA would send one.
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_portals_firm_idx on client_portals (firm_id);

create trigger client_portals_set_updated_at
  before update on client_portals
  for each row execute function set_updated_at();

alter table client_portals enable row level security;

-- Firm-scoped like every other domain table. Any member of the firm can see
-- and manage a client's portal link — assignment is a filter, not a
-- permission (see 0007). There is no anon policy: the public page reaches
-- this table only through lib/portal/public.ts, server-side, with the
-- service-role key.
--
-- The second clause of the WITH CHECK is the one that matters, and it is not
-- redundant. `firm_id` comes from the caller's own session, so a row pairing
-- MY firm_id with ANOTHER firm's client_id satisfies the firm test perfectly
-- — and that row would mint a working portal link onto a stranger's client,
-- since the public page trusts client_id to decide what to show.
--
-- `client_id in (select id from clients)` closes it: that subquery is
-- evaluated as the caller, so RLS on `clients` restricts it to the caller's
-- own firm. It must NOT be rewritten to go through a security definer helper,
-- which would skip exactly the check being relied on here.
create policy "client_portals_all_firm" on client_portals
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (
    firm_id in (select auth_firm_ids())
    and client_id in (select id from clients)
  );

-- ---------------------------------------------------------------------------
-- View tracking
--
-- An atomic increment rather than a read-modify-write from the application:
-- two tabs opening the same link would otherwise both read the same count and
-- write the same value back, quietly undercounting.
--
-- SECURITY DEFINER because the caller here is the anonymous portal page. It
-- takes a portal id and writes nothing but the two view columns, so the worst
-- a caller who somehow reached it could do is inflate a counter. Not granted
-- to anon or authenticated: the portal page calls it with the service-role
-- key, which bypasses grants anyway, and nobody else has any business
-- touching it.
-- ---------------------------------------------------------------------------
create or replace function touch_client_portal(portal_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $fn_touch_client_portal$
  update client_portals
     set last_viewed_at = now(),
         view_count = view_count + 1
   where id = portal_id;
$fn_touch_client_portal$;

revoke all on function touch_client_portal(uuid) from public;
