import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { listClients } from '@/lib/clients/queries'
import { listDeadlines } from '@/lib/deadlines/queries'
import { listDocumentRequests } from '@/lib/documents/queries'
import { listFees } from '@/lib/fees/queries'
import { EmailDrafter } from '@/components/client-emails/email-drafter'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Draft a client email' }

export default async function NewClientEmailPage(props: PageProps<'/client-emails/new'>) {
  const params = await props.searchParams
  const requestedClientId = typeof params.client === 'string' ? params.client : undefined
  // Pre-fetch across every client so switching the client picker in the
  // drafter needs no round trip — comfortable at the client-list sizes this
  // product targets (20-150 clients per the vision doc's personas).
  const [clients, deadlines, documentRequests, fees] = await Promise.all([
    listClients(),
    listDeadlines({ includeCompleted: false }),
    listDocumentRequests(),
    listFees(),
  ])

  // Only trust the query param if it actually names one of this CA's own
  // clients — RLS already narrowed `clients` to that set.
  const defaultClientId = clients.some((c) => c.id === requestedClientId)
    ? requestedClientId
    : undefined

  return (
    <>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/client-emails" />}>
        <ArrowLeft className="size-4" aria-hidden />
        All client emails
      </Button>
      <PageHeader
        title="Draft a client email"
        description="Pick a client and a topic — the facts come from your own records."
      />
      <EmailDrafter
        clients={clients.map((c) => ({ id: c.id, name: c.name, email: c.email }))}
        deadlines={deadlines}
        documentRequests={documentRequests}
        fees={fees}
        defaultClientId={defaultClientId}
      />
    </>
  )
}
