import { describe, expect, it } from 'vitest'
import {
  PLANS,
  planLimits,
  portalUpgradeMessage,
  seatLimitMessage,
} from './plans'
import type { PlanTier } from '@/types/database'

const TIERS: PlanTier[] = ['starter', 'solo', 'pro', 'team']

/**
 * These caps are what separates the free tier from ₹2,999 a month, so a
 * regression here is a revenue bug that nothing else in the app would catch.
 */
describe('plan limits', () => {
  it('never gets cheaper as you go up a tier', () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      const lower = PLANS[TIERS[i - 1]]
      const higher = PLANS[TIERS[i]]
      expect(higher.priceMonthly).toBeGreaterThan(lower.priceMonthly)
      expect(higher.maxClients).toBeGreaterThanOrEqual(lower.maxClients)
      expect(higher.aiDraftsPerMonth).toBeGreaterThanOrEqual(lower.aiDraftsPerMonth)
      expect(higher.maxMembers).toBeGreaterThanOrEqual(lower.maxMembers)
      // Entitlements are monotonic: once a tier grants something, no tier
      // above it may take that away.
      expect(Number(higher.clientPortal)).toBeGreaterThanOrEqual(Number(lower.clientPortal))
    }
  })

  it('keeps the paid team features off the free tier', () => {
    expect(PLANS.starter.clientPortal).toBe(false)
    expect(PLANS.starter.maxMembers).toBe(1)
  })

  it('gives Pro a real team, because 150 clients is not a one-person workload', () => {
    expect(PLANS.pro.maxMembers).toBe(3)
    expect(PLANS.pro.clientPortal).toBe(true)
  })

  it('leaves Team unbounded, so the top tier never blocks anyone', () => {
    expect(PLANS.team.maxClients).toBe(Infinity)
    expect(PLANS.team.maxMembers).toBe(Infinity)
    expect(PLANS.team.aiDraftsPerMonth).toBe(Infinity)
    expect(PLANS.team.clientPortal).toBe(true)
  })

  it('falls back to the most restrictive plan for an unknown tier', () => {
    expect(planLimits('nonsense' as PlanTier)).toBe(PLANS.starter)
  })
})

describe('upgrade messages', () => {
  it('names a plan that actually lifts the seat cap', () => {
    // Starter and Solo are single-login, so both must point at Pro — naming a
    // plan that does not solve the problem is worse than saying nothing.
    expect(seatLimitMessage('starter')).toContain('Pro')
    expect(seatLimitMessage('solo')).toContain('Pro')
    expect(seatLimitMessage('pro')).toContain('Team')
  })

  it('tells a single-login plan it is a single login, not a number', () => {
    expect(seatLimitMessage('starter')).toContain('single login')
    expect(seatLimitMessage('pro')).toContain('3 people')
  })

  it('reassures that nobody already in the firm is removed', () => {
    expect(seatLimitMessage('pro')).toContain('stays')
  })

  it('points portal upgrades at the cheapest plan that includes them', () => {
    expect(portalUpgradeMessage('starter')).toContain('Pro')
    expect(portalUpgradeMessage('solo')).toContain('Pro')
  })

  it('names the plan the firm is actually on', () => {
    expect(seatLimitMessage('starter')).toContain('Starter')
    expect(portalUpgradeMessage('solo')).toContain('Solo')
  })
})
