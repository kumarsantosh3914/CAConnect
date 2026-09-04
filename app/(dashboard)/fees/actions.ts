'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { feeSchema, type FeeInput } from '@/lib/validations/fee'
import { rupeesToPaise } from '@/lib/format'
import type { FeeStatus } from '@/types/database'

export type FeeActionResult = { ok: true; feeId: string } | { ok: false; error: string }

export async function saveFee(input: FeeInput, feeId?: string): Promise<FeeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = feeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const row = {
    firm_id: firm.firmId,
    created_by: user.id,
    client_id: parsed.data.client_id,
    service_type: parsed.data.service_type ? parsed.data.service_type : null,
    description: parsed.data.description,
    amount_paise: rupeesToPaise(parsed.data.amount),
    status: parsed.data.status,
    due_date: parsed.data.due_date || null,
    invoiced_at: parsed.data.status === 'draft' ? null : now,
    paid_at: parsed.data.status === 'paid' ? now : null,
  }

  const query = feeId
    ? supabase.from('fees').update(row).eq('id', feeId).select('id').single()
    : supabase.from('fees').insert(row).select('id').single()

  const { data, error } = await query
  if (error || !data) return { ok: false, error: 'Could not save that fee. Please try again.' }

  revalidatePath('/fees')
  revalidatePath(`/clients/${parsed.data.client_id}`)
  revalidatePath('/dashboard')
  return { ok: true, feeId: data.id }
}

export async function updateFeeStatus(
  feeId: string,
  status: FeeStatus
): Promise<FeeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('fees')
    .update({
      status,
      // Clear the payment date if a fee is moved back out of Paid, so the
      // monthly collected figure never counts a reversed payment.
      paid_at: status === 'paid' ? now : null,
      invoiced_at: status === 'draft' ? null : now,
    })
    .eq('id', feeId)
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Could not update that fee.' }

  revalidatePath('/fees')
  revalidatePath('/dashboard')
  return { ok: true, feeId: data.id }
}

export async function deleteFee(feeId: string): Promise<FeeActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase.from('fees').delete().eq('id', feeId)
  if (error) return { ok: false, error: 'Could not remove that fee.' }

  revalidatePath('/fees')
  revalidatePath('/dashboard')
  return { ok: true, feeId }
}
