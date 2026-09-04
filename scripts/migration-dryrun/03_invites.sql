\set ON_ERROR_STOP off
reset role;
-- CA Two (firm 2222) invites a third person.
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555','junior@test');
insert into firm_invites (firm_id, email, role, token, expires_at, invited_by)
values ('22222222-2222-2222-2222-222222222222','junior@test','staff','tok_good', now() + interval '7 days','22222222-2222-2222-2222-222222222222');
-- An already-expired invite, and one for a different person.
insert into firm_invites (firm_id, email, role, token, expires_at)
values ('22222222-2222-2222-2222-222222222222','expired@test','staff','tok_expired', now() - interval '1 day');

set role authenticated;
set app.current_user_id = '55555555-5555-5555-5555-555555555555';

\echo '=== preview a valid invite (expect One row: firm name + role) ==='
select * from firm_invite_preview('tok_good');

\echo '=== preview a bogus token (expect 0 rows) ==='
select count(*) from firm_invite_preview('tok_nonsense');

\echo '=== preview an expired invite (expect 0 rows) ==='
select count(*) from firm_invite_preview('tok_expired');

\echo '=== junior cannot read firm_invites directly (not a member yet; expect 0) ==='
select count(*) as visible_invites from firm_invites;

\echo '=== accept with a token issued to a DIFFERENT email (expect error 42501) ==='
select accept_firm_invite('tok_expired');

\echo '=== accept a bogus token (expect error 22023) ==='
select accept_firm_invite('tok_nonsense');

\echo '=== accept the valid invite (expect the firm id) ==='
select accept_firm_invite('tok_good') as joined_firm;

\echo '=== junior now sees CA Two''s clients (expect 1) ==='
select count(*) as clients_visible from clients;

\echo '=== the invite is now marked accepted, so it cannot be reused (expect error) ==='
select accept_firm_invite('tok_good');

\echo '=== junior is staff, not owner: cannot invite others (expect RLS violation) ==='
insert into firm_invites (firm_id, email, role, token, expires_at)
values ('22222222-2222-2222-2222-222222222222','someone@test','staff','tok_evil', now() + interval '7 days');

\echo '=== after joining, junior can read colleagues profiles but not outsiders ==='
select count(*) as colleague_profiles from profiles;

\echo '=== junior must NOT see CA One''s profile (different firm) ==='
select count(*) as leaked_profile from profiles where id = '11111111-1111-1111-1111-111111111111';

\echo '=== profile emails are populated (expect junior@test) ==='
select email from profiles where id = '55555555-5555-5555-5555-555555555555';

\echo '=== OWNER REMOVES A MEMBER (regression: 42P17 policy recursion) ==='
set app.current_user_id = '22222222-2222-2222-2222-222222222222';
delete from firm_members where firm_id = '22222222-2222-2222-2222-222222222222' and user_id = '55555555-5555-5555-5555-555555555555';

\echo '=== junior is gone (expect 1 member left: the owner) ==='
select count(*) as members_left from firm_members where firm_id = '22222222-2222-2222-2222-222222222222';

\echo '=== a staff member cannot remove the owner (expect 0 rows) ==='
set app.current_user_id = '11111111-1111-1111-1111-111111111111';
delete from firm_members where firm_id = '22222222-2222-2222-2222-222222222222';
