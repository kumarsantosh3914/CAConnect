# Migration dry run

Replays every migration in `supabase/migrations/` against a throwaway Postgres
in Docker, then runs the RLS and invite tests against the result.

Worth doing for any migration that rewrites RLS policies or moves data. The
first run of this harness caught a privilege-escalation bug in the firm/staff
membership policy — any authenticated user could insert themselves into any
firm they knew the id of and read all of its clients, deadlines, documents
and fees. That was invisible to a code review and to the type checker.

```bash
./scripts/migration-dryrun/run.sh
```

Needs Docker running. `00_supabase_stub.sql` provides minimal stand-ins for
the Supabase-managed objects the migrations reference (`auth.users`,
`auth.uid()`, `storage.objects`, `storage.foldername()`), plus the table
GRANTs Supabase applies to the `authenticated` role — without those, every
query fails on permissions before RLS is ever reached, which looks like a
pass but tests nothing.

`auth.uid()` in the stub reads `app.current_user_id`, so a test impersonates
a signed-in user with `set app.current_user_id = '<uuid>'`.
