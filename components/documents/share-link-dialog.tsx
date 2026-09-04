'use client'

import { useState } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * The share step. India runs on WhatsApp, so the primary action is a
 * prefilled wa.me message, not a copy button the CA has to paste somewhere.
 * This is the "send a document link over WhatsApp" milestone from the build
 * plan, and it has to be one tap.
 */
export function ShareLinkDialog({
  open,
  onOpenChange,
  url,
  clientName,
  clientPhone,
  title,
  firmName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  clientName: string
  clientPhone: string | null
  title: string
  firmName: string | null
}) {
  const [copied, setCopied] = useState(false)

  const message = [
    `Hello ${clientName},`,
    '',
    `Please upload the documents for ${title} using this secure link:`,
    url,
    '',
    'No login needed — you can upload straight from your phone.',
    '',
    firmName ? `— ${firmName}` : '',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n')

  // wa.me wants a bare international number. Indian mobiles are 10 digits;
  // prefix 91 when the CA stored it without a country code.
  const digits = (clientPhone ?? '').replace(/\D/g, '')
  const waNumber = digits.length === 10 ? `91${digits}` : digits
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send this to {clientName}</DialogTitle>
          <DialogDescription>
            They can upload from their phone — no account, no app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            className="w-full"
            nativeButton={false}
            render={<a href={waHref} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle className="size-4" aria-hidden />
            {waNumber ? 'Send on WhatsApp' : 'Open WhatsApp'}
          </Button>

          {!waNumber && (
            <p className="text-xs text-muted-foreground">
              No phone number saved for {clientName} — add one to their profile and this will go
              straight to their chat.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Or copy the link</p>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" aria-label="Upload link" />
              <Button variant="outline" size="icon" onClick={() => copy(url, 'Link')}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span className="sr-only">Copy link</span>
              </Button>
            </div>
          </div>

          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Preview the message</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted-foreground">
              {message}
            </pre>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
