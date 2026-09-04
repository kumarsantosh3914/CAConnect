#!/usr/bin/env bash
# Replay all migrations against a disposable Postgres and run the RLS tests.
set -uo pipefail
cd "$(dirname "$0")/../.."

C=caconnect-migtest
HERE=scripts/migration-dryrun

docker info >/dev/null 2>&1 || { echo "Docker is not running."; exit 1; }

docker rm -f "$C" >/dev/null 2>&1
docker run -d --name "$C" -e POSTGRES_PASSWORD=test postgres:16 >/dev/null
until docker exec "$C" pg_isready -U postgres >/dev/null 2>&1; do sleep 2; done

run() { docker cp "$1" "$C:/tmp/x.sql" >/dev/null && docker exec "$C" psql -U postgres -q -v ON_ERROR_STOP=1 -f /tmp/x.sql; }
show() { docker cp "$1" "$C:/tmp/x.sql" >/dev/null && docker exec "$C" psql -U postgres -f /tmp/x.sql 2>&1 | grep -vE '^SET$|^RESET$|^$'; }

run "$HERE/00_supabase_stub.sql" >/dev/null || { echo "stub failed"; exit 1; }

for f in supabase/migrations/*.sql; do
  name=$(basename "$f")
  # Seed pre-migration data just before the migration that transforms it.
  [ "$name" = "0005_firms_and_staff.sql" ] && run "$HERE/01_seed.sql" >/dev/null
  if run "$f" >/dev/null 2>&1; then echo "  ok   $name"; else
    echo "  FAIL $name"; docker cp "$f" "$C:/tmp/x.sql" >/dev/null
    docker exec "$C" psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/x.sql 2>&1 | grep -i error | head -5
    exit 1
  fi
done

# Supabase grants these to the authenticated role; without them RLS is never reached.
docker exec "$C" psql -U postgres -q -c "
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;" >/dev/null

echo; echo "════ RLS ════"; show "$HERE/02_rls.sql"
echo; echo "════ INVITES ════"; show "$HERE/03_invites.sql"
echo; echo "════ PORTAL ════"; show "$HERE/04_portal.sql"
echo; echo "════ MESSAGE LOG ════"; show "$HERE/05_message_log.sql"

docker rm -f "$C" >/dev/null 2>&1
