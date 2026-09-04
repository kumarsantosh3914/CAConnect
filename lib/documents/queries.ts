import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type DocumentRequestSummary = {
  id: string
  client_id: string
  client_name: string
  client_phone: string | null
  /** Needed to re-share an existing link; RLS scopes this to the owning CA. */
  token: string
  title: string
  status: string
  expires_at: string
  created_at: string
  required_total: number
  required_received: number
  files_received: number
}

export async function listDocumentRequests(clientId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('document_requests')
    .select(
      'id,client_id,token,title,status,expires_at,created_at,clients(name,phone),document_request_items(id,is_required,fulfilled_document_id),documents(id)'
    )
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) throw new Error(`Could not load document requests: ${error.message}`)

  return (data ?? []).map((row) => {
    const items = row.document_request_items ?? []
    const required = items.filter((item) => item.is_required)
    return {
      id: row.id,
      client_id: row.client_id,
      client_name: row.clients?.name ?? 'Unknown client',
      client_phone: row.clients?.phone ?? null,
      token: row.token,
      title: row.title,
      // Derive expiry rather than trusting the stored status — a request can
      // lapse without anything running to update the column.
      status:
        row.status === 'open' && new Date(row.expires_at) < new Date() ? 'expired' : row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      required_total: required.length,
      required_received: required.filter((item) => item.fulfilled_document_id !== null).length,
      files_received: (row.documents ?? []).length,
    } satisfies DocumentRequestSummary
  })
}

export type DocumentSummary = {
  id: string
  client_id: string
  client_name: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: string
  created_at: string
  request_title: string | null
}

export async function listDocuments(clientId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('documents')
    .select(
      'id,client_id,file_name,mime_type,size_bytes,uploaded_by,created_at,clients(name),document_requests(title)'
    )
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) throw new Error(`Could not load documents: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.name ?? 'Unknown client',
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    request_title: row.document_requests?.title ?? null,
  })) satisfies DocumentSummary[]
}
