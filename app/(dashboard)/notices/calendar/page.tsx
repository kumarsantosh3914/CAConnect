import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { listHearings } from '@/lib/notices/queries'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Hearing calendar' }

function groupByMonth(hearings: Awaited<ReturnType<typeof listHearings>>) {
  const groups = new Map<string, typeof hearings>()
  for (const h of hearings) {
    const month = h.hearing_date.slice(0, 7)
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month)!.push(h)
  }
  return groups
}

export default async function HearingCalendarPage() {
  const today = new Date().toISOString().slice(0, 10)
  const sixMonths = new Date()
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  const hearings = await listHearings(today, sixMonths.toISOString().slice(0, 10))
  const groups = groupByMonth(hearings)

  return (
    <>
      <PageHeader
        title="Hearing calendar"
        description="All scheduled hearings across your open matters, in date order."
      />

      {hearings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming hearings"
          description="Add hearing dates from a notice's tracker to see them here."
          action={
            <Link href="/notices" className="text-sm underline underline-offset-2">
              Go to notices
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([month, rows]) => (
            <section key={month}>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </h2>
              <ul className="space-y-2">
                {rows.map((h) => {
                  const notice = h.notices
                  const clientName = notice?.clients?.name
                  return (
                    <li key={h.id} className="flex items-start gap-4 rounded-lg border px-4 py-3">
                      <span className="shrink-0 w-20 text-sm tabular-nums font-medium">
                        {new Date(`${h.hearing_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          <Link href={`/notices/${h.notice_id}`} className="hover:underline">
                            {notice?.title ?? 'Unknown matter'}
                          </Link>
                        </p>
                        {clientName && (
                          <p className="text-xs text-muted-foreground">{clientName}</p>
                        )}
                        {h.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{h.notes}</p>
                        )}
                      </div>
                      {h.hearing_date === today && (
                        <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-800">Today</Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
