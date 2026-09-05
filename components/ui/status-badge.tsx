import { Badge } from '@/components/ui/badge'
import { statusLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * One badge for every status in the app — deadlines, fees, document requests
 * and notices all read from the same colour vocabulary, so a CA learns it once.
 */
const STATUS_STYLES: Record<string, string> = {
  // Not started / neutral
  pending: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-muted text-muted-foreground',
  // Underway
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  invoiced: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  // Complete
  filed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  done: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  sent: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  // Needs attention
  overdue: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  reupload_requested: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  unresolved: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  // KYC / reconciliation progress
  uploaded: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  verified: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  follow_up_supplier: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  accepted_difference: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  // Notice tracker
  received: 'bg-muted text-muted-foreground',
  response_drafted: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  response_sent: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  hearing_scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  order_received: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  closed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  appeal_filed: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  appeal_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  appeal_order: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn('border-transparent font-medium', STATUS_STYLES[status], className)}
    >
      {statusLabel(status)}
    </Badge>
  )
}
