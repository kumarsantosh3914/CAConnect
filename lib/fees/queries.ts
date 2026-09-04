import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { FeeStatus, ServiceType } from '@/types/database'

export type FeeRecord = {
  id: string
  client_id: string
  client_name: string
  service_type: ServiceType | null
  description: string
  amount_paise: number
  status: FeeStatus
  due_date: string | null
  paid_at: string | null
  created_at: string
  /** Derived, not stored: invoiced and past its due date. */
  is_overdue: boolean
}

export async function listFees({
  clientId,
  status,
}: { clientId?: string; status?: string } = {}) {
  const supabase = await createClient()

  let query = supabase
    .from('fees')
    .select('id,client_id,service_type,description,amount_paise,status,due_date,paid_at,created_at,clients(name)')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (status && status !== 'overdue') query = query.eq('status', status as FeeStatus)

  const { data, error } = await query
  if (error) throw new Error(`Could not load fees: ${error.message}`)

  const today = new Date().toISOString().slice(0, 10)

  const rows = (data ?? []).map(({ clients, ...rest }) => ({
    ...rest,
    client_name: clients?.name ?? 'Unknown client',
    // Overdue is a view of invoiced + past due, never a stored status —
    // otherwise something has to run every night to keep it honest.
    is_overdue: rest.status === 'invoiced' && !!rest.due_date && rest.due_date < today,
  })) as FeeRecord[]

  return status === 'overdue' ? rows.filter((fee) => fee.is_overdue) : rows
}

export type FeeTotals = {
  collectedThisMonth: number
  outstanding: number
  overdue: number
  overdueCount: number
}

export async function feeTotals(): Promise<FeeTotals> {
  const fees = await listFees()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  return {
    collectedThisMonth: fees
      .filter((fee) => fee.status === 'paid' && fee.paid_at && fee.paid_at >= monthStart)
      .reduce((sum, fee) => sum + fee.amount_paise, 0),
    outstanding: fees
      .filter((fee) => fee.status === 'invoiced')
      .reduce((sum, fee) => sum + fee.amount_paise, 0),
    overdue: fees.filter((fee) => fee.is_overdue).reduce((sum, fee) => sum + fee.amount_paise, 0),
    overdueCount: fees.filter((fee) => fee.is_overdue).length,
  }
}
