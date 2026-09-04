'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { generateUploadToken } from '@/lib/documents/tokens'
import { requestOrigin } from '@/lib/url'

export type DocumentActionResult =
  | { ok: true; requestId: string; url: string }
  | { ok: false; error: string }

const requestSchema = z.object({
  client_id: z.string().uuid('Pick a client'),
  title: z.string().trim().min(1, 'Give this request a title').max(120),
  message: z.string().max(1000).optional(),
  expires_in_days: z.number().int().min(1).max(180),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'Each item needs a name').max(120),
        is_required: z.boolean(),
      })
    )
    .min(1, 'Add at least one document to the checklist'),
})

export type DocumentRequestInput = z.infer<typeof requestSchema>

export async function createDocumentRequest(
  input: DocumentRequestInput
): Promise<DocumentActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const supabase = await createClient()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expires_in_days)

  const { data: created, error } = await supabase
    .from('document_requests')
    .insert({
      firm_id: firm.firmId,
    created_by: user.id,
      client_id: parsed.data.client_id,
      token: generateUploadToken(),
      title: parsed.data.title,
      message: parsed.data.message || null,
      expires_at: expiresAt.toISOString(),
    })
    .select('id,token')
    .single()

  if (error || !created) {
    return { ok: false, error: 'Could not create that request. Please try again.' }
  }

  const { error: itemsError } = await supabase.from('document_request_items').insert(
    parsed.data.items.map((item, index) => ({
      firm_id: firm.firmId,
    created_by: user.id,
      request_id: created.id,
      label: item.label,
      is_required: item.is_required,
      sort_order: index,
    }))
  )

  if (itemsError) {
    await supabase.from('document_requests').delete().eq('id', created.id)
    return { ok: false, error: 'Could not save the checklist. Please try again.' }
  }

  revalidatePath('/documents')
  revalidatePath(`/clients/${parsed.data.client_id}`)

  return {
    ok: true,
    requestId: created.id,
    // Built from the host the CA is on, so the link always matches the domain
    // they are looking at.
    url: `${await requestOrigin()}/upload/${created.token}`,
  }
}

export async function expireDocumentRequest(
  requestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('document_requests')
    .update({ status: 'expired' })
    .eq('id', requestId)

  if (error) return { ok: false, error: 'Could not close that request.' }

  revalidatePath('/documents')
  return { ok: true }
}

/**
 * Short-lived signed URL for a private storage object.
 *
 * Deliberately uses the CA's own session, not the service-role client: the
 * `client_documents_select_own` storage policy already scopes them to their
 * own user_id prefix, so RLS does the authorising. Reaching for admin here
 * would widen the service-role blast radius for no reason.
 */
export async function getDocumentUrl(
  documentId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { data: document, error } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle()

  // RLS returns nothing for another CA's document, so this doubles as the
  // ownership check.
  if (error || !document) return { ok: false, error: 'That document could not be found.' }

  const { data: signed, error: signError } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(document.storage_path, 60 * 5)

  if (signError || !signed) return { ok: false, error: 'Could not open that document.' }
  return { ok: true, url: signed.signedUrl }
}
