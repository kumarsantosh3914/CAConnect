import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { FirmRole, PlanTier } from '@/types/database'

/**
 * The authentication gate for Server Components and Server Actions.
 * Redirects to /login when there is no session.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  return user
}

/**
 * The same check for Route Handlers, which must return a response rather than
 * redirect. Every API route starts with this — per CLAUDE.md, no DB query
 * happens before the user is verified.
 */
export async function getApiUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getOptionalUser(): Promise<User | null> {
  return getApiUser()
}

/**
 * Which firm the signed-in person is acting as, and with what role.
 *
 * This is the tenancy boundary for everything the app writes: domain rows
 * carry firm_id, never the person's own id. `created_by` records the person
 * separately.
 *
 * A user can in principle belong to several firms. Until there is a firm
 * switcher in the UI, the owner membership wins (the firm_role enum declares
 * 'owner' before 'staff', so ordering by role puts it first) and a staff
 * membership is used otherwise.
 */
export type FirmContext = {
  firmId: string
  role: FirmRole
  name: string | null
  city: string | null
  plan: PlanTier
}

/** Null when the user has signed up but not yet created or joined a firm. */
export async function getFirmContext(): Promise<FirmContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('firm_members')
    .select('firm_id,role,firms(name,city,plan)')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!data?.firms) return null

  return {
    firmId: data.firm_id,
    role: data.role,
    name: data.firms.name,
    city: data.firms.city,
    plan: data.firms.plan,
  }
}

/**
 * Firm context or bust. Sends a user with no firm to onboarding, which is
 * where a firm gets created.
 */
export async function requireFirm(): Promise<{ user: User; firm: FirmContext }> {
  const user = await requireUser()
  const firm = await getFirmContext()
  if (!firm) redirect('/onboarding')
  return { user, firm }
}

/** Firm context for Route Handlers, which return a response rather than redirect. */
export async function getApiFirm(): Promise<{ user: User; firm: FirmContext } | null> {
  const user = await getApiUser()
  if (!user) return null
  const firm = await getFirmContext()
  if (!firm) return null
  return { user, firm }
}
