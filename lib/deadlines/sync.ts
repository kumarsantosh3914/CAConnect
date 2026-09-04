import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { generateForClient, type DeadlineClient } from './generate'
import type { ServiceType } from '@/types/database'

/**
 * Brings a client's compliance deadlines in step with their service tags.
 *
 * Safe to call repeatedly — on client creation, on a service-tag change, or
 * from a scheduled refresh. Two guarantees make that true:
 *
 *   1. New occurrences are inserted with ignoreDuplicates, so a deadline the
 *      CA has already marked Filed is never reset to Pending. Wiping that
 *      status would be worse than missing a row.
 *   2. Untagging a service removes only its FUTURE, still-Pending rows.
 *      Anything filed, in progress, or overdue stays — it is history, and a
 *      CA who mis-clicks a checkbox should not lose their record of it.
 */
export async function syncClientDeadlines(clientId: string, firmId: string, userId: string) {
  const supabase = await createClient()

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id,is_audit_case,agm_date,archived_at,client_services(service_type,is_active)')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError) throw new Error(`Could not load client: ${clientError.message}`)
  if (!client) return { inserted: 0, removed: 0 }

  const services = (client.client_services as { service_type: ServiceType; is_active: boolean }[])
    .filter((s) => s.is_active)
    .map((s) => s.service_type)

  const { data: templates, error: templateError } = await supabase
    .from('deadline_templates')
    .select('*')
  if (templateError) throw new Error(`Could not load templates: ${templateError.message}`)

  // An archived client should stop accruing new deadlines.
  const target: DeadlineClient = {
    id: client.id,
    is_audit_case: client.is_audit_case,
    agm_date: client.agm_date,
    services: client.archived_at ? [] : services,
  }

  const generated = generateForClient(templates ?? [], target)

  let inserted = 0
  if (generated.length > 0) {
    const { data, error } = await supabase
      .from('deadlines')
      .upsert(
        generated.map((d) => ({
          firm_id: firmId,
          created_by: userId,
          client_id: clientId,
          template_id: d.template_id,
          service_type: d.service_type,
          label: d.label,
          period_label: d.period_label,
          due_date: d.due_date,
        })),
        { onConflict: 'client_id,template_id,period_label', ignoreDuplicates: true }
      )
      .select('id')
    if (error) throw new Error(`Could not create deadlines: ${error.message}`)
    inserted = data?.length ?? 0
  }

  // Withdraw future pending rows for services no longer tagged.
  const today = new Date().toISOString().slice(0, 10)
  let removeQuery = supabase
    .from('deadlines')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .gte('due_date', today)
    .not('template_id', 'is', null)

  if (target.services.length > 0) {
    removeQuery = removeQuery.not(
      'service_type',
      'in',
      `(${target.services.join(',')})`
    )
  }

  const { data: removedRows, error: removeError } = await removeQuery.select('id')
  if (removeError) throw new Error(`Could not tidy deadlines: ${removeError.message}`)

  return { inserted, removed: removedRows?.length ?? 0 }
}
