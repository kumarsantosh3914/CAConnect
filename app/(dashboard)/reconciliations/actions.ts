'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getApiFirm } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { parseGstr2bJson, parsePurchaseCsv, reconcile } from '@/lib/reconciliation/match'
import type { ReconciliationResolution } from '@/types/database'

type Result = { ok: true; runId: string } | { ok: false; error: string }

const MAX_BYTES = 10 * 1024 * 1024
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Choose a reconciliation month')

function validImport(file: FormDataEntryValue | null, kind: 'csv' | 'json'): file is File {
  return file instanceof File && file.size > 0 && file.size <= MAX_BYTES && file.name.toLowerCase().endsWith(`.${kind}`)
}

export async function createReconciliationRun(formData: FormData): Promise<Result> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const clientId = String(formData.get('client_id') ?? '')
  const period = monthSchema.safeParse(formData.get('period_month'))
  const purchase = formData.get('purchase_register')
  const gstr = formData.get('gstr_2b')
  if (!z.string().uuid().safeParse(clientId).success || !period.success) return { ok: false, error: 'Choose a client and month.' }
  if (!validImport(purchase, 'csv') || !validImport(gstr, 'json')) return { ok: false, error: 'Upload a CSV purchase register and JSON GSTR-2B file under 10 MB.' }

  let purchases
  let gstrInvoices
  try {
    purchases = parsePurchaseCsv(await purchase.text())
    gstrInvoices = parseGstr2bJson(await gstr.text())
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not read those files.' }
  }
  const mismatches = reconcile(purchases, gstrInvoices)
  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).maybeSingle()
  if (!client) return { ok: false, error: 'That client could not be found.' }

  const prefix = `${ctx.firm.firmId}/${clientId}/reconciliations/${period.data}`
  const purchasePath = `${prefix}/${randomUUID()}-purchase-register.csv`
  const gstrPath = `${prefix}/${randomUUID()}-gstr-2b.json`
  const [purchaseUpload, gstrUpload] = await Promise.all([
    supabase.storage.from('reconciliation-imports').upload(purchasePath, purchase, { contentType: 'text/csv', upsert: false }),
    supabase.storage.from('reconciliation-imports').upload(gstrPath, gstr, { contentType: 'application/json', upsert: false }),
  ])
  if (purchaseUpload.error || gstrUpload.error) {
    await supabase.storage.from('reconciliation-imports').remove([purchasePath, gstrPath])
    return { ok: false, error: 'Could not store the source files. Please try again.' }
  }

  const periodMonth = `${period.data}-01`
  const { data: run, error } = await supabase
    .from('reconciliation_runs')
    .upsert({
      firm_id: ctx.firm.firmId, created_by: ctx.user.id, client_id: clientId, period_month: periodMonth,
      status: 'in_progress', purchase_file_path: purchasePath, gstr_file_path: gstrPath,
      purchase_total: purchases.length, gstr_total: gstrInvoices.length, mismatch_total: mismatches.length,
      completed_at: null,
    }, { onConflict: 'client_id,period_month' })
    .select('id')
    .single()
  if (error || !run) return { ok: false, error: 'Could not save this reconciliation.' }
  await supabase.from('reconciliation_mismatches').delete().eq('run_id', run.id)
  if (mismatches.length) {
    const { error: mismatchError } = await supabase.from('reconciliation_mismatches').insert(mismatches.map((row) => ({
      firm_id: ctx.firm.firmId, run_id: run.id, match_type: row.matchType,
      supplier_gstin: row.supplierGstin, invoice_number: row.invoiceNumber, invoice_date: row.invoiceDate,
      purchase_amount_paise: row.purchaseAmountPaise, gstr_amount_paise: row.gstrAmountPaise,
      difference_paise: row.differencePaise,
    })))
    if (mismatchError) return { ok: false, error: 'The files were saved but mismatches could not be generated.' }
  }
  revalidatePath('/reconciliations')
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/dashboard')
  return { ok: true, runId: run.id }
}

export async function resolveMismatches(
  runId: string,
  mismatchIds: string[],
  resolution: ReconciliationResolution,
  note?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  if (!z.string().uuid().safeParse(runId).success || !mismatchIds.every((id) => z.string().uuid().safeParse(id).success)) return { ok: false, error: 'Invalid reconciliation rows.' }
  const valid = ['unresolved', 'follow_up_supplier', 'accepted_difference', 'resolved'] as const
  if (!valid.includes(resolution)) return { ok: false, error: 'Invalid resolution.' }
  const supabase = await createClient()
  const { error } = await supabase.from('reconciliation_mismatches').update({ resolution, resolution_note: note?.trim() || null }).eq('run_id', runId).in('id', mismatchIds)
  if (error) return { ok: false, error: 'Could not update those mismatches.' }
  const { count } = await supabase.from('reconciliation_mismatches').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('resolution', 'unresolved')
  await supabase.from('reconciliation_runs').update({ status: (count ?? 0) === 0 ? 'done' : 'in_progress', completed_at: (count ?? 0) === 0 ? new Date().toISOString() : null }).eq('id', runId)
  revalidatePath('/reconciliations')
  revalidatePath('/dashboard')
  return { ok: true }
}
