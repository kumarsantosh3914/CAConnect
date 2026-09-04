'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth'

export type ClientEmailActionResult =
  | { ok: true; emailId: string }
  | { ok: false; error: string }

const TOPICS = ['deadline_reminder', 'document_followup', 'fee_reminder', 'custom'] as const

const createSchema = z.object({
  client_id: z.string().min(1, 'Pick a client'),
  topic: z.enum(TOPICS),
  subject_id: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateClientEmailInput = z.infer<typeof createSchema>

export async function createClientEmail(
  input: CreateClientEmailInput
): Promise<ClientEmailActionResult> {
  const user = await getApiUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }
  if (parsed.data.topic === 'custom' && !parsed.data.notes?.trim()) {
    return { ok: false, error: 'Describe what this email is about.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_emails')
    .insert({
      user_id: user.id,
      client_id: parsed.data.client_id,
      topic: parsed.data.topic,
      subject_id: parsed.data.subject_id || null,
      notes: parsed.data.notes || null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not save that email. Please try again.' }

  revalidatePath('/client-emails')
  return { ok: true, emailId: data.id }
}

/** The CA's edits are stored separately, so the original AI draft survives. */
export async function saveClientEmailEdit(
  emailId: string,
  edits: { subject: string; body: string }
): Promise<ClientEmailActionResult> {
  const user = await getApiUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_emails')
    .update({ edited_subject: edits.subject, edited_body: edits.body, status: 'reviewed' })
    .eq('id', emailId)

  if (error) return { ok: false, error: 'Could not save your changes.' }

  revalidatePath('/client-emails')
  revalidatePath(`/client-emails/${emailId}`)
  return { ok: true, emailId }
}

export async function markClientEmailSent(emailId: string): Promise<ClientEmailActionResult> {
  const user = await getApiUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase.from('client_emails').update({ status: 'sent' }).eq('id', emailId)
  if (error) return { ok: false, error: 'Could not update that email.' }

  revalidatePath('/client-emails')
  revalidatePath(`/client-emails/${emailId}`)
  return { ok: true, emailId }
}

export async function deleteClientEmail(emailId: string): Promise<ClientEmailActionResult> {
  const user = await getApiUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase.from('client_emails').delete().eq('id', emailId)
  if (error) return { ok: false, error: 'Could not remove that email.' }

  revalidatePath('/client-emails')
  return { ok: true, emailId }
}
