import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { NoticeStatus } from '@/types/database'

export type NoticeSummary = {
  id: string
  client_id: string | null
  client_name: string | null
  title: string
  notice_type: string | null
  status: NoticeStatus
  model: string | null
  has_draft: boolean
  created_at: string
}

export async function listNotices(clientId?: string): Promise<NoticeSummary[]> {
  const supabase = await createClient()

  let query = supabase
    .from('notices')
    .select('id,client_id,title,notice_type,status,model,draft_response,edited_response,created_at,clients(name)')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) throw new Error(`Could not load notices: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.name ?? null,
    title: row.title,
    notice_type: row.notice_type,
    status: row.status,
    model: row.model,
    has_draft: Boolean(row.edited_response ?? row.draft_response),
    created_at: row.created_at,
  }))
}

export async function getNotice(noticeId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notices')
    .select('*,clients(name)')
    .eq('id', noticeId)
    .maybeSingle()

  if (error) throw new Error(`Could not load notice: ${error.message}`)
  return data
}
