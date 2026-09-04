import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { listClientEmails } from '@/lib/client-emails/queries'
import { ClientEmailList } from '@/components/client-emails/email-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Client Emails' }

export default async function ClientEmailsPage() {
  const emails = await listClientEmails()

  return (
    <>
      <PageHeader
        title="Client Emails"
        description="AI-drafted updates and reminders for your clients."
        action={
          <Button nativeButton={false} render={<Link href="/client-emails/new" />}>
            <Sparkles className="size-4" aria-hidden />
            Draft an email
          </Button>
        }
      />
      <ClientEmailList emails={emails} />
    </>
  )
}
