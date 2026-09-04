'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Link2, RefreshCw, Share2, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  createClientPortal,
  regenerateClientPortal,
  revokeClientPortal,
} from '@/app/(dashboard)/clients/portal-actions'
import { ShareLinkDialog } from '@/components/documents/share-link-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'

export type PortalCardState = {
  url: string
  isActive: boolean
  lastViewedAt: string | null
  viewCount: number
} | null

/**
 * The CA's control panel for one client's portal link.
 *
 * Two things a CA actually asks about a link they sent, both answered here:
 * "did they open it?" and "how do I kill it?". Everything else is share
 * plumbing, reused from the document-request dialog.
 */
export function PortalCard({
  clientId,
  clientName,
  clientPhone,
  firmName,
  portal,
}: {
  clientId: string
  clientName: string
  clientPhone: string | null
  firmName: string | null
  portal: PortalCardState
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // The freshly minted URL from an action, held only until the revalidated
  // server props catch up. It must be cleared whenever the portal stops being
  // active, or a revoked portal keeps rendering its dead link as though it
  // still worked — the one state in this card that must never lie.
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null)

  const url = issuedUrl ?? (portal?.isActive ? portal.url : null)

  const message = [
    `Hello ${clientName},`,
    '',
    'Here is your private link to see your filing status, the documents we have on file, and your fees:',
    url ?? '',
    '',
    'No login needed. Keep the link handy — it stays up to date.',
    '',
    firmName ? `— ${firmName}` : '',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n')

  function run(
    action: () => Promise<{ ok: boolean; error?: string; url?: string }>,
    success: string
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      // A result with no url is a revocation: drop the held link rather than
      // letting it outlive the portal it points at.
      setIssuedUrl(result.url ?? null)
      toast.success(success)
      router.refresh()
    })
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          One permanent link {clientName} can open any time to see their filing status, the
          documents you hold, and their invoiced fees. No login, and it updates itself as you work.
          Drafts, notices and your internal notes are never shown.
        </p>

        {url ? (
          <>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" aria-label="Portal link" />
              <Button variant="outline" size="icon" onClick={() => copy(url)}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span className="sr-only">Copy portal link</span>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShareOpen(true)}>
                <Share2 className="size-4" aria-hidden />
                Send to {clientName.split(' ')[0]}
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={url} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink className="size-4" aria-hidden />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => regenerateClientPortal(clientId), 'New link created. The old one no longer works.')
                }
              >
                <RefreshCw className="size-4" aria-hidden />
                New link
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(() => revokeClientPortal(clientId), 'Portal turned off.')}
              >
                <ShieldOff className="size-4" aria-hidden />
                Turn off
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {portal && portal.viewCount > 0
                ? `Opened ${portal.viewCount} ${portal.viewCount === 1 ? 'time' : 'times'} · last on ${formatDateTime(portal.lastViewedAt)}`
                : 'Not opened yet.'}
            </p>

            <ShareLinkDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              url={url}
              clientName={clientName}
              clientPhone={clientPhone}
              title="your filing status"
              firmName={firmName}
              message={message}
              description="A permanent link they can open any time — no account, no app."
            />
          </>
        ) : (
          <div className="space-y-3">
            {portal && !portal.isActive && (
              <p className="text-sm text-muted-foreground">
                This client&apos;s portal is turned off. Creating a new one issues a fresh link —
                the old one stays dead.
              </p>
            )}
            <Button
              disabled={pending}
              onClick={() => run(() => createClientPortal(clientId), 'Portal link created.')}
            >
              <Link2 className="size-4" aria-hidden />
              {portal && !portal.isActive ? 'Create a new link' : 'Create portal link'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
