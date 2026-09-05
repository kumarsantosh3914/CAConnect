import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ReconciliationStatus, ReconciliationMatchType, ReconciliationResolution } from '@/types/database'

export type ReconciliationRunSummary = {
  id: string
  client_id: string
  client_name: string
  period_month: string
  status: ReconciliationStatus
  purchase_total: number
  gstr_total: number
  mismatch_total: number
  created_at: string
}

export type ReconciliationMismatch = {
  id: string
  match_type: ReconciliationMatchType
  supplier_gstin: string
  invoice_number: string
  invoice_date: string | null
  purchase_amount_paise: number | null
  gstr_amount_paise: number | null
  difference_paise: number
  resolution: ReconciliationResolution
  resolution_note: string | null
}

export type ReconciliationRunDetail = ReconciliationRunSummary & {
  mismatches: ReconciliationMismatch[]
  completed_at: string | null
}

export async function listReconciliationRuns(clientId?: string): Promise<ReconciliationRunSummary[]> {
  const supabase = await createClient()
  let query = supabase
    .from('reconciliation_runs')
    .select('id,client_id,period_month,status,purchase_total,gstr_total,mismatch_total,created_at,clients(name)')
    .order('period_month', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(`Could not load reconciliation runs: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.name ?? 'Unknown client',
    period_month: row.period_month,
    status: row.status,
    purchase_total: row.purchase_total,
    gstr_total: row.gstr_total,
    mismatch_total: row.mismatch_total,
    created_at: row.created_at,
  }))
}

export async function getReconciliationRun(runId: string): Promise<ReconciliationRunDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reconciliation_runs')
    .select('id,client_id,period_month,status,purchase_total,gstr_total,mismatch_total,created_at,completed_at,clients(name)')
    .eq('id', runId)
    .maybeSingle()
  if (error) throw new Error(`Could not load reconciliation run: ${error.message}`)
  if (!data) return null
  const { data: mismatches, error: mismatchError } = await supabase
    .from('reconciliation_mismatches')
    .select('id,match_type,supplier_gstin,invoice_number,invoice_date,purchase_amount_paise,gstr_amount_paise,difference_paise,resolution,resolution_note')
    .eq('run_id', runId)
    .order('supplier_gstin')
    .order('invoice_number')
  if (mismatchError) throw new Error(`Could not load mismatches: ${mismatchError.message}`)
  return {
    id: data.id,
    client_id: data.client_id,
    client_name: data.clients?.name ?? 'Unknown client',
    period_month: data.period_month,
    status: data.status,
    purchase_total: data.purchase_total,
    gstr_total: data.gstr_total,
    mismatch_total: data.mismatch_total,
    created_at: data.created_at,
    completed_at: data.completed_at,
    mismatches: mismatches ?? [],
  }
}
