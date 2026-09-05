'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { saveNoticeEdit } from '@/app/(dashboard)/notices/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MatterControls } from './matter-controls'
import type { NoticeCaseStatus } from '@/types/database'
import type { NoticeHearing, NoticeEvent } from '@/lib/notices/queries'
import { formatDate, statusLabel } from '@/lib/format'

export function NoticeDetail({
  noticeId,
  title,
  noticeText,
  noticeType,
  clientId,
  draftResponse,
  editedResponse,
  trackerEnabled,
  caseStatus,
  hearings = [],
  events = [],
}: {
  noticeId: string
  title: string
  noticeText: string | null
  noticeType: string | null
  clientId: string | null
  draftResponse: string | null
  editedResponse: string | null
  trackerEnabled: boolean
  caseStatus: NoticeCaseStatus | null
  hearings?: NoticeHearing[]
  events?: NoticeEvent[]
}) {
  const router = useRouter()
  // The CA's edits live in their own column, so the original AI draft is never
  // overwritten and "revert" always has something to go back to.
  const [text, setText] = useState(editedResponse ?? draftResponse ?? '')
  const [isSaving, startSave] = useTransition()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = text !== (editedResponse ?? draftResponse ?? '')
  const hasEdits = editedResponse !== null && editedResponse !== draftResponse

  /**
   * Re-runs the drafter against the stored notice text.
   *
   * The prompt is iterated as real notices come back from CAs, so a draft
   * generated last month is not what today's prompt would produce. Without
   * this the CA has to re-paste the whole notice to benefit.
   */
  async function onRegenerate() {
    if (isDirty && !confirm('Regenerating will replace the text below. Continue?')) return

    setError(null)
    setIsRegenerating(true)
    setText('')

    try {
      const response = await fetch('/api/notices/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeId,
          noticeText,
          noticeType: noticeType ?? undefined,
          clientId: clientId ?? undefined,
        }),
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? 'Could not regenerate the draft. Please try again.')
        setText(editedResponse ?? draftResponse ?? '')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setText(accumulated)
      }

      // Mid-stream failures arrive in the body, not the status code.
      const marker = accumulated.indexOf('\n\n[ERROR] ')
      if (marker !== -1) {
        setError(accumulated.slice(marker + 10))
        setText(accumulated.slice(0, marker))
      }
      router.refresh()
    } catch {
      setError('The connection dropped while drafting. Please try again.')
      setText(editedResponse ?? draftResponse ?? '')
    } finally {
      setIsRegenerating(false)
    }
  }

  function onSave() {
    startSave(async () => {
      const result = await saveNoticeEdit(noticeId, text)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Draft saved')
      router.refresh()
    })
  }

  function onRevert() {
    setText(draftResponse ?? '')
    toast.info('Reverted to the original AI draft')
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  function onDownload() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[^\w.-]+/g, '-')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <Tabs defaultValue="draft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="draft">Draft reply</TabsTrigger>
          <TabsTrigger value="notice">Original notice</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-2">
          {hasEdits && (
            <Button variant="outline" size="sm" onClick={onRevert}>
              <RotateCcw className="size-4" aria-hidden />
              Revert to AI draft
            </Button>
          )}
          {noticeText && <Button
            variant="outline"
            size="sm"
            disabled={isRegenerating}
            onClick={onRegenerate}
          >
            {isRegenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {isRegenerating ? 'Drafting…' : 'Regenerate'}
          </Button>}
          <MatterControls noticeId={noticeId} tracked={trackerEnabled} status={caseStatus} canTrack={Boolean(clientId)} />
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="size-4" aria-hidden />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="size-4" aria-hidden />
            .txt
          </Button>
          <Button size="sm" disabled={!isDirty || isSaving} onClick={onSave}>
            {isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <TabsContent value="draft" className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {draftResponse || isRegenerating ? (
          <>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={30}
              className="font-mono text-xs leading-relaxed"
              aria-label="Draft reply"
            />
            <Alert>
              <AlertDescription className="text-xs">
                <strong>AI-generated draft — review before sending.</strong> Check every figure,
                date and section reference against the notice. Placeholders in [square brackets]
                need your input. This is a drafting aid, not a legal opinion — you remain
                professionally responsible for what you file.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No draft was generated for this notice.
          </p>
        )}
      </TabsContent>

      <TabsContent value="notice">
        <pre className="max-h-[70svh] overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {noticeText ?? 'No source text was attached to this manually created matter.'}
        </pre>
      </TabsContent>
    </Tabs>

    {trackerEnabled && (hearings.length > 0 || events.length > 0) && (
      <div className="space-y-3">
        {hearings.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Hearing dates</h3>
            <ul className="space-y-1">
              {hearings.map((h) => (
                <li key={h.id} className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm">
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{formatDate(h.hearing_date)}</span>
                  {h.notes && <span className="text-muted-foreground">{h.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {events.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Activity log</h3>
            <ol className="space-y-1">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums pt-0.5">{formatDate(e.created_at)}</span>
                  <span>
                    {e.event_type === 'status_change' ? (
                      <span>
                        Status changed{e.from_status ? ` from ${statusLabel(e.from_status)}` : ''} to <strong>{statusLabel(e.to_status ?? '')}</strong>
                      </span>
                    ) : (
                      e.body
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    )}
    </>
  )
}
