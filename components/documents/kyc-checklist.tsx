'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { reviewKycItem, resendKycLink } from '@/app/(dashboard)/documents/actions'
import type { KycRequestDetail } from '@/lib/documents/queries'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ShareLinkDialog } from './share-link-dialog'

function ItemRow({ requestId, item }: { requestId: string; item: KycRequestDetail['items'][number] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')

  function act(status: 'verified' | 'reupload_requested', actionNote?: string) {
    startTransition(async () => {
      const result = await reviewKycItem(item.id, status, actionNote)
      if (!result.ok) { toast.error(result.error); return }
      toast.success(status === 'verified' ? 'Marked as verified' : 'Re-upload requested')
      setShowNote(false)
      setNote('')
      router.refresh()
    })
  }

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5 shrink-0">
          {item.verification_status === 'verified' ? (
            <CheckCircle2 className="size-4 text-green-600" />
          ) : item.verification_status === 'reupload_requested' ? (
            <XCircle className="size-4 text-red-500" />
          ) : item.fulfilled ? (
            <CheckCircle2 className="size-4 text-blue-500" />
          ) : (
            <span className="block size-4 rounded-full border-2 border-muted-foreground/30" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">
            {item.label}
            {!item.is_required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
          </p>
          {item.verification_note && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.verification_note}</p>
          )}
          {showNote && (
            <div className="flex gap-2 mt-2">
              <Input className="h-7 text-xs" placeholder="Reason for re-upload (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" variant="destructive" className="h-7 text-xs px-2" disabled={pending} onClick={() => act('reupload_requested', note)}>Send</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setShowNote(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={item.verification_status} />
        {item.fulfilled && item.verification_status !== 'verified' && !showNote && (
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Verify" disabled={pending} onClick={() => act('verified')} title="Mark verified">
              <CheckCircle2 className="size-3.5 text-green-600" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Request re-upload" disabled={pending} onClick={() => setShowNote(true)} title="Request re-upload">
              <XCircle className="size-3.5 text-red-500" />
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

export function KycChecklist({ clientId, kyc }: { clientId: string; kyc: KycRequestDetail | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  if (!kyc) {
    return <EmptyState icon={CheckCircle2} title="No KYC request" description="A KYC checklist is created automatically when you add a client. This client was added before that feature shipped." />
  }

  const required = kyc.items.filter((i) => i.is_required)
  const verifiedRequired = required.filter((i) => i.verification_status === 'verified')
  const uploadLink = typeof window !== 'undefined' ? `${window.location.origin}/upload/${kyc.token}` : `/upload/${kyc.token}`

  function onResend() {
    startTransition(async () => {
      const result = await resendKycLink(kyc!.id)
      if (!result.ok) { toast.error(result.error); return }
      setShareUrl(result.url)
      toast.success('KYC link refreshed — share it with your client')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={kyc.status} />
          <span className="text-sm text-muted-foreground">
            {verifiedRequired.length}/{required.length} required documents verified
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={onResend}>
            <RefreshCw className="size-3.5" aria-hidden />
            Resend link
          </Button>
        </div>
      </div>

      {kyc.status === 'open' && (
        <p className="text-xs text-muted-foreground">
          Link expires {formatDate(kyc.expires_at)} · Share it with your client so they can upload.
        </p>
      )}

      <ul className="divide-y rounded-lg border px-4">
        {kyc.items.map((item) => (
          <ItemRow key={item.id} requestId={kyc.id} item={item} />
        ))}
      </ul>

      {shareUrl && (
        <ShareLinkDialog
          url={shareUrl}
          title="KYC upload link"
          clientName=""
          clientPhone={null}
          firmName={null}
          open
          onOpenChange={(open) => { if (!open) setShareUrl(null) }}
          message={`Please use this link to upload your KYC documents: ${shareUrl}`}
        />
      )}
    </div>
  )
}
