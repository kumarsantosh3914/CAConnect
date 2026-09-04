-- Fixes: 42P17 infinite recursion detected in policy for relation "firm_members"
--
-- firm_members_delete_by_owner asked "is the caller an owner of this firm?" by
-- selecting from firm_members — inside a policy ON firm_members. Postgres
-- refuses that cycle, so removing a member always failed with 0 rows deleted.
-- The SELECT policy already avoided this by going through auth_firm_ids();
-- the DELETE policy was written with an inline subquery and did not.
--
-- Caught by removing a member against the real database. The dry-run harness
-- did not catch it because it never exercised removal — it now does.

begin;

-- The owner-scoped counterpart to auth_firm_ids(). SECURITY DEFINER for the
-- same reason: it must read firm_members from inside policies that guard
-- firm_members.
create or replace function auth_owned_firm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $fn_auth_owned_firm_ids$
  select firm_id from firm_members where user_id = auth.uid() and role = 'owner'
$fn_auth_owned_firm_ids$;

revoke all on function auth_owned_firm_ids() from public;
grant execute on function auth_owned_firm_ids() to authenticated;

drop policy "firm_members_delete_by_owner" on firm_members;
create policy "firm_members_delete_by_owner" on firm_members
  for delete to authenticated
  using (firm_id in (select auth_owned_firm_ids()));

-- These two never recursed, since they sit on other tables — but they run the
-- same subquery on every row check. Route them through the function too.
drop policy "firms_update_owner" on firms;
create policy "firms_update_owner" on firms
  for update to authenticated
  using (id in (select auth_owned_firm_ids()))
  with check (id in (select auth_owned_firm_ids()));

drop policy "firm_invites_write_by_owner" on firm_invites;
create policy "firm_invites_write_by_owner" on firm_invites
  for all to authenticated
  using (firm_id in (select auth_owned_firm_ids()))
  with check (firm_id in (select auth_owned_firm_ids()));

commit;
