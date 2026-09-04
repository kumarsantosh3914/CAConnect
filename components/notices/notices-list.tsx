'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Scale, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteNotice } from '@/app/(dashboard)/notices/actions'
import type { NoticeSummary } from '@/lib/notices/queries'
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

export function NoticesList({
  notices,
  showClient = true,
}: {
  notices: NoticeSummary[]
  showClient?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onDelete(notice: NoticeSummary) {
    startTransition(async () => {
      const result = await deleteNotice(notice.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Notice removed')
      router.refresh()
    })
  }

  if (notices.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No notices yet"
        description="Paste an IT or GST notice and get a formal draft reply in under 30 seconds."
        action={
          <Button nativeButton={false} render={<Link href="/notices/new" />}>
            Draft a reply
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
            <TableHead>Notice</TableHead>
            {showClient && <TableHead className="hidden sm:table-cell">Client</TableHead>}
            <TableHead className="hidden md:table-cell">Drafted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {notices.map((notice) => (
            <TableRow key={notice.id}>
              <TableCell>
                <Link href={`/notices/${notice.id}`} className="font-medium hover:underline">
                  {notice.title}
                </Link>
                {notice.notice_type && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {notice.notice_type.split('—')[0].trim()}
                  </Badge>
                )}
              </TableCell>
              {showClient && (
                <TableCell className="hidden sm:table-cell text-sm">
                  {notice.client_id ? (
                    <Link href={`/clients/${notice.client_id}`} className="hover:underline">
                      {notice.client_name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {formatDateTime(notice.created_at)}
              </TableCell>
              <TableCell>
                <StatusBadge status={notice.has_draft ? notice.status : 'pending'} />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => onDelete(notice)}
                  aria-label={`Remove ${notice.title}`}
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
