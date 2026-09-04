import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ClientEmailTopic, NoticeStatus } from '@/types/database'

export type ClientEmailSummary = {
  id: string
  client_id: string
  client_name: string
  topic: ClientEmailTopic
  /** Whichever subject is current: the CA's edit if there is one, else the AI draft. */
  subject: string | null
  status: NoticeStatus
  model: string | null
  has_draft: boolean
  created_at: string
}

export async function listClientEmails(clientId?: string): Promise<ClientEmailSummary[]> {
  const supabase = await createClient()

  let query = supabase
    .from('client_emails')
    .select('id,client_id,topic,draft_subject,edited_subject,status,model,draft_body,edited_body,created_at,clients(name)')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) throw new Error(`Could not load client emails: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.name ?? 'Unknown client',
    topic: row.topic,
    subject: row.edited_subject ?? row.draft_subject,
    status: row.status,
    model: row.model,
    has_draft: Boolean(row.edited_body ?? row.draft_body),
    created_at: row.created_at,
  }))
}

export async function getClientEmail(emailId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_emails')
    .select('*,clients(name,email)')
    .eq('id', emailId)
    .maybeSingle()

  if (error) throw new Error(`Could not load client email: ${error.message}`)
  return data
}
