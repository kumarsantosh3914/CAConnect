'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteDeadline, updateDeadlineStatus } from '@/app/(dashboard)/deadlines/actions'
import type { DeadlineRecord } from '@/lib/deadlines/queries'
import type { DeadlineStatus } from '@/types/database'
import { formatDate, formatDueIn, serviceLabel } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const NEXT_STATUS: Record<DeadlineStatus, DeadlineStatus> = {
  pending: 'in_progress',
  in_progress: 'filed',
  filed: 'done',
  done: 'pending',
}

export function DeadlineRow({
  deadline,
  isOverdue,
  showClient = true,
}: {
  deadline: DeadlineRecord
  isOverdue: boolean
  showClient?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function setStatus(status: DeadlineStatus) {
    startTransition(async () => {
      const result = await updateDeadlineStatus(deadline.id, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteDeadline(deadline.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Deadline removed')
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0',
        isPending && 'opacity-60'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{deadline.label}</span>
          <Badge variant="outline" className="text-xs">
            {serviceLabel(deadline.service_type)}
          </Badge>
          <span className="text-xs text-muted-foreground">{deadline.period_label}</span>
        </div>
        {showClient && (
          <Link
            href={`/clients/${deadline.client_id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {deadline.client_name}
          </Link>
        )}
      </div>

      <div className="text-right">
        <div className={cn('text-sm font-medium', isOverdue && 'text-destructive')}>
          {formatDueIn(deadline.due_date)}
        </div>
        <div className="text-xs text-muted-foreground">{formatDate(deadline.due_date)}</div>
      </div>

      <StatusBadge status={isOverdue && deadline.status === 'pending' ? 'overdue' : deadline.status} />

      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setStatus(NEXT_STATUS[deadline.status])}
        >
          <Check className="size-4" aria-hidden />
          {deadline.status === 'pending' ? 'Start' : deadline.status === 'in_progress' ? 'Mark filed' : 'Done'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${deadline.label}`}>
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatus('pending')}>Mark pending</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatus('in_progress')}>Mark in progress</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatus('filed')}>Mark filed</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatus('done')}>Mark done</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
