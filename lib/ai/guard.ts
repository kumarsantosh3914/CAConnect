import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aiLimitMessage, planLimits } from '@/lib/plans'
import { countAiDraftsThisMonth } from './usage'

/**
 * The two checks every AI draft route needs, factored out once both the
 * notice drafter and the client email drafter needed them: a per-CA rate
 * limit (shared across features — a CA's total draft rate is one budget,
 * not one per feature) and the monthly plan cap.
 */

// A draft is a paid API call, so cap how fast one CA can spend.
const RATE = { perWindow: 12, windowMs: 60_000 }
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = attempts.get(userId)
  if (!entry || entry.resetAt < now) {
    attempts.set(userId, { count: 1, resetAt: now + RATE.windowMs })
    return false
  }
  entry.count += 1
  return entry.count > RATE.perWindow
}

export type AiGuardResult =
  | { ok: true; firmName: string | null }
  | { ok: false; status: number; error: string }

export async function checkAiGuards(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AiGuardResult> {
  if (isRateLimited(userId)) {
    return {
      ok: false,
      status: 429,
      error: 'You have generated a lot of drafts in the last minute. Please pause briefly.',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_name,plan')
    .eq('id', userId)
    .maybeSingle()

  const plan = profile?.plan ?? 'starter'
  const limit = planLimits(plan).aiDraftsPerMonth
  if (Number.isFinite(limit)) {
    const count = await countAiDraftsThisMonth(supabase)
    if (count >= limit) {
      return { ok: false, status: 402, error: aiLimitMessage(plan) }
    }
  }

  return { ok: true, firmName: profile?.firm_name ?? null }
}
