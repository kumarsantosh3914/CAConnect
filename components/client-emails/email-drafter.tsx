'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, Mail, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClientEmail, saveClientEmailEdit } from '@/app/(dashboard)/client-emails/actions'
import type { DeadlineRecord } from '@/lib/deadlines/queries'
import type { DocumentRequestSummary } from '@/lib/documents/queries'
import type { FeeRecord } from '@/lib/fees/queries'
import type { ClientEmailTopic } from '@/types/database'
import { formatDate, formatPaise } from '@/lib/format'
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

type ClientOption = { id: string; name: string; email: string | null }

const TOPIC_LABELS: Record<ClientEmailTopic, string> = {
  deadline_reminder: 'Deadline reminder',
  document_followup: 'Document follow-up',
  fee_reminder: 'Fee reminder',
  custom: 'Something else',
}
const TOPICS = Object.keys(TOPIC_LABELS) as ClientEmailTopic[]

/**
 * The AI Client Email Drafter. Reuses whatever the app already knows about a
 * client — their open deadlines, outstanding document requests, unpaid fees
 * — so the CA never re-types a fact the database already has. "Something
 * else" is the escape hatch for anything not covered by those three.
 */
export function EmailDrafter({
  clients,
  deadlines,
  documentRequests,
  fees,
  defaultClientId,
}: {
  clients: ClientOption[]
  deadlines: DeadlineRecord[]
  documentRequests: DocumentRequestSummary[]
  fees: FeeRecord[]
  /** Pre-selects a client, e.g. when launched from that client's profile page. */
  defaultClientId?: string
}) {
  const router = useRouter()
  const [clientId, setClientId] = useState<string>(defaultClientId ?? '')
  const [topic, setTopic] = useState<ClientEmailTopic | ''>('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [notes, setNotes] = useState('')

  const [emailId, setEmailId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientItems: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name])
  )
  const topicItems: Record<string, string> = TOPIC_LABELS

  // Only the deadlines/requests/fees for the SELECTED client, and only the
  // ones that make sense as a reminder — a paid fee or a completed request
  // has nothing left to remind anyone about.
  const clientDeadlines = useMemo(
    () => deadlines.filter((d) => d.client_id === clientId),
    [deadlines, clientId]
  )
  const clientRequests = useMemo(
    () =>
      documentRequests.filter(
        (r) => r.client_id === clientId && r.status === 'open' && r.required_received < r.required_total
      ),
    [documentRequests, clientId]
  )
  const clientFees = useMemo(
    () => fees.filter((f) => f.client_id === clientId && f.status === 'invoiced'),
    [fees, clientId]
  )

  function onClientChange(next: string) {
    setClientId(next)
    setSubjectId('')
  }
  function onTopicChange(next: ClientEmailTopic) {
    setTopic(next)
    setSubjectId('')
  }

  const selectedClient = clients.find((c) => c.id === clientId)
  const needsSubject = topic === 'deadline_reminder' || topic === 'document_followup' || topic === 'fee_reminder'
  const canGenerate =
    clientId && topic && (topic === 'custom' ? notes.trim().length > 0 : subjectId.length > 0)

  async function onGenerate() {
    setError(null)
    setSubject('')
    setEmailBody('')

    if (!canGenerate || !topic) return

    setIsStreaming(true)
    try {
      const saved = await createClientEmail({
        client_id: clientId,
        topic,
        subject_id: subjectId || undefined,
        notes: notes.trim() || undefined,
      })
      if (!saved.ok) {
        setError(saved.error)
        setIsStreaming(false)
        return
      }
      setEmailId(saved.emailId)

      const response = await fetch('/api/client-emails/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: saved.emailId,
          clientId,
          topic,
          subjectId: subjectId || undefined,
          notes: notes.trim() || undefined,
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
        applyStreamedText(accumulated)
      }

      const marker = accumulated.indexOf('\n\n[ERROR] ')
      if (marker !== -1) {
        setError(accumulated.slice(marker + 10))
        applyStreamedText(accumulated.slice(0, marker))
      }
      router.refresh()
    } catch {
      setError('The connection dropped while drafting. Please try again.')
    } finally {
      setIsStreaming(false)
    }
  }

  /** Splits "Subject: X\n\n<body>" live as it streams in, so the subject
   *  field fills in first the way a person would notice it. */
  function applyStreamedText(text: string) {
    const match = text.match(/^Subject:\s*(.*?)(\r?\n\r?\n([\s\S]*))?$/)
    if (match) {
      setSubject(match[1] ?? '')
      setEmailBody(match[3] ?? '')
    } else {
      setEmailBody(text)
    }
  }

  function onSave() {
    if (!emailId) return
    setIsSaving(true)
    saveClientEmailEdit(emailId, { subject, body: emailBody })
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Draft saved')
        router.refresh()
      })
      .finally(() => setIsSaving(false))
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(emailBody)
      toast.success('Email body copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  const mailtoHref = selectedClient?.email
    ? `mailto:${selectedClient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`
    : null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Client" htmlFor="client_id" required>
          <Select items={clientItems} value={clientId || null} onValueChange={(v) => onClientChange(v as string)}>
            <SelectTrigger id="client_id" className="w-full">
              <SelectValue placeholder="Choose a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClient && !selectedClient.email && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              No email on file for this client — add one to send directly from here.
            </p>
          )}
        </Field>

        <Field label="Topic" htmlFor="topic" required>
          <Select
            items={topicItems}
            value={topic || null}
            onValueChange={(v) => onTopicChange(v as ClientEmailTopic)}
          >
            <SelectTrigger id="topic" className="w-full" disabled={!clientId}>
              <SelectValue placeholder={clientId ? 'Choose a topic' : 'Pick a client first'} />
            </SelectTrigger>
            <SelectContent>
              {TOPICS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TOPIC_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {topic === 'deadline_reminder' && (
          <Field label="Which deadline" htmlFor="subject_id" required>
            {clientDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open deadlines for this client.</p>
            ) : (
              <Select
                items={Object.fromEntries(clientDeadlines.map((d) => [d.id, `${d.label} — ${d.period_label}`]))}
                value={subjectId || null}
                onValueChange={(v) => setSubjectId((v as string) ?? "")}
              >
                <SelectTrigger id="subject_id" className="w-full">
                  <SelectValue placeholder="Choose a deadline" />
                </SelectTrigger>
                <SelectContent>
                  {clientDeadlines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label} — {d.period_label} · due {formatDate(d.due_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}

        {topic === 'document_followup' && (
          <Field label="Which request" htmlFor="subject_id" required>
            {clientRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open document requests with anything still outstanding for this client.
              </p>
            ) : (
              <Select
                items={Object.fromEntries(clientRequests.map((r) => [r.id, r.title]))}
                value={subjectId || null}
                onValueChange={(v) => setSubjectId((v as string) ?? "")}
              >
                <SelectTrigger id="subject_id" className="w-full">
                  <SelectValue placeholder="Choose a request" />
                </SelectTrigger>
                <SelectContent>
                  {clientRequests.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title} — {r.required_received} of {r.required_total} received
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}

        {topic === 'fee_reminder' && (
          <Field label="Which fee" htmlFor="subject_id" required>
            {clientFees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoiced fees outstanding for this client.</p>
            ) : (
              <Select
                items={Object.fromEntries(clientFees.map((f) => [f.id, f.description]))}
                value={subjectId || null}
                onValueChange={(v) => setSubjectId((v as string) ?? "")}
              >
                <SelectTrigger id="subject_id" className="w-full">
                  <SelectValue placeholder="Choose a fee" />
                </SelectTrigger>
                <SelectContent>
                  {clientFees.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.description} — {formatPaise(f.amount_paise)}
                      {f.is_overdue ? ' (overdue)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}

        <Field
          label={topic === 'custom' ? 'What is this email about' : 'Additional notes (optional)'}
          htmlFor="notes"
          required={topic === 'custom'}
          hint={needsSubject ? 'Anything extra the email should mention' : undefined}
        >
          <Textarea
            id="notes"
            rows={topic === 'custom' ? 3 : 2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              topic === 'custom'
                ? 'Requesting an authorisation letter for the GST portal…'
                : 'Mention that the due date was recently extended…'
            }
          />
        </Field>

        <Button onClick={onGenerate} disabled={!canGenerate || isStreaming}>
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {isStreaming ? 'Drafting…' : 'Draft email'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Draft</h2>
          {emailBody && (
            <div className="flex gap-2">
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
              <Button size="sm" disabled={isSaving} onClick={onSave}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        {emailBody || isStreaming ? (
          <div className="space-y-3">
            <Field label="Subject" htmlFor="subject">
              <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </Field>
            <Textarea
              value={emailBody}
              onChange={(event) => setEmailBody(event.target.value)}
              rows={16}
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
          <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <Sparkles className="mb-3 size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Your draft will appear here</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Pick a client and a topic, then hit Draft email.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
