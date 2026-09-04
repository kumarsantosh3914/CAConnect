import { CalendarCheck } from 'lucide-react'
import type { DeadlineBucket } from '@/lib/deadlines/queries'
import { DeadlineRow } from './deadline-row'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export function DeadlineBuckets({
  buckets,
  showClient = true,
  emptyTitle = 'Nothing due',
  emptyDescription = 'Every compliance deadline is filed. Enjoy it.',
}: {
  buckets: DeadlineBucket[]
  showClient?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.deadlines.length, 0)

  if (total === 0) {
    return <EmptyState icon={CalendarCheck} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-6">
      {buckets
        .filter((bucket) => bucket.deadlines.length > 0)
        .map((bucket) => (
          <section key={bucket.key} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h2
                className={cn(
                  'text-sm font-semibold',
                  bucket.key === 'overdue' && 'text-destructive'
                )}
              >
                {bucket.title}
              </h2>
              <span className="text-xs text-muted-foreground">
                {bucket.deadlines.length} · {bucket.description}
              </span>
            </div>
            <div
              className={cn(
                'rounded-lg border',
                bucket.key === 'overdue' && 'border-destructive/40'
              )}
            >
              {bucket.deadlines.map((deadline) => (
                <DeadlineRow
                  key={deadline.id}
                  deadline={deadline}
                  isOverdue={bucket.key === 'overdue'}
                  showClient={showClient}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
