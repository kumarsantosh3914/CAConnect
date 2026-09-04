'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { extractPdfText, PDF_LIMITS } from '@/lib/notices/pdf'

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
