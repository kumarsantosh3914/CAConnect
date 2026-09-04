'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { SERVICE_TYPES } from '@/lib/validations/client'
import type { DeadlineStatus } from '@/types/database'

export type DeadlineActionResult = { ok: true } | { ok: false; error: string }

const STATUSES: DeadlineStatus[] = ['pending', 'in_progress', 'filed', 'done']

export async function updateDeadlineStatus(
  deadlineId: string,
  status: DeadlineStatus
): Promise<DeadlineActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  if (!STATUSES.includes(status)) return { ok: false, error: 'That status is not valid.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('deadlines')
    .update({
      status,
      // Stamp the filing date when it reaches a terminal state, clear it if
      // the CA moves it back — otherwise the record claims a filing that was undone.
      filed_at: status === 'filed' || status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', deadlineId)

  if (error) return { ok: false, error: 'Could not update that deadline. Please try again.' }

  revalidatePath('/deadlines')
  revalidatePath('/dashboard')
  return { ok: true }
}

const manualDeadlineSchema = z.object({
  client_id: z.string().uuid('Pick a client'),
  service_type: z.enum(SERVICE_TYPES),
  label: z.string().trim().min(1, 'Give this deadline a name').max(120),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a due date'),
  notes: z.string().max(1000).optional(),
})

export type ManualDeadlineInput = z.infer<typeof manualDeadlineSchema>

/**
 * One-off deadlines the compliance calendar cannot know about — a notice
 * reply-by date, an ad-hoc ROC filing, an assessment hearing.
 */
export async function createManualDeadline(
  input: ManualDeadlineInput
): Promise<DeadlineActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = manualDeadlineSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('deadlines').insert({
    firm_id: firm.firmId,
    created_by: user.id,
    client_id: parsed.data.client_id,
    template_id: null,
    service_type: parsed.data.service_type,
    label: parsed.data.label,
    // template_id is null here, and Postgres treats NULLs as distinct in a
    // unique index, so manual rows never collide with generated ones.
    period_label: `Manual · ${parsed.data.due_date}`,
    due_date: parsed.data.due_date,
    notes: parsed.data.notes || null,
  })

  if (error) return { ok: false, error: 'Could not add that deadline. Please try again.' }

  revalidatePath('/deadlines')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteDeadline(deadlineId: string): Promise<DeadlineActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase.from('deadlines').delete().eq('id', deadlineId)
  if (error) return { ok: false, error: 'Could not remove that deadline.' }

  revalidatePath('/deadlines')
  revalidatePath('/dashboard')
  return { ok: true }
}
