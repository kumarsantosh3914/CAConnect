import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { DeadlineStatus, ServiceType } from '@/types/database'

export type DeadlineRecord = {
  id: string
  client_id: string
  client_name: string
  assigned_to: string | null
  service_type: ServiceType
  label: string
  period_label: string
  due_date: string
  status: DeadlineStatus
  notes: string | null
}

export type DeadlineBucket = {
  key: 'overdue' | 'this_week' | 'this_month' | 'later'
  title: string
  description: string
  deadlines: DeadlineRecord[]
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export async function listDeadlines({
  clientId,
  service,
  includeCompleted = false,
  assignedTo,
}: {
  clientId?: string
  service?: string
  includeCompleted?: boolean
  /** A user id, or 'unassigned' for filings nobody has picked up. */
  assignedTo?: string
} = {}) {
  const supabase = await createClient()

  let query = supabase
    .from('deadlines')
    .select('id,client_id,service_type,label,period_label,due_date,status,notes,assigned_to,clients(name)')
    .order('due_date')

  if (clientId) query = query.eq('client_id', clientId)
  if (service) query = query.eq('service_type', service as ServiceType)
  // Filed and Done are finished work — off the command centre unless asked for.
  if (!includeCompleted) query = query.in('status', ['pending', 'in_progress'])
  if (assignedTo === 'unassigned') query = query.is('assigned_to', null)
  else if (assignedTo) query = query.eq('assigned_to', assignedTo)

  const { data, error } = await query
  if (error) throw new Error(`Could not load deadlines: ${error.message}`)

  return (data ?? []).map(({ clients, ...rest }) => ({
    ...rest,
    client_name: clients?.name ?? 'Unknown client',
  })) as DeadlineRecord[]
}

/**
 * Groups by urgency rather than listing by date.
 *
 * A CA opening this at 9am needs "what will bite me" first, not a calendar.
 * Overdue leads because a missed filing means a client penalty — the exact
 * failure the product exists to prevent.
 */
export function bucketDeadlines(deadlines: DeadlineRecord[], now = new Date()): DeadlineBucket[] {
  const today = startOfDay(now)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const monthEnd = new Date(today)
  monthEnd.setDate(monthEnd.getDate() + 30)

  const buckets: DeadlineBucket[] = [
    { key: 'overdue', title: 'Overdue', description: 'Past the due date — deal with these first', deadlines: [] },
    { key: 'this_week', title: 'Next 7 days', description: 'Due this week', deadlines: [] },
    { key: 'this_month', title: 'Next 30 days', description: 'Coming up', deadlines: [] },
    { key: 'later', title: 'Later', description: 'Beyond 30 days', deadlines: [] },
  ]

  for (const deadline of deadlines) {
    const due = startOfDay(new Date(deadline.due_date))
    if (due < today) buckets[0].deadlines.push(deadline)
    else if (due <= weekEnd) buckets[1].deadlines.push(deadline)
    else if (due <= monthEnd) buckets[2].deadlines.push(deadline)
    else buckets[3].deadlines.push(deadline)
  }

  return buckets
}

/** Counts for the dashboard tiles. */
export async function deadlineSummary() {
  const deadlines = await listDeadlines()
  const [overdue, thisWeek] = bucketDeadlines(deadlines)
  return {
    overdue: overdue.deadlines.length,
    thisWeek: thisWeek.deadlines.length,
    total: deadlines.length,
    upcoming: [...overdue.deadlines, ...thisWeek.deadlines].slice(0, 6),
  }
}
