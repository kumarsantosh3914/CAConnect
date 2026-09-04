-- Two existing CAs with data, mirroring production shape before the migration.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ca.one@test'),
  ('22222222-2222-2222-2222-222222222222', 'ca.two@test');

-- profiles rows already exist: the handle_new_user trigger fired on the inserts above.
update profiles set firm_name='One & Co', full_name='CA One', city='Nagpur', plan='solo'
  where id='11111111-1111-1111-1111-111111111111';
update profiles set firm_name='Two & Co', full_name='CA Two', city='Surat', plan='starter'
  where id='22222222-2222-2222-2222-222222222222';

insert into clients (id, user_id, name, pan) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Client of One', 'ABCDE1234F'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Client of Two', 'ZYXWV9876K');

insert into client_services (user_id, client_id, service_type) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'itr');

insert into deadlines (user_id, client_id, service_type, label, period_label, due_date) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'itr', 'ITR filing', 'AY2026-27', '2026-07-31');

insert into document_requests (id, user_id, client_id, token, title, expires_at) values
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'tok_one', 'ITR docs', now() + interval '30 days');

insert into document_request_items (user_id, request_id, label) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000003', 'Form 16');

insert into documents (user_id, client_id, request_id, storage_path, file_name, mime_type, size_bytes) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/file.pdf', 'file.pdf', 'application/pdf', 100);

insert into fees (user_id, client_id, description, amount_paise) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'ITR filing', 250000);

insert into notices (user_id, client_id, title, notice_text) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '143(2)', 'notice body text');

insert into client_emails (user_id, client_id, topic) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'custom');

insert into email_log (user_id, kind, subject_id, recipient) values
  ('11111111-1111-1111-1111-111111111111', 'deadline', 'dddddddd-0000-0000-0000-000000000004', 'x@test');

-- A storage object under CA One's path prefix, as the upload route would write it.
insert into storage.objects (bucket_id, name) values
  ('client-documents', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/file.pdf');
