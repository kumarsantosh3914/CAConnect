import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getDocumentRequestItems } from '@/lib/documents/queries'
import { requestOrigin } from '@/lib/url'
import { formatDate, formatDueIn, formatPaise, serviceLabel, statusLabel } from '@/lib/format'
import type { ClientEmailTopic } from '@/types/database'

export type EmailContextResult =
  | { ok: true; facts: string }
  | { ok: false; error: string }

/**
 * Turns a topic + subject_id into the verified, plain-text facts handed to
 * the AI prompt. Every query here is re-scoped to the given client_id in
 * addition to RLS — a subject_id belonging to a different client (or a
 * different CA's data, which RLS already blocks) must not leak in.
 */
export async function buildEmailContext(
  topic: ClientEmailTopic,
  clientId: string,
  subjectId: string | null
): Promise<EmailContextResult> {
  const supabase = await createClient()

  switch (topic) {
    case 'deadline_reminder': {
      if (!subjectId) return { ok: false, error: 'Pick a deadline.' }
      const { data, error } = await supabase
        .from('deadlines')
        .select('label,period_label,due_date,status,service_type')
        .eq('id', subjectId)
        .eq('client_id', clientId)
        .maybeSingle()
      if (error || !data) return { ok: false, error: 'That deadline could not be found.' }

      return {
        ok: true,
        facts: [
          `Filing: ${data.label} (${serviceLabel(data.service_type)}), period ${data.period_label}`,
          `Due date: ${formatDate(data.due_date)} (${formatDueIn(data.due_date)})`,
          `Current status: ${statusLabel(data.status)}`,
        ].join('\n'),
      }
    }

    case 'document_followup': {
      if (!subjectId) return { ok: false, error: 'Pick a document request.' }
      const { data, error } = await supabase
        .from('document_requests')
        .select('title,token,expires_at')
        .eq('id', subjectId)
        .eq('client_id', clientId)
        .maybeSingle()
      if (error || !data) return { ok: false, error: 'That document request could not be found.' }

      const items = await getDocumentRequestItems(subjectId)
      const outstanding = items.filter((item) => item.is_required && !item.fulfilled)
      if (outstanding.length === 0) {
        return { ok: false, error: 'Every required document for that request has already been received.' }
      }

      const origin = await requestOrigin()
      return {
        ok: true,
        facts: [
          `Document request: ${data.title}`,
          `Still outstanding: ${outstanding.map((item) => item.label).join(', ')}`,
          `Upload link (use exactly as given, do not alter it): ${origin}/upload/${data.token}`,
          `Link valid until: ${formatDate(data.expires_at)}`,
        ].join('\n'),
      }
    }

    case 'fee_reminder': {
      if (!subjectId) return { ok: false, error: 'Pick a fee.' }
      const { data, error } = await supabase
        .from('fees')
        .select('description,amount_paise,status,due_date,service_type')
        .eq('id', subjectId)
        .eq('client_id', clientId)
        .maybeSingle()
      if (error || !data) return { ok: false, error: 'That fee could not be found.' }

      return {
        ok: true,
        facts: [
          `Service: ${data.description}${data.service_type ? ` (${serviceLabel(data.service_type)})` : ''}`,
          `Amount due: ${formatPaise(data.amount_paise)}`,
          `Status: ${statusLabel(data.status)}`,
          data.due_date ? `Due date: ${formatDate(data.due_date)} (${formatDueIn(data.due_date)})` : 'No due date set',
        ].join('\n'),
      }
    }

    case 'custom':
      // No verified facts beyond the client's name — the CA's own notes
      // (validated as required for this topic by the caller) carry the topic.
      return { ok: true, facts: '(none — this email is about the topic described below)' }
  }
}
