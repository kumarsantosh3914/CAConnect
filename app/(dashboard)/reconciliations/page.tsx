import type { Metadata } from 'next'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { listClients } from '@/lib/clients/queries'
import { listReconciliationRuns } from '@/lib/reconciliation/queries'
import { NewRunForm } from '@/components/reconciliation/new-run-form'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'

export const metadata: Metadata = { title: 'GST Reconciliation' }

export default async function ReconciliationsPage() {
  const [clients, runs] = await Promise.all([listClients(), listReconciliationRuns()])
  const activeClients = clients

  return (
    <>
      <PageHeader
        title="GST Reconciliation"
        description="Compare purchase registers against GSTR-2B and resolve mismatches before filing."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">New reconciliation</CardTitle></CardHeader>
          <CardContent>
            <NewRunForm clients={activeClients.map((c) => ({ id: c.id, name: c.name }))} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Past runs</h2>
          {runs.length === 0 ? (
            <EmptyState icon={Scale} title="No reconciliations yet" description="Upload a purchase register and GSTR-2B to run your first comparison." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Mismatches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Run on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link href={`/reconciliations/${run.id}`} className="font-medium hover:underline">
                          {run.client_name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {new Date(run.period_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums">
                        {run.mismatch_total > 0 ? (
                          <span className="text-red-600 font-medium">{run.mismatch_total}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(run.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
