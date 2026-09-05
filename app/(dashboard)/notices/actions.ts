'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { extractPdfText, PDF_LIMITS } from '@/lib/notices/pdf'
import type { NoticeCaseStatus } from '@/types/database'

export type NoticeActionResult =
  | { ok: true; noticeId: string }
  | { ok: false; error: string }

const noticeSchema = z.object({
  title: z.string().trim().min(1, 'Give this notice a title').max(160),
  notice_type: z.string().trim().max(60).optional(),
  notice_text: z
    .string()
    .trim()
    .min(PDF_LIMITS.minExtractedChars, 'Paste the full notice text')
    .max(PDF_LIMITS.maxChars, 'That notice is very long — paste just the relevant pages'),
  client_id: z.string().optional(),
  source: z.enum(['paste', 'pdf']),
})

export type NoticeInput = z.infer<typeof noticeSchema>

export async function createNotice(input: NoticeInput): Promise<NoticeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = noticeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notices')
    .insert({
      firm_id: firm.firmId,
    created_by: user.id,
      client_id: parsed.data.client_id || null,
      title: parsed.data.title,
      notice_type: parsed.data.notice_type || null,
      notice_text: parsed.data.notice_text,
      source: parsed.data.source,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not save that notice. Please try again.' }

  revalidatePath('/notices')
  return { ok: true, noticeId: data.id }
}

/** The CA's edits are stored separately, so the original AI draft survives. */
export async function saveNoticeEdit(
  noticeId: string,
  editedResponse: string
): Promise<NoticeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('notices')
    .update({ edited_response: editedResponse, status: 'reviewed' })
    .eq('id', noticeId)

  if (error) return { ok: false, error: 'Could not save your changes.' }

  revalidatePath('/notices')
  revalidatePath(`/notices/${noticeId}`)
  return { ok: true, noticeId }
}

export async function deleteNotice(noticeId: string): Promise<NoticeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase.from('notices').delete().eq('id', noticeId)
  if (error) return { ok: false, error: 'Could not remove that notice.' }

  revalidatePath('/notices')
  return { ok: true, noticeId }
}

const matterSchema = z.object({
  client_id: z.string().uuid('Pick a client'),
  title: z.string().trim().min(1, 'Give this matter a title').max(160),
  notice_type: z.string().trim().min(1, 'Choose a notice type').max(60),
  notice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  response_deadline: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  amount_in_dispute: z.union([z.literal(''), z.string().regex(/^\d+(\.\d{1,2})?$/)]),
  notes: z.string().trim().max(4000).optional(),
})

function paise(value: string): number | null {
  if (!value) return null
  const [whole, fractional = ''] = value.split('.')
  return Number(whole) * 100 + Number((fractional + '00').slice(0, 2))
}

export async function createNoticeMatter(input: z.infer<typeof matterSchema>): Promise<NoticeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const parsed = matterSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the matter.' }
  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('assigned_to').eq('id', parsed.data.client_id).maybeSingle()
  if (!client) return { ok: false, error: 'That client could not be found.' }
  const { data, error } = await supabase.from('notices').insert({
    firm_id: ctx.firm.firmId, created_by: ctx.user.id, client_id: parsed.data.client_id,
    title: parsed.data.title, notice_type: parsed.data.notice_type, source: 'paste', notice_text: null,
    tracker_enabled: true, case_status: 'received', notice_date: parsed.data.notice_date,
    response_deadline: parsed.data.response_deadline || null, amount_in_dispute_paise: paise(parsed.data.amount_in_dispute),
    assigned_to: client.assigned_to ?? ctx.user.id,
  }).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not add that matter.' }
  if (parsed.data.notes) await supabase.from('notice_events').insert({ firm_id: ctx.firm.firmId, notice_id: data.id, event_type: 'note', body: parsed.data.notes, created_by: ctx.user.id })
  revalidatePath('/notices'); revalidatePath('/dashboard'); revalidatePath(`/clients/${parsed.data.client_id}`)
  return { ok: true, noticeId: data.id }
}

