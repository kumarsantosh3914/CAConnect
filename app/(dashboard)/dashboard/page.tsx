import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, FileText, Receipt, Sparkles, Users } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bucketDeadlines, listDeadlines } from '@/lib/deadlines/queries'
import { feeTotals } from '@/lib/fees/queries'
import { listDocuments } from '@/lib/documents/queries'
import { listClients } from '@/lib/clients/queries'
import { RequestDocumentsButton } from '@/components/documents/request-documents-button'
import { AddFeeButton } from '@/components/fees/fees-view'
import { formatDateTime, formatPaise } from '@/lib/format'
import { DeadlineBuckets } from '@/components/deadlines/deadline-buckets'
import { AddClientButton } from '@/components/clients/add-client-button'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Dashboard' }

function StatCard({
  label,
  value,
  href,
  tone = 'default',
  icon: Icon,
}: {
  label: string
  value: number
  href: string
  tone?: 'default' | 'alert'
  icon: typeof Users
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <div
        className={
          tone === 'alert' && value > 0
            ? 'mt-1 text-3xl font-semibold text-destructive'
            : 'mt-1 text-3xl font-semibold'
        }
      >
        {value}
      </div>
    </Link>
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ count: clientCount }, deadlines, totals, documents, clients, { data: profile }] =
    await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).is('archived_at', null),
      listDeadlines(),
      feeTotals(),
      listDocuments(),
      listClients(),
      supabase.from('profiles').select('firm_name,onboarded_at').eq('id', user.id).maybeSingle(),
    ])

  // A CA who has never been through setup starts there, not on empty tiles.
  if (!profile?.onboarded_at && (clientCount ?? 0) === 0) redirect('/onboarding')

  const buckets = bucketDeadlines(deadlines)
  const overdue = buckets[0].deadlines.length
  const thisWeek = buckets[1].deadlines.length

  // The morning view: what will bite today, not a full calendar.
  const urgent = buckets.filter((bucket) => bucket.key === 'overdue' || bucket.key === 'this_week')
  const hasClients = (clientCount ?? 0) > 0

  return (
    <>
      <PageHeader
        title={profile?.firm_name ? `Good morning, ${profile.firm_name}` : 'Dashboard'}
        description="What needs your attention today."
        action={
          hasClients ? (
            // Quick-add shortcuts, per the vision doc's dashboard spec: the
            // four things a CA starts from a cold open.
            <div className="flex flex-wrap gap-2">
              <AddClientButton />
              <RequestDocumentsButton
                clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
                firmName={profile?.firm_name ?? null}
                label="Request docs"
              />
              <AddFeeButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
              <Button variant="outline" nativeButton={false} render={<Link href="/notices/new" />}>
                <Sparkles className="size-4" aria-hidden />
                Draft a notice reply
              </Button>
            </div>
          ) : undefined
        }
      />

      {!hasClients ? (
        <EmptyState
          icon={Users}
          title="Let’s get your practice set up"
          description="Add your first client and their compliance deadlines fill in automatically — ITR, GST, TDS and ROC dates, already known."
          action={<AddClientButton label="Add your first client" />}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Overdue filings"
              value={overdue}
              href="/deadlines"
              tone="alert"
              icon={AlertTriangle}
            />
            <StatCard label="Due in 7 days" value={thisWeek} href="/deadlines" icon={CalendarClock} />
            <StatCard label="Clients" value={clientCount ?? 0} href="/clients" icon={Users} />
            <Link href="/fees?status=overdue" className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Receipt className="size-4" aria-hidden />
                Fees overdue
              </div>
              <div
                className={
                  totals.overdue > 0
                    ? 'mt-1 text-3xl font-semibold text-destructive'
                    : 'mt-1 text-3xl font-semibold'
                }
              >
                {formatPaise(totals.overdue)}
              </div>
            </Link>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Needs attention</h2>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/deadlines" />}>
                View all deadlines
              </Button>
            </div>
            <DeadlineBuckets
              buckets={urgent}
              emptyTitle="Nothing due this week"
              emptyDescription="No overdue filings and nothing due in the next 7 days."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Recent documents</h2>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/documents" />}>
                View all documents
              </Button>
            </div>
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Send a client an upload link and their files land here."
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {documents.slice(0, 5).map((document) => (
                  <li key={document.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{document.file_name}</p>
                      <Link
                        href={`/clients/${document.client_id}`}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {document.client_name}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(document.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  )
}
