import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Monthly AI draft count, shared across every AI feature.
 *
 * lib/plans.ts caps "AI drafts a month" generically, not "notice drafts" —
 * so a notice draft and a client email draft spend from the same pool.
 * Counting them separately would let a CA on Starter get double the real
 * quota by splitting usage across features. Add a query here for each new
 * AI feature's table.
 */
export async function countAiDraftsThisMonth(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const since = monthStart.toISOString()

  const [{ count: notices }, { count: emails }] = await Promise.all([
    supabase
      .from('notices')
      .select('id', { count: 'exact', head: true })
      .not('draft_response', 'is', null)
      .gte('created_at', since),
    supabase
      .from('client_emails')
      .select('id', { count: 'exact', head: true })
      .not('draft_body', 'is', null)
      .gte('created_at', since),
  ])

  return (notices ?? 0) + (emails ?? 0)
}