export async function saveToNoticeTracker(noticeId: string): Promise<NoticeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const supabase = await createClient()
  const { data: notice } = await supabase.from('notices').select('client_id').eq('id', noticeId).maybeSingle()
  if (!notice?.client_id) return { ok: false, error: 'Link this draft to a client before tracking it.' }
  const { data: client } = await supabase.from('clients').select('assigned_to').eq('id', notice.client_id).maybeSingle()
  const { error } = await supabase.from('notices').update({ tracker_enabled: true, case_status: 'response_drafted', assigned_to: client?.assigned_to ?? ctx.user.id }).eq('id', noticeId)
  if (error) return { ok: false, error: 'Could not add this notice to the tracker.' }
  await supabase.from('notice_events').insert({ firm_id: ctx.firm.firmId, notice_id: noticeId, event_type: 'status_change', to_status: 'response_drafted', created_by: ctx.user.id })
  revalidatePath('/notices'); revalidatePath(`/notices/${noticeId}`); revalidatePath('/dashboard')
  return { ok: true, noticeId }
}

const caseStatuses: NoticeCaseStatus[] = ['received', 'response_drafted', 'response_sent', 'hearing_scheduled', 'order_received', 'closed', 'appeal_filed', 'appeal_pending', 'appeal_order']

export async function updateMatterStatus(noticeId: string, status: NoticeCaseStatus, note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  if (!caseStatuses.includes(status)) return { ok: false, error: 'Invalid matter status.' }
  const supabase = await createClient()
  const { data: notice } = await supabase.from('notices').select('case_status,client_id').eq('id', noticeId).eq('tracker_enabled', true).maybeSingle()
  if (!notice) return { ok: false, error: 'That matter could not be found.' }
  const { error } = await supabase.from('notices').update({ case_status: status }).eq('id', noticeId)
  if (error) return { ok: false, error: 'Could not update the matter.' }
  await supabase.from('notice_events').insert({ firm_id: ctx.firm.firmId, notice_id: noticeId, event_type: 'status_change', body: note?.trim() || null, from_status: notice.case_status, to_status: status, created_by: ctx.user.id })
  revalidatePath('/notices'); revalidatePath(`/notices/${noticeId}`); revalidatePath('/dashboard'); if (notice.client_id) revalidatePath(`/clients/${notice.client_id}`)
  return { ok: true }
}

export async function addHearing(noticeId: string, hearingDate: string, notes?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hearingDate)) return { ok: false, error: 'Enter a valid hearing date.' }
  const supabase = await createClient()
  const { error } = await supabase.from('notice_hearings').insert({ firm_id: ctx.firm.firmId, notice_id: noticeId, hearing_date: hearingDate, notes: notes?.trim() || null, created_by: ctx.user.id })
  if (error) return { ok: false, error: 'Could not add that hearing.' }
  await updateMatterStatus(noticeId, 'hearing_scheduled')
  revalidatePath('/notices/calendar')
  return { ok: true }
}

/**
 * Extracts text from an uploaded notice PDF.
 *
 * Runs as a Server Action rather than in the browser so pdf parsing stays off
 * the CA's machine and the file never has to reach the AI vendor.
 */
export async function extractNoticePdf(
  formData: FormData
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file was received.' }
  if (file.type !== 'application/pdf') return { ok: false, error: 'Please upload a PDF.' }
  if (file.size > PDF_LIMITS.maxBytes) {
    return { ok: false, error: 'That PDF is larger than 10 MB.' }
  }

  try {
    const text = await extractPdfText(await file.arrayBuffer())
    if (text.length < PDF_LIMITS.minExtractedChars) {
      return {
        ok: false,
        // Most IT notices arrive as scans. Say what to do about it.
        error:
          'No readable text in that PDF — it is probably a scan. Please copy the notice text and paste it instead.',
      }
    }
    return { ok: true, text: text.slice(0, PDF_LIMITS.maxChars) }
  } catch {
    return { ok: false, error: 'That PDF could not be read. Try pasting the text instead.' }
  }
}
