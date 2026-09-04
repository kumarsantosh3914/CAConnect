import type { Metadata } from 'next'
import Link from 'next/link'
import { feeTotals, listFees } from '@/lib/fees/queries'
import { listClients } from '@/lib/clients/queries'
import { FeesView, AddFeeButton } from '@/components/fees/fees-view'
import { PageHeader } from '@/components/ui/page-header'
import { formatPaise } from '@/lib/format'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Fees' }

const FILTERS = [
  { key: undefined, label: 'All' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'draft', label: 'Draft' },
] as const

export default async function FeesPage(props: PageProps<'/fees'>) {
  const params = await props.searchParams
  const status = typeof params.status === 'string' ? params.status : undefined

  const [fees, totals, clients] = await Promise.all([
    listFees({ status }),
    feeTotals(),
    listClients(),
  ])

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }))

  return (
    <>
      <PageHeader
        title="Fees"
        description="What you have billed and what has come in."
        action={<AddFeeButton clients={clientOptions} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Collected this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatPaise(totals.collectedThisMonth)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatPaise(totals.outstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Overdue{totals.overdueCount > 0 && ` · ${totals.overdueCount}`}
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold tabular-nums',
              totals.overdue > 0 && 'text-destructive'
            )}
          >
            {formatPaise(totals.overdue)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.key ? `/fees?status=${filter.key}` : '/fees'}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted',
              status === filter.key && 'border-primary bg-muted font-medium'
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <FeesView fees={fees} clients={clientOptions} />
    </>
  )
}
