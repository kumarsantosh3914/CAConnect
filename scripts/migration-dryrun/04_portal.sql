-- Client portal (0009). The portal token is a credential, so the questions
-- worth asking are: can a firm mint one onto someone else's client, and can a
-- non-member read or revoke one.
\set ON_ERROR_STOP off
set role authenticated;
set app.current_user_id = '11111111-1111-1111-1111-111111111111';

\echo '=== 1. CA One creates a portal for their OWN client (expect INSERT 1) ==='
insert into client_portals (firm_id, client_id, token, created_by)
values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','11111111-1111-1111-1111-111111111111');

\echo '=== 2. THE HOLE RLS MUST CLOSE: own firm_id, CA Two''s client (expect RLS violation) ==='
insert into client_portals (firm_id, client_id, token)
values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000002',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

\echo '=== 3. plainly spoofing CA Two''s firm_id (expect RLS violation) ==='
insert into client_portals (firm_id, client_id, token)
values ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002',
        'ccccccccccccccccccccccccccccccccccccccccccc');

\echo '=== 4. one portal per client — a second insert must fail (expect unique violation) ==='
insert into client_portals (firm_id, client_id, token)
values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
        'ddddddddddddddddddddddddddddddddddddddddddd');

\echo '=== 5. CA Two cannot see CA One''s portal or its token (expect 0) ==='
set app.current_user_id = '22222222-2222-2222-2222-222222222222';
select count(*) as leaked from client_portals;

\echo '=== 6. CA Two cannot revoke CA One''s portal (expect UPDATE 0) ==='
update client_portals set is_active = false
 where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '=== 7. CA Two cannot delete it either (expect DELETE 0) ==='
delete from client_portals where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '=== 8. CA One can revoke their own (expect UPDATE 1) ==='
set app.current_user_id = '11111111-1111-1111-1111-111111111111';
update client_portals set is_active = false
 where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '=== 9. regenerating swaps the token in place, killing the old one (expect UPDATE 1, new token) ==='
update client_portals
   set token = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', is_active = true
 where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select token, is_active from client_portals where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '=== 10. touch_client_portal increments atomically (expect view_count 2) ==='
reset role;
select touch_client_portal(id) from client_portals where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select touch_client_portal(id) from client_portals where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select view_count, last_viewed_at is not null as viewed
  from client_portals where client_id = 'aaaaaaaa-0000-0000-0000-000000000001';
