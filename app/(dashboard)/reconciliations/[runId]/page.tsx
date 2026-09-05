import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getReconciliationRun } from '@/lib/reconciliation/queries'
import { MismatchTable } from '@/components/reconciliation/mismatch-table'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatPaise } from '@/lib/format'

export const metadata: Metadata = { title: 'Reconciliation run' }

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

export default async function ReconciliationRunPage(props: PageProps<'/reconciliations/[runId]'>) {
  const { runId } = await props.params
  const run = await getReconciliationRun(runId)
  if (!run) notFound()

  const period = new Date(run.period_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const unresolvedCount = run.mismatches.filter((m) => m.resolution === 'unresolved').length
  const totalDiff = run.mismatches.reduce((sum, m) => sum + Math.abs(m.difference_paise), 0)

  return (
    <>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/reconciliations" />}>
        <ArrowLeft className="size-4" aria-hidden />
        All runs
      </Button>

      <PageHeader
        title={`${run.client_name} — ${period}`}
        description={`${run.purchase_total} purchase invoices vs ${run.gstr_total} GSTR-2B invoices`}
        action={<StatusBadge status={run.status} />}
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 divide-x">
            <Stat label="Purchase invoices" value={run.purchase_total} />
            <Stat label="GSTR-2B invoices" value={run.gstr_total} />
            <Stat label="Mismatches" value={<span className={run.mismatch_total > 0 ? 'text-red-600' : 'text-green-600'}>{run.mismatch_total}</span>} />
            <Stat label="Total difference" value={totalDiff > 0 ? formatPaise(totalDiff) : '₹0'} />
          </div>
          {unresolvedCount > 0 && (
            <p className="mt-4 text-center text-sm text-amber-700 dark:text-amber-400 border-t pt-4">
              {unresolvedCount} unresolved mismatch{unresolvedCount === 1 ? '' : 'es'} — select rows below to resolve them before filing.
            </p>
          )}
        </CardContent>
      </Card>

      <MismatchTable runId={run.id} mismatches={run.mismatches} />
    </>
  )
}
