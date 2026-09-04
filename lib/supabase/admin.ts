import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * ⚠️  SERVICE-ROLE CLIENT — BYPASSES ROW LEVEL SECURITY.
 *
 * There are exactly THREE legitimate callers in this codebase:
 *   app/api/upload/[token]/route.ts  — receiving an anonymous client upload
 *   lib/documents/public.ts          — rendering the anonymous upload page
 *   app/api/cron/reminders/route.ts  — the scheduled reminder run
 *
 * The first two serve the anonymous client-upload flow. The third is a cron
 * job with no user at all, which therefore cannot satisfy auth.uid() either;
 * it is guarded by CRON_SECRET instead.
 *
 * Why the exception exists: the whole value of the document collection feature
 * is that the CA's client uploads without creating an account. An anonymous
 * browser has no auth.uid(), so it can never satisfy the `user_id = auth.uid()`
 * policy that guards every other table. Authorisation there is carried by an
 * unguessable 32-byte token, checked server-side, with expiry and rate limits.
 *
 * Do NOT reach for this to "make a query work". If RLS is blocking you
 * somewhere else, the policy or the query is wrong — fix that instead.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
