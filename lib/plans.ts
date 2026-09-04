import type { PlanTier } from '@/types/database'

/**
 * Plan limits, enforced server-side.
 *
 * There is no payment gateway in V1 (per the build plan) — upgrades are
 * applied by hand. These caps exist so the free tier has a real edge to it,
 * not to collect money yet.
 *
 * Limits are enforced softly: a CA who is already over a cap keeps every
 * client they have. We only block creating the next one. Locking someone out
 * of data they already entered would be a far worse experience than a nag.
 */
export const PLANS: Record<
  PlanTier,
  { name: string; priceMonthly: number; maxClients: number; aiDraftsPerMonth: number }
> = {
  starter: { name: 'Starter', priceMonthly: 0, maxClients: 10, aiDraftsPerMonth: 3 },
  solo: { name: 'Solo', priceMonthly: 999, maxClients: 50, aiDraftsPerMonth: 20 },
  pro: { name: 'Pro', priceMonthly: 1999, maxClients: 150, aiDraftsPerMonth: 100 },
  team: { name: 'Team', priceMonthly: 2999, maxClients: Infinity, aiDraftsPerMonth: Infinity },
}

export function planLimits(plan: PlanTier) {
  return PLANS[plan] ?? PLANS.starter
}

export function clientLimitMessage(plan: PlanTier): string {
  const limit = planLimits(plan)
  return `Your ${limit.name} plan covers up to ${limit.maxClients} clients. Upgrade to add more — your existing clients are unaffected.`
}

export function aiLimitMessage(plan: PlanTier): string {
  const limit = planLimits(plan)
  return `Your ${limit.name} plan includes ${limit.aiDraftsPerMonth} AI drafts a month. Upgrade for more.`
}
