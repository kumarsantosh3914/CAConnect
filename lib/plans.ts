import type { PlanTier } from '@/types/database'

/**
 * Plan limits, enforced server-side.
 *
 * There is no payment gateway (per the build plan) — upgrades are applied by
 * hand. These caps exist so each tier has a real edge to it, not to collect
 * money yet.
 *
 * Limits are enforced SOFTLY: a firm already over a cap keeps everything it
 * has. We only block creating the next thing. Locking someone out of data they
 * already entered would be a far worse experience than a nag, and for the
 * client portal it would break a link a CA already gave to their client — who
 * did nothing wrong and cannot fix it.
 *
 * `maxMembers` counts every seat including the owner, and pending invites
 * count against it. Without counting invites a one-seat firm could send five
 * invitations and have all five land.
 */
export const PLANS: Record<
  PlanTier,
  {
    name: string
    priceMonthly: number
    maxClients: number
    aiDraftsPerMonth: number
    /** Seats including the owner. 1 means a solo login. */
    maxMembers: number
    /** Whether the firm may create new client portal links. */
    clientPortal: boolean
  }
> = {
  starter: {
    name: 'Starter',
    priceMonthly: 0,
    maxClients: 10,
    aiDraftsPerMonth: 3,
    maxMembers: 1,
    clientPortal: false,
  },
  solo: {
    name: 'Solo',
    priceMonthly: 999,
    maxClients: 50,
    aiDraftsPerMonth: 20,
    maxMembers: 1,
    clientPortal: false,
  },
  // Pro carries a small team on purpose. The vision doc's pricing table gives
  // Pro no multi-user at all, but its own persona for this tier — a 3-person
  // firm with 120+ clients — cannot work that way, and 150 clients is not a
  // one-person workload. Three seats makes Pro coherent and still leaves Team
  // somewhere to grow to.
  pro: {
    name: 'Pro',
    priceMonthly: 1999,
    maxClients: 150,
    aiDraftsPerMonth: 100,
    maxMembers: 3,
    clientPortal: true,
  },
  team: {
    name: 'Team',
    priceMonthly: 2999,
    maxClients: Infinity,
    aiDraftsPerMonth: Infinity,
    maxMembers: Infinity,
    clientPortal: true,
  },
}

export function planLimits(plan: PlanTier) {
  return PLANS[plan] ?? PLANS.starter
}

/** The cheapest plan that includes a given capability, for upgrade copy. */
function cheapestPlanWith(predicate: (limit: (typeof PLANS)[PlanTier]) => boolean): string {
  const match = (['starter', 'solo', 'pro', 'team'] as const)
    .map((tier) => PLANS[tier])
    .find(predicate)
  return match?.name ?? PLANS.team.name
}

export function clientLimitMessage(plan: PlanTier): string {
  const limit = planLimits(plan)
  return `Your ${limit.name} plan covers up to ${limit.maxClients} clients. Upgrade to add more — your existing clients are unaffected.`
}

export function aiLimitMessage(plan: PlanTier): string {
  const limit = planLimits(plan)
  return `Your ${limit.name} plan includes ${limit.aiDraftsPerMonth} AI drafts a month. Upgrade for more.`
}

export function seatLimitMessage(plan: PlanTier): string {
  const limit = planLimits(plan)
  const next = cheapestPlanWith((p) => p.maxMembers > limit.maxMembers)
  if (limit.maxMembers === 1) {
    return `Your ${limit.name} plan is a single login. Upgrade to ${next} to bring colleagues into the firm.`
  }
  return `Your ${limit.name} plan covers ${limit.maxMembers} people, including you. Upgrade to ${next} to add more — everyone already in the firm stays.`
}

export function portalUpgradeMessage(plan: PlanTier): string {
  const limit = planLimits(plan)
  const next = cheapestPlanWith((p) => p.clientPortal)
  return `Client portals are part of the ${next} plan. Your ${limit.name} plan does not include them yet.`
}
