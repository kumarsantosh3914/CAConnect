import type { Metadata } from 'next'
import { Download, FileText, Upload } from 'lucide-react'
import { lookupPortal, type PortalDeadline } from '@/lib/portal/public'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import {
  formatDate,
  formatDueIn,
  formatFileSize,
  formatPaise,
  serviceLabel,
} from '@/lib/format'

export const metadata: Metadata = {
  title: 'Your filings',
  // A client-facing link must never end up in search results.
  robots: { index: false, follow: false },
}

// The portal reflects work the CA does through the day, so it must not be
// served from a cache built when the link was first opened.
export const dynamic = 'force-dynamic'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      {children}
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Secured by CAConnect · This page is private to you
      </p>
    </main>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Overdue is derived, never stored — see the deadlines tracker. */
function deadlineStatus(deadline: PortalDeadline): string {
  const settled = deadline.status === 'filed' || deadline.status === 'done'
  if (settled) return deadline.status
  return new Date(deadline.due_date) < new Date(new Date().toDateString())
    ? 'overdue'
    : deadline.status
}

export default async function ClientPortalPage(props: PageProps<'/portal/[token]'>) {
  const { token } = await props.params
  const result = await lookupPortal(token)

  // A revoked link, a closed client and a token that never existed all land
  // here with the same copy. Telling them apart would confirm a guess.
  if (!result.ok) {
    return (
      <Shell>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">This link is not valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please check the link your CA sent you, or ask them for a new one.
          </p>
        </div>
      </Shell>
    )
  }

  const { portal } = result
  const upcoming = portal.deadlines.filter((d) => d.status !== 'filed' && d.status !== 'done')
  const completed = portal.deadlines.filter((d) => d.status === 'filed' || d.status === 'done')
  const outstandingPaise = portal.fees
    .filter((fee) => fee.status === 'invoiced')
    .reduce((sum, fee) => sum + fee.amount_paise, 0)

  return (
    <Shell>
      <div className="space-y-6">
        <header className="space-y-1">
          {portal.firm_name && (
            <p className="text-sm font-medium text-muted-foreground">
              {portal.firm_name}
              {portal.firm_city ? ` · ${portal.firm_city}` : ''}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{portal.client_name}</h1>
          <p className="text-sm text-muted-foreground">
            Your filings, documents and fees — updated as your CA works on them.
          </p>
        </header>

        {portal.requests.length > 0 && (
          <Section
            title="Your CA needs some documents"
            description="Upload from your phone — no account needed."
          >
            <ul className="space-y-3">
              {portal.requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{request.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.fulfilled} of {request.total} received · link valid until{' '}
                      {formatDate(request.expires_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<a href={`/upload/${request.token}`} />}
                  >
                    <Upload className="size-4" aria-hidden />
                    Upload
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Filings" description="What is due, and what has been filed.">
          {portal.deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled right now. Your CA will add filings as they come up.
            </p>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <ul className="divide-y">
                  {upcoming.map((deadline) => (
                    <li key={deadline.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{deadline.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {serviceLabel(deadline.service_type)} · {deadline.period_label} · due{' '}
                          {formatDate(deadline.due_date)} ({formatDueIn(deadline.due_date)})
                        </p>
                      </div>
                      <StatusBadge status={deadlineStatus(deadline)} />
                    </li>
                  ))}
                </ul>
              )}

              {completed.length > 0 && (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Filed ({completed.length})
                  </summary>
                  <ul className="mt-2 divide-y">
                    {completed.map((deadline) => (
                      <li
                        key={deadline.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{deadline.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {serviceLabel(deadline.service_type)} · {deadline.period_label}
                            {deadline.filed_at ? ` · filed ${formatDate(deadline.filed_at)}` : ''}
                          </p>
                        </div>
                        <StatusBadge status={deadline.status} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </Section>

        <Section title="Documents" description="Everything your CA has on file for you.">
          {portal.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <ul className="divide-y">
              {portal.documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{document.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(document.size_bytes)} · {formatDate(document.created_at)}
                        {document.uploaded_by === 'ca' ? ' · added by your CA' : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    nativeButton={false}
                    render={<a href={`/api/portal/${token}/document/${document.id}`} />}
                  >
                    <Download className="size-4" aria-hidden />
                    <span className="sr-only">Download {document.file_name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Fees">
          {portal.fees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing billed yet.</p>
          ) : (
            <div className="space-y-3">
              {outstandingPaise > 0 && (
                <p className="rounded-md bg-muted p-3 text-sm">
                  <span className="font-medium">{formatPaise(outstandingPaise)}</span> outstanding.
                  Please settle with your CA directly — this page does not take payments.
                </p>
              )}
              <ul className="divide-y">
                {portal.fees.map((fee) => (
                  <li key={fee.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{fee.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fee.service_type ? `${serviceLabel(fee.service_type)} · ` : ''}
                        {fee.status === 'paid'
                          ? `paid ${formatDate(fee.paid_at)}`
                          : fee.due_date
                            ? `due ${formatDate(fee.due_date)}`
                            : 'invoiced'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium">{formatPaise(fee.amount_paise)}</span>
                      <StatusBadge status={fee.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>
    </Shell>
  )
}
