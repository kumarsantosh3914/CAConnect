import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ClientListRow } from '@/components/clients/clients-table'

/**
 * Client list with service tags flattened onto each row.
 *
 * RLS scopes this to the signed-in CA — there is no user_id filter here on
 * purpose. Adding one would hide a broken policy rather than expose it.
 */
export async function listClients({
  search,
  service,
  includeArchived = false,
  assignedTo,
}: {
  search?: string
  service?: string
  includeArchived?: boolean
  /** A user id, or 'unassigned'. */
  assignedTo?: string
} = {}): Promise<ClientListRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('id,name,client_type,pan,gstin,email,phone,notes,agm_date,is_audit_case,assigned_to,client_services(service_type)')
    .order('name')

  if (!includeArchived) query = query.is('archived_at', null)
  if (assignedTo === 'unassigned') query = query.is('assigned_to', null)
  else if (assignedTo) query = query.eq('assigned_to', assignedTo)

  if (search) {
    // Match name, PAN or GSTIN — a CA searching "ABCDE1234F" expects a hit.
    const escaped = search.replace(/[%,()]/g, '')
    query = query.or(`name.ilike.%${escaped}%,pan.ilike.%${escaped}%,gstin.ilike.%${escaped}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Could not load clients: ${error.message}`)

  const rows = (data ?? []).map(({ client_services, ...rest }) => ({
    ...rest,
    services: client_services.map((s) => s.service_type as string),
  }))

  // Filtering on the joined table server-side would drop the other tags from
  // the result, so narrow here instead. Client counts are small (20–200).
  return service ? rows.filter((row) => row.services.includes(service)) : rows
}

export async function getClient(clientId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*,client_services(service_type)')
    .eq('id', clientId)
    .maybeSingle()

  if (error) throw new Error(`Could not load client: ${error.message}`)
  if (!data) return null

  const { client_services, ...rest } = data
  return { ...rest, services: client_services.map((s) => s.service_type as string) }
}
