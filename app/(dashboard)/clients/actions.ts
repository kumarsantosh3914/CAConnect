'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { clientSchema, normalizeClient } from '@/lib/validations/client'
import { syncClientDeadlines } from '@/lib/deadlines/sync'
import { clientLimitMessage, planLimits } from '@/lib/plans'
import type { ClientInput } from '@/lib/validations/client'

export type ActionResult =
  | { ok: true; clientId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

/**
 * Postgres error codes we can explain better than Postgres can.
 * CLAUDE.md: users see human-readable messages, never raw technical errors.
 */
function friendlyDbError(code: string | undefined, message: string): string {
  if (code === '23505') {
    if (message.includes('clients_user_pan_idx')) {
      return 'You already have a client with this PAN.'
    }
    return 'That record already exists.'
  }
  if (code === '23514') {
    return 'One of the values does not look right. Check the PAN and GSTIN.'
  }
  if (code === '42501') {
    return 'You do not have permission to change this record.'
  }
  return 'Could not save the client. Please try again.'
}

export async function saveClient(
  input: ClientInput,
  clientId?: string
): Promise<ActionResult> {
  // Auth before any DB work, per CLAUDE.md.
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const { services } = parsed.data
  const supabase = await createClient()

  // Plan cap applies only to NEW clients. A CA already over their limit keeps
  // everyone they have and can still edit them — locking someone out of data
  // they already entered would be worse than a nag.
  if (!clientId) {
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
    if ((count ?? 0) >= planLimits(firm.plan).maxClients) {
      return { ok: false, error: clientLimitMessage(firm.plan) }
    }
  }

  const row = { firm_id: firm.firmId, created_by: user.id, ...normalizeClient(parsed.data) }

  let savedId: string

  if (clientId) {
    const { data, error } = await supabase
      .from('clients')
      .update(row)
      .eq('id', clientId)
      .select('id')
      .single()
    if (error) return { ok: false, error: friendlyDbError(error.code, error.message) }
    savedId = data.id
  } else {
    const { data, error } = await supabase.from('clients').insert(row).select('id').single()
    if (error) return { ok: false, error: friendlyDbError(error.code, error.message) }
    savedId = data.id
  }

  // Service tags: replace the set wholesale — simpler to reason about than
  // diffing, and the row count per client is tiny.
  const { error: deleteError } = await supabase
    .from('client_services')
    .delete()
    .eq('client_id', savedId)
  if (deleteError) return { ok: false, error: friendlyDbError(deleteError.code, deleteError.message) }

  if (services.length > 0) {
    const { error: insertError } = await supabase.from('client_services').insert(
      services.map((service_type) => ({
        firm_id: firm.firmId,
        created_by: user.id,
        client_id: savedId,
        service_type,
      }))
    )
    if (insertError) {
      return { ok: false, error: friendlyDbError(insertError.code, insertError.message) }
    }
  }

  // Service tags drive the compliance calendar, so refresh it here rather
  // than making the CA remember a separate "generate deadlines" step.
  // A failure here must not lose the client they just typed in.
  try {
    await syncClientDeadlines(savedId, firm.firmId, user.id)
  } catch (error) {
    console.error('Deadline sync failed for client', savedId, error)
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${savedId}`)
  revalidatePath('/deadlines')
  revalidatePath('/dashboard')

  return { ok: true, clientId: savedId }
}

/**
 * Archive rather than delete. A CA's filing history is the reason they cannot
 * leave the product — destroying it on a misclick would be unforgivable.
 */
export async function archiveClient(clientId: string): Promise<ActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) return { ok: false, error: friendlyDbError(error.code, error.message) }

  // An archived client should stop accruing future deadlines.
  try {
    await syncClientDeadlines(clientId, firm.firmId, user.id)
  } catch (syncError) {
    console.error('Deadline sync failed for client', clientId, syncError)
  }

  revalidatePath('/clients')
  revalidatePath('/deadlines')
  revalidatePath('/dashboard')
  return { ok: true, clientId }
}

export async function restoreClient(clientId: string): Promise<ActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .update({ archived_at: null })
    .eq('id', clientId)

  if (error) return { ok: false, error: friendlyDbError(error.code, error.message) }

  try {
    await syncClientDeadlines(clientId, firm.firmId, user.id)
  } catch (syncError) {
    console.error('Deadline sync failed for client', clientId, syncError)
  }

  revalidatePath('/clients')
  revalidatePath('/deadlines')
  return { ok: true, clientId }
}
