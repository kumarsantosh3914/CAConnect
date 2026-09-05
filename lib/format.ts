/**
 * Display formatting. Indian conventions throughout: rupees with lakh/crore
 * digit grouping, dd MMM yyyy dates.
 *
 * Money is stored as integer paise everywhere. Floats are never used for
 * currency — ₹1,999.50 is 199950, not 1999.5.
 */

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const rupeeWithPaiseFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 199950 → "₹1,999.50"; whole rupees drop the decimals → "₹1,999" */
export function formatPaise(paise: number): string {
  const rupees = paise / 100
  return paise % 100 === 0 ? rupeeFormatter.format(rupees) : rupeeWithPaiseFormatter.format(rupees)
}

/** "1999.50" or 1999.5 → 199950. Throws on values that are not money. */
export function rupeesToPaise(rupees: string | number): number {
  const value = typeof rupees === 'string' ? Number(rupees.replace(/[,₹\s]/g, '')) : rupees
  if (!Number.isFinite(value)) throw new Error('Enter a valid amount')
  return Math.round(value * 100)
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter.format(date)
}

/** "in 3 days" / "today" / "5 days overdue" — how CAs actually read a calendar. */
export function formatDueIn(dueDate: string | Date): string {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const today = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round(
    (startOfDay(due).getTime() - startOfDay(today).getTime()) / 86_400_000
  )

  if (days === 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  if (days === -1) return '1 day overdue'
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `in ${days} days`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SERVICE_LABELS: Record<string, string> = {
  itr: 'ITR',
  gstr1: 'GSTR-1',
  gstr3b: 'GSTR-3B',
  tds: 'TDS',
  roc: 'ROC',
  company_registration: 'Company Registration',
  other: 'Other',
}

export function serviceLabel(service: string): string {
  return SERVICE_LABELS[service] ?? service
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  company: 'Company',
  firm: 'Partnership Firm',
  llp: 'LLP',
  huf: 'HUF',
  trust: 'Trust',
}

export function clientTypeLabel(type: string): string {
  return CLIENT_TYPE_LABELS[type] ?? type
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  filed: 'Filed',
  done: 'Done',
  draft: 'Draft',
  invoiced: 'Invoiced',
  paid: 'Paid',
  open: 'Open',
  // Derived, not a stored status — but it still needs a label, or the badge
  // renders the raw value in lowercase.
  overdue: 'Overdue',
  completed: 'Completed',
  expired: 'Expired',
  reviewed: 'Reviewed',
  sent: 'Sent',
  submitted: 'Submitted',
  // KYC item verification statuses
  uploaded: 'Uploaded',
  verified: 'Verified',
  reupload_requested: 'Re-upload needed',
  // Reconciliation mismatch resolutions
  unresolved: 'Unresolved',
  follow_up_supplier: 'Follow up with supplier',
  accepted_difference: 'Accepted difference',
  resolved: 'Resolved',
  // Notice tracker case statuses
  received: 'Received',
  response_drafted: 'Response drafted',
  response_sent: 'Response sent',
  hearing_scheduled: 'Hearing scheduled',
  order_received: 'Order received',
  closed: 'Closed',
  appeal_filed: 'Appeal filed',
  appeal_pending: 'Appeal pending',
  appeal_order: 'Appeal order',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}
