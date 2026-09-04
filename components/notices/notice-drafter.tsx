'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, FileUp, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createNotice, extractNoticePdf, saveNoticeEdit } from '@/app/(dashboard)/notices/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NO_CLIENT = 'none'

// The notices a small firm actually sees, in rough order of frequency.
const NOTICE_TYPES = [
  'Section 139(9) — Defective return',
  'Section 143(1)(a) — Proposed adjustment',
  'Section 143(2) — Scrutiny',
  'Section 142(1) — Call for information',
  'Section 148 / 148A — Reassessment',
  'Section 156 — Demand notice',
  'Section 245 — Refund adjustment',
  'GST ASMT-10 — Scrutiny of returns',
  'Other',
]

export function NoticeDrafter({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [noticeType, setNoticeType] = useState<string>('')
  const [clientId, setClientId] = useState<string>(NO_CLIENT)
  const [noticeText, setNoticeText] = useState('')
  const [source, setSource] = useState<'paste' | 'pdf'>('paste')

  const [draft, setDraft] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [noticeId, setNoticeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExtracting, startExtract] = useTransition()
  const [isSaving, startSave] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const clientItems: Record<string, string> = {
    [NO_CLIENT]: 'Not linked to a client',
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  }
  const typeItems: Record<string, string> = Object.fromEntries(NOTICE_TYPES.map((t) => [t, t]))

  function onPickPdf(file: File | undefined) {
    if (!file) return
    startExtract(async () => {
      const body = new FormData()
      body.append('file', file)
      const result = await extractNoticePdf(body)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setNoticeText(result.text)
      setSource('pdf')
      if (!title) setTitle(file.name.replace(/\.pdf$/i, ''))
      toast.success('Text extracted from the PDF')
    })
  }

  async function onGenerate() {
    setError(null)
    setDraft('')

    if (noticeText.trim().length < 120) {
      setError('Paste the full notice text — there is not enough here to work from.')
      return
    }

    setIsStreaming(true)
    try {
      const saved = await createNotice({
        title: title.trim() || 'Untitled notice',
        notice_type: noticeType || undefined,
        notice_text: noticeText,
        client_id: clientId === NO_CLIENT ? undefined : clientId,
        source,
      })
      if (!saved.ok) {
        setError(saved.error)
        setIsStreaming(false)
        return
      }
      setNoticeId(saved.noticeId)

      const response = await fetch('/api/notices/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeId: saved.noticeId,
          noticeText,
          noticeType: noticeType || undefined,
          clientId: clientId === NO_CLIENT ? undefined : clientId,
        }),
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? 'Could not generate a draft. Please try again.')
        setIsStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setDraft(accumulated)
      }

      // Errors that happen mid-stream arrive in the body, not the status.
      const marker = accumulated.indexOf('\n\n[ERROR] ')
      if (marker !== -1) {
        setError(accumulated.slice(marker + 10))
        setDraft(accumulated.slice(0, marker))
      }
      router.refresh()
    } catch {
      setError('The connection dropped while drafting. Please try again.')
    } finally {
      setIsStreaming(false)
    }
  }

  function onSaveEdits() {
    if (!noticeId) return
    startSave(async () => {
      const result = await saveNoticeEdit(noticeId, draft)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Draft saved')
      router.refresh()
    })
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(draft)
      toast.success('Draft copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  function onDownload() {
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(title || 'notice-reply').replace(/[^\w.-]+/g, '-')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Title" htmlFor="title">
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="143(2) scrutiny — Ramesh Traders"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notice type" htmlFor="notice_type">
            <Select items={typeItems} value={noticeType || null} onValueChange={(v) => setNoticeType(v as string)}>
              <SelectTrigger id="notice_type" className="w-full">
                <SelectValue placeholder="Identify from the notice" />
              </SelectTrigger>
              <SelectContent>
                {NOTICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Client" htmlFor="client_id" hint="Keeps this on their record">
            <Select items={clientItems} value={clientId} onValueChange={(v) => setClientId(v as string)}>
              <SelectTrigger id="client_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLIENT}>Not linked to a client</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Notice text"
          htmlFor="notice_text"
          required
          hint={`${noticeText.length.toLocaleString('en-IN')} characters`}
        >
          <Textarea
            id="notice_text"
            value={noticeText}
            onChange={(event) => {
              setNoticeText(event.target.value)
              setSource('paste')
            }}
            rows={14}
            placeholder="Paste the full text of the notice here…"
            className="font-mono text-xs"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onGenerate} disabled={isStreaming || isExtracting}>
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {isStreaming ? 'Drafting…' : 'Draft response'}
          </Button>

          <Button
            variant="outline"
            disabled={isExtracting || isStreaming}
            onClick={() => fileRef.current?.click()}
          >
            {isExtracting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileUp className="size-4" aria-hidden />
            )}
            Upload PDF
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            aria-label="Upload notice PDF"
            onChange={(event) => {
              onPickPdf(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Draft reply</h2>
          {draft && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCopy}>
                <Copy className="size-4" aria-hidden />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={onDownload}>
                <Download className="size-4" aria-hidden />
                .txt
              </Button>
              <Button size="sm" disabled={isSaving} onClick={onSaveEdits}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        {draft ? (
          <>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={26}
              className="font-mono text-xs"
              aria-label="Draft reply"
            />
            {/*
              The vision doc rates "AI gives wrong legal advice" as the highest
              severity risk. This is the mitigation, and it is not optional.
            */}
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
          <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <Sparkles className="mb-3 size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Your draft will appear here</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Paste a notice or upload the PDF, then hit Draft response. Usually takes under 30
              seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
