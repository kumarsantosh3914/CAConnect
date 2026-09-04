'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteClientEmail } from '@/app/(dashboard)/client-emails/actions'
import type { ClientEmailSummary } from '@/lib/client-emails/queries'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const TOPIC_LABELS: Record<string, string> = {
  deadline_reminder: 'Deadline',
  document_followup: 'Documents',
  fee_reminder: 'Fee',
  custom: 'Custom',
}

export function ClientEmailList({
  emails,
  showClient = true,
}: {
  emails: ClientEmailSummary[]
  showClient?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onDelete(email: ClientEmailSummary) {
    startTransition(async () => {
      const result = await deleteClientEmail(email.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Email removed')
      router.refresh()
    })
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No client emails yet"
        description="Pick a client and a topic, and let AI draft the note for you."
        action={
          <Button nativeButton={false} render={<Link href="/client-emails/new" />}>
            Draft an email
          </Button>
        }
      />
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            {showClient && <TableHead className="hidden sm:table-cell">Client</TableHead>}
            <TableHead className="hidden md:table-cell">Drafted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email) => (
            <TableRow key={email.id}>
              <TableCell>
                <Link href={`/client-emails/${email.id}`} className="font-medium hover:underline">
                  {email.subject || '(untitled draft)'}
                </Link>
                <Badge variant="outline" className="ml-2 text-xs">
                  {TOPIC_LABELS[email.topic] ?? email.topic}
                </Badge>
              </TableCell>
              {showClient && (
                <TableCell className="hidden sm:table-cell text-sm">
                  <Link href={`/clients/${email.client_id}`} className="hover:underline">
                    {email.client_name}
                  </Link>
                </TableCell>
              )}
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {formatDateTime(email.created_at)}
              </TableCell>
              <TableCell>
                <StatusBadge status={email.has_draft ? email.status : 'pending'} />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => onDelete(email)}
                  aria-label={`Remove ${email.subject ?? 'this email'}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
