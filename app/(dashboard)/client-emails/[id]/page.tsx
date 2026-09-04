import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getClientEmail } from '@/lib/client-emails/queries'
import { ClientEmailDetail } from '@/components/client-emails/email-detail'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

const TOPIC_LABELS: Record<string, string> = {
  deadline_reminder: 'Deadline reminder',
  document_followup: 'Document follow-up',
  fee_reminder: 'Fee reminder',
  custom: 'Custom',
}

export async function generateMetadata(props: PageProps<'/client-emails/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const email = await getClientEmail(id)
  return { title: (email?.edited_subject ?? email?.draft_subject) || 'Client email' }
}

export default async function ClientEmailPage(props: PageProps<'/client-emails/[id]'>) {
  const { id } = await props.params
  const email = await getClientEmail(id)

  // RLS returns nothing for another CA's email, so "not found" and "not
  // yours" are indistinguishable here — which is correct.
  if (!email) notFound()

  return (
    <>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/client-emails" />}>
        <ArrowLeft className="size-4" aria-hidden />
        All client emails
      </Button>

      <PageHeader
        title={(email.edited_subject ?? email.draft_subject) || '(untitled draft)'}
        description={`Drafted ${formatDateTime(email.created_at)}${email.model ? ` · ${email.model}` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{TOPIC_LABELS[email.topic] ?? email.topic}</Badge>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/clients/${email.client_id}`} />}
            >
              {email.clients?.name ?? 'Client'}
            </Button>
          </div>
        }
      />

      <ClientEmailDetail
        emailId={email.id}
        clientId={email.client_id}
        clientEmail={email.clients?.email ?? null}
        topic={email.topic}
        subjectId={email.subject_id}
        notes={email.notes}
        draftSubject={email.draft_subject}
        draftBody={email.draft_body}
        editedSubject={email.edited_subject}
        editedBody={email.edited_body}
        status={email.status}
      />
    </>
  )
}
