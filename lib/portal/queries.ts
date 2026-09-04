import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ClientPortalRow } from '@/types/database'

export type ClientPortalSummary = {
  token: string
  is_active: boolean
  last_viewed_at: string | null
  view_count: number
  created_at: string
}

/**
 * The portal row for one client, or null if the CA has never created one.
 *
 * RLS scopes this to the caller's firm, so a client id from another firm
 * returns null rather than someone else's token.
 */
export async function getClientPortal(clientId: string): Promise<ClientPortalSummary | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('client_portals')
    .select('token,is_active,last_viewed_at,view_count,created_at')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error || !data) return null
  return data satisfies Pick<
    ClientPortalRow,
    'token' | 'is_active' | 'last_viewed_at' | 'view_count' | 'created_at'
  >
}
