'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, FileText, Inbox, Link2, Share2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { expireDocumentRequest, getDocumentUrl } from '@/app/(dashboard)/documents/actions'
import { ShareLinkDialog } from './share-link-dialog'
import type { DocumentRequestSummary, DocumentSummary } from '@/lib/documents/queries'
import { formatDate, formatDateTime, formatFileSize } from '@/lib/format'
import { Button } from '@/components/ui/button'
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

export function DocumentRequestList({
  requests,
  showClient = true,
  firmName = null,
}: {
  requests: DocumentRequestSummary[]
  showClient?: boolean
  firmName?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Re-share an existing link. Without this the URL is only ever visible in
  // the dialog shown at creation — close it and the CA cannot resend.
  const [sharing, setSharing] = useState<DocumentRequestSummary | null>(null)

  function onExpire(request: DocumentRequestSummary) {
    startTransition(async () => {
      const result = await expireDocumentRequest(request.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Link closed')
      router.refresh()
    })
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No document requests yet"
        description="Create a checklist and send your client a link — they upload from their phone, no login."
      />
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            {showClient && <TableHead className="hidden sm:table-cell">Client</TableHead>}
            <TableHead>Received</TableHead>
            <TableHead className="hidden md:table-cell">Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">{request.title}</TableCell>
              {showClient && (
                <TableCell className="hidden sm:table-cell">
                  <Link href={`/clients/${request.client_id}`} className="hover:underline">
                    {request.client_name}
                  </Link>
                </TableCell>
              )}
              <TableCell className="text-sm text-muted-foreground">
                {request.required_received} of {request.required_total}
                {request.files_received > request.required_received && (
                  <span className="ml-1 text-xs">(+{request.files_received - request.required_received})</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {formatDate(request.expires_at)}
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {request.status === 'open' && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSharing(request)}
                        aria-label={`Share link for ${request.title}`}
                      >
                        <Share2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={() => onExpire(request)}
                        aria-label={`Close link for ${request.title}`}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sharing && (
        <ShareLinkDialog
          open
          onOpenChange={(next) => !next && setSharing(null)}
          // Built in the browser from the domain the CA is actually on, so a
          // re-shared link can never carry a stale origin.
          url={`${window.location.origin}/upload/${sharing.token}`}
          title={sharing.title}
          clientName={sharing.client_name}
          clientPhone={sharing.client_phone}
          firmName={firmName}
        />
      )}
    </div>
  )
}

export function DocumentList({
  documents,
  showClient = true,
}: {
  documents: DocumentSummary[]
  showClient?: boolean
}) {
  const [opening, setOpening] = useState<string | null>(null)

  async function open(document: DocumentSummary) {
    setOpening(document.id)
    const result = await getDocumentUrl(document.id)
    setOpening(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    // Signed URL, valid 5 minutes — the bucket itself stays private.
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No documents yet"
        description="Files your clients upload will appear here, organised by client."
      />
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            {showClient && <TableHead className="hidden sm:table-cell">Client</TableHead>}
            <TableHead className="hidden md:table-cell">Request</TableHead>
            <TableHead className="hidden sm:table-cell">Size</TableHead>
            <TableHead>Received</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell>
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{document.file_name}</span>
                </span>
              </TableCell>
              {showClient && (
                <TableCell className="hidden sm:table-cell">
                  <Link href={`/clients/${document.client_id}`} className="hover:underline">
                    {document.client_name}
                  </Link>
                </TableCell>
              )}
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {document.request_title ?? '—'}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                {formatFileSize(document.size_bytes)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(document.created_at)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={opening === document.id}
                  onClick={() => open(document)}
                  aria-label={`Open ${document.file_name}`}
                >
                  <Download className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
