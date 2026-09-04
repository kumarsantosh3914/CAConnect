import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidTokenFormat } from './tokens'

export type PublicUploadRequest = {
  id: string
  firm_id: string
  client_id: string
  title: string
  message: string | null
  status: string
  expires_at: string
  firm_name: string | null
  client_name: string
  items: {
    id: string
    label: string
    is_required: boolean
    fulfilled: boolean
  }[]
}

export type UploadRequestLookup =
  | { ok: true; request: PublicUploadRequest }
  | { ok: false; reason: 'not_found' | 'expired' | 'completed' }

/**
 * Resolves an upload token for the anonymous client-facing page.
 *
 * This is one of only two places that use the service-role client. An
 * anonymous browser has no auth.uid(), so it can never satisfy the
 * `user_id = auth.uid()` policy guarding every table — authorisation here is
 * the token itself. Everything returned is deliberately narrow: the client
 * sees their own checklist and the firm's name, nothing else about the CA's
 * practice.
 */
export async function lookupUploadRequest(token: string): Promise<UploadRequestLookup> {
  if (!isValidTokenFormat(token)) return { ok: false, reason: 'not_found' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('document_requests')
    // Must be a single string literal — supabase-js infers result types by
    // parsing it, and a concatenated expression defeats that.
    .select(
      'id,firm_id,client_id,title,message,status,expires_at,clients(name),document_request_items(id,label,is_required,sort_order,fulfilled_document_id)'
    )
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return { ok: false, reason: 'not_found' }
  if (new Date(data.expires_at) < new Date()) return { ok: false, reason: 'expired' }
  if (data.status === 'expired') return { ok: false, reason: 'expired' }

  // The firm's name, for the client-facing page header. Firm-level now, so it
  // comes from firms rather than the owner's profile.
  const { data: firm } = await admin
    .from('firms')
    .select('name')
    .eq('id', data.firm_id)
    .maybeSingle()

  const items = (data.document_request_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      id: item.id,
      label: item.label,
      is_required: item.is_required,
      fulfilled: item.fulfilled_document_id !== null,
    }))

  return {
    ok: true,
    request: {
      id: data.id,
      firm_id: data.firm_id,
      client_id: data.client_id,
      title: data.title,
      message: data.message,
      status: data.status,
      expires_at: data.expires_at,
      firm_name: firm?.name ?? null,
      client_name: data.clients?.name ?? '',
      items,
    },
  }
}
