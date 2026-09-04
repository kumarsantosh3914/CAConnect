'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { generateShareToken } from '@/lib/tokens'
import { requestOrigin } from '@/lib/url'
import { planLimits, portalUpgradeMessage } from '@/lib/plans'

export type PortalActionResult = { ok: true; url: string } | { ok: false; error: string }

const clientIdSchema = z.string().uuid()

/**
 * Confirms the client is one of the caller's own before any portal row is
 * written for it.
 *
 * The database enforces this too — `client_portals_all_firm` requires
 * `client_id in (select id from clients)`, which RLS narrows to the caller's
 * own firm. This check exists so the CA sees "that client could not be found"
 * instead of a raw policy violation, and so the rule is visible at the call
 * site. If you remove one of the two, remove this one, never the policy.
 */
async function assertOwnClient(clientId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('clients').select('id').eq('id', clientId).maybeSingle()
  return data?.id ?? null
}

async function portalUrl(token: string): Promise<string> {
  return `${await requestOrigin()}/portal/${token}`
}

/**
 * Creates the client's portal link, or issues a fresh one.
 *
 * Re-enabling a revoked portal deliberately mints a NEW token rather than
 * bringing the old one back. The CA revoked that link for a reason, and
 * whoever holds it must not get access again because the portal was later
 * switched back on.
 */
export async function createClientPortal(clientId: string): Promise<PortalActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  if (!clientIdSchema.safeParse(clientId).success) {
    return { ok: false, error: 'That client could not be found.' }
  }
  if (!(await assertOwnClient(clientId))) {
    return { ok: false, error: 'That client could not be found.' }
  }

  // Plan entitlement. Note what this does NOT do: it never disables a portal
  // that already exists. A firm that drops to a plan without portals keeps
  // serving the links it already handed out, because the person those links
  // would break is the CA's client, who did nothing and cannot fix it. Only
  // minting a new one is blocked — and "New link" routes through here too, so
  // a downgraded firm cannot rotate a token either.
  if (!planLimits(firm.plan).clientPortal) {
    return { ok: false, error: portalUpgradeMessage(firm.plan) }
  }

  const supabase = await createClient()
  const token = generateShareToken()

  // One portal per client (unique on client_id), so this is an upsert on that
  // conflict rather than an insert that would fail the second time.
  const { error } = await supabase
    .from('client_portals')
    .upsert(
      {
        firm_id: firm.firmId,
        created_by: user.id,
        client_id: clientId,
        token,
        is_active: true,
      },
      { onConflict: 'client_id' }
    )

  if (error) return { ok: false, error: 'Could not create that link. Please try again.' }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true, url: await portalUrl(token) }
}

/** Replaces the token, which kills the link already in the client's hands. */
export async function regenerateClientPortal(clientId: string): Promise<PortalActionResult> {
  return createClientPortal(clientId)
}

/**
 * Turns the link off without deleting the row, so the CA keeps the history of
 * whether it was ever opened. A revoked portal answers exactly like a token
 * that never existed.
 */
export async function revokeClientPortal(
  clientId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  if (!clientIdSchema.safeParse(clientId).success) {
    return { ok: false, error: 'That client could not be found.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_portals')
    .update({ is_active: false })
    .eq('client_id', clientId)

  if (error) return { ok: false, error: 'Could not turn that link off. Please try again.' }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}
