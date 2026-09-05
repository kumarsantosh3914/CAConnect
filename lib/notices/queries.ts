import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { NoticeStatus } from '@/types/database'
import type { NoticeCaseStatus } from '@/types/database'

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
  tracker_enabled: boolean
  case_status: NoticeCaseStatus | null
  response_deadline: string | null
  amount_in_dispute_paise: number | null
}

export async function listNotices(clientId?: string): Promise<NoticeSummary[]> {
  const supabase = await createClient()

  let query = supabase
    .from('notices')
    .select('id,client_id,title,notice_type,status,model,draft_response,edited_response,created_at,tracker_enabled,case_status,response_deadline,amount_in_dispute_paise,clients(name)')
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
    tracker_enabled: row.tracker_enabled,
    case_status: row.case_status,
    response_deadline: row.response_deadline,
    amount_in_dispute_paise: row.amount_in_dispute_paise,
  }))
}

export async function listHearings(from?: string, to?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('notice_hearings')
    .select('id,notice_id,hearing_date,notes,notices(title,client_id,clients(name))')
    .order('hearing_date')
  if (from) query = query.gte('hearing_date', from)
  if (to) query = query.lte('hearing_date', to)
  const { data, error } = await query
  if (error) throw new Error(`Could not load hearings: ${error.message}`)
  return data ?? []
}

export async function noticeTrackerTotals() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notices')
    .select('amount_in_dispute_paise,case_status')
    .eq('tracker_enabled', true)
    .not('case_status', 'in', '(closed,appeal_order)')
  if (error) throw new Error(`Could not load notice totals: ${error.message}`)
  return (data ?? []).reduce((total, notice) => total + (notice.amount_in_dispute_paise ?? 0), 0)
}

export type NoticeHearing = {
  id: string
  hearing_date: string
  notes: string | null
  created_at: string
}

export type NoticeEvent = {
  id: string
  event_type: 'note' | 'status_change'
  body: string | null
  from_status: NoticeCaseStatus | null
  to_status: NoticeCaseStatus | null
  created_at: string
}

export async function getNotice(noticeId: string) {
  const supabase = await createClient()
  const [{ data, error }, { data: hearings }, { data: events }] = await Promise.all([
    supabase.from('notices').select('*,clients(name)').eq('id', noticeId).maybeSingle(),
    supabase.from('notice_hearings').select('id,hearing_date,notes,created_at').eq('notice_id', noticeId).order('hearing_date'),
    supabase.from('notice_events').select('id,event_type,body,from_status,to_status,created_at').eq('notice_id', noticeId).order('created_at'),
  ])
  if (error) throw new Error(`Could not load notice: ${error.message}`)
  if (!data) return null
  return { ...data, hearings: (hearings ?? []) as NoticeHearing[], events: (events ?? []) as NoticeEvent[] }
}
