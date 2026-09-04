\set ON_ERROR_STOP off
set role authenticated;
set app.current_user_id = '11111111-1111-1111-1111-111111111111';

\echo '=== 1. CA One sees only their own firm data ==='
select 'clients' as t, count(*) from clients
union all select 'deadlines', count(*) from deadlines
union all select 'fees', count(*) from fees
union all select 'documents', count(*) from documents
union all select 'firms', count(*) from firms
union all select 'firm_members', count(*) from firm_members
order by 1;

\echo '=== 2. read CA Two''s client by exact id (expect 0) ==='
select count(*) as leaked from clients where id='bbbbbbbb-0000-0000-0000-000000000002';

\echo '=== 3. update CA Two''s client (expect UPDATE 0) ==='
update clients set name='HACKED' where id='bbbbbbbb-0000-0000-0000-000000000002';

\echo '=== 4. insert into CA Two''s firm (expect RLS violation) ==='
insert into clients (firm_id, name) values ('22222222-2222-2222-2222-222222222222','spoofed');

\echo '=== 5. THE BUG THAT WAS FOUND: join CA Two''s firm (expect RLS violation) ==='
insert into firm_members (firm_id, user_id, role) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','staff');

\echo '=== 6. same, but claiming owner (expect RLS violation) ==='
insert into firm_members (firm_id, user_id, role) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','owner');

\echo '=== 7. storage: CA One sees only their own prefix (expect 1) ==='
select count(*) as visible from storage.objects;

\echo '=== 8. legitimate: create my own firm, claim it as owner (expect success) ==='
insert into firms (id, name, created_by) values ('33333333-3333-3333-3333-333333333333','My New Firm','11111111-1111-1111-1111-111111111111');
insert into firm_members (firm_id, user_id, role) values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','owner');

\echo '=== 9. cannot claim owner on a firm someone ELSE created (expect RLS violation) ==='
reset role;
insert into firms (id, name, created_by) values ('44444444-4444-4444-4444-444444444444','Someone Elses Firm','22222222-2222-2222-2222-222222222222');
set role authenticated;
insert into firm_members (firm_id, user_id, role) values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','owner');
