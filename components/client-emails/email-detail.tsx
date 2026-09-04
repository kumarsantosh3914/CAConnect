'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, Mail, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { markClientEmailSent, saveClientEmailEdit } from '@/app/(dashboard)/client-emails/actions'
import type { ClientEmailTopic } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function ClientEmailDetail({
  emailId,
  clientId,
  clientEmail,
  topic,
  subjectId,
  notes,
  draftSubject,
  draftBody,
  editedSubject,
  editedBody,
  status,
}: {
  emailId: string
  clientId: string
  clientEmail: string | null
  topic: ClientEmailTopic
  subjectId: string | null
  notes: string | null
  draftSubject: string | null
  draftBody: string | null
  editedSubject: string | null
  editedBody: string | null
  status: string
}) {
  const router = useRouter()
  const [subject, setSubject] = useState(editedSubject ?? draftSubject ?? '')
  const [body, setBody] = useState(editedBody ?? draftBody ?? '')
  const [isSaving, startSave] = useTransition()
  const [isMarking, startMark] = useTransition()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = subject !== (editedSubject ?? draftSubject ?? '') || body !== (editedBody ?? draftBody ?? '')
  const hasEdits = (editedBody !== null && editedBody !== draftBody) || (editedSubject !== null && editedSubject !== draftSubject)

  async function onRegenerate() {
    if (isDirty && !confirm('Regenerating will replace the text below. Continue?')) return

    setError(null)
    setIsRegenerating(true)
    setSubject('')
    setBody('')

    try {
      const response = await fetch('/api/client-emails/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, clientId, topic, subjectId: subjectId ?? undefined, notes: notes ?? undefined }),
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? 'Could not regenerate. Please try again.')
        setSubject(draftSubject ?? '')
        setBody(draftBody ?? '')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const match = accumulated.match(/^Subject:\s*(.*?)(\r?\n\r?\n([\s\S]*))?$/)
        if (match) {
          setSubject(match[1] ?? '')
          setBody(match[3] ?? '')
        } else {
          setBody(accumulated)
        }
      }

      const marker = accumulated.indexOf('\n\n[ERROR] ')
      if (marker !== -1) setError(accumulated.slice(marker + 10))
      router.refresh()
    } catch {
      setError('The connection dropped while drafting. Please try again.')
    } finally {
      setIsRegenerating(false)
    }
  }

  function onSave() {
    startSave(async () => {
      const result = await saveClientEmailEdit(emailId, { subject, body })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Draft saved')
      router.refresh()
    })
  }

  function onMarkSent() {
    startMark(async () => {
      const result = await markClientEmailSent(emailId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Marked as sent')
      router.refresh()
    })
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(body)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  const mailtoHref = clientEmail
    ? `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={isRegenerating} onClick={onRegenerate}>
            {isRegenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            Regenerate
          </Button>
          {hasEdits && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSubject(draftSubject ?? '')
                setBody(draftBody ?? '')
                toast.info('Reverted to the original AI draft')
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Revert to AI draft
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="size-4" aria-hidden />
            Copy
          </Button>
          {mailtoHref && (
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={mailtoHref} />}>
              <Mail className="size-4" aria-hidden />
              Open in email
            </Button>
          )}
          <Button size="sm" disabled={!isDirty || isSaving} onClick={onSave}>
            {isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </Button>
          {status !== 'sent' && (
            <Button size="sm" variant="secondary" disabled={isMarking} onClick={onMarkSent}>
              Mark sent
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {body || isRegenerating ? (
        <div className="space-y-3">
          <Field label="Subject" htmlFor="subject">
            <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={18}
            aria-label="Email body"
          />
          <Alert>
            <AlertDescription className="text-xs">
              AI-drafted — read it before sending. Every fact came from your own records, but the tone
              and phrasing are the model&apos;s; make it sound like you.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No draft was generated for this email.
        </p>
      )}
    </div>
  )
}
