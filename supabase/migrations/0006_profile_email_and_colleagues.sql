-- Two things the team management UI needs that the firm migration did not add.
--
-- 1. An email on profiles. A member list that cannot show who someone is
--    would be useless, and auth.users is not readable through RLS.
-- 2. Permission to read a colleague's profile at all. profiles_select_own
--    allows reading only your own row, which is correct until a firm has more
--    than one person in it.

begin;

alter table profiles add column email text;

-- Backfill from the auth records these profiles already mirror.
update profiles p set email = u.email from auth.users u where u.id = p.id;

-- Keep it populated. The trigger already creates the profile row on signup;
-- it just was not carrying the email across.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn_handle_new_user$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$fn_handle_new_user$;

-- Everyone who shares a firm with the caller. SECURITY DEFINER for the same
-- reason auth_firm_ids() is: resolving "who are my colleagues" from inside a
-- policy on profiles would otherwise depend on reading firm_members under RLS.
create or replace function firm_colleague_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $fn_firm_colleague_ids$
  select m.user_id
  from firm_members m
  where m.firm_id in (select firm_id from firm_members where user_id = auth.uid())
$fn_firm_colleague_ids$;

revoke all on function firm_colleague_ids() from public;
grant execute on function firm_colleague_ids() to authenticated;

-- Additive: profiles_select_own still covers a user with no firm yet, and
-- permissive policies OR together.
create policy "profiles_select_colleagues" on profiles
  for select to authenticated
  using (id in (select firm_colleague_ids()));

commit;
