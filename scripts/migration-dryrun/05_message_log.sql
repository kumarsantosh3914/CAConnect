-- message_log (0010). The rename carries live data, and the dedupe key gained
-- a channel column — both are things that fail silently if they fail at all.
\set ON_ERROR_STOP off
set role authenticated;
set app.current_user_id = '11111111-1111-1111-1111-111111111111';

\echo '=== 1. the row seeded as email_log survived the rename (expect 1) ==='
select count(*) as rows_kept from message_log;

\echo '=== 2. it defaulted to the email channel (expect email) ==='
select distinct channel from message_log;

\echo '=== 3. THE FIX: same deadline, same variant, different channel (expect INSERT 1) ==='
reset role;
insert into message_log (firm_id, channel, kind, subject_id, variant, recipient)
select firm_id, 'whatsapp', kind, subject_id, variant, '+919876543210'
  from message_log limit 1;

\echo '=== 4. but the same channel still dedupes (expect unique violation) ==='
insert into message_log (firm_id, channel, kind, subject_id, variant, recipient)
select firm_id, 'whatsapp', kind, subject_id, variant, '+919876543210'
  from message_log where channel = 'whatsapp' limit 1;

\echo '=== 5. both channels now recorded for the same subject (expect 2) ==='
select count(*) as channels from message_log
 where subject_id = (select subject_id from message_log where channel='whatsapp' limit 1);

\echo '=== 6. CA Two cannot read CA One''s message log (expect 0) ==='
set role authenticated;
set app.current_user_id = '22222222-2222-2222-2222-222222222222';
select count(*) as leaked from message_log;

\echo '=== 7. nobody writes it from a session — no insert policy (expect RLS violation) ==='
insert into message_log (firm_id, channel, kind, subject_id, variant, recipient)
values ('22222222-2222-2222-2222-222222222222','whatsapp','deadline',
        '00000000-0000-0000-0000-0000000000ff','t-1','+919999999999');
