'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createNoticeMatter } from '@/app/(dashboard)/notices/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TYPES = ['ITD scrutiny', 'GST audit', 'Demand', 'Penalty', 'Appeal', 'Other']

export function NewMatterForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [clientId, setClientId] = useState('')
  const [noticeType, setNoticeType] = useState('')
  function submit(form: FormData) {
    void startTransition(async () => {
      const result = await createNoticeMatter({
        client_id: clientId, notice_type: noticeType,
        title: String(form.get('title') ?? ''), notice_date: String(form.get('notice_date') ?? ''),
        response_deadline: String(form.get('response_deadline') ?? ''), amount_in_dispute: String(form.get('amount_in_dispute') ?? ''),
        notes: String(form.get('notes') ?? ''),
      })
      if (!result.ok) { toast.error(result.error); return }
      toast.success('Matter added to the tracker')
      router.push(`/notices/${result.noticeId}`)
    })
  }
  return <form action={submit} className="max-w-xl space-y-4">
    <Field label="Client" htmlFor="client" required><Select items={Object.fromEntries(clients.map((c) => [c.id, c.name]))} value={clientId || null} onValueChange={(v) => setClientId(v ?? '')}><SelectTrigger id="client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Matter title" htmlFor="title" required><Input id="title" name="title" placeholder="FY 2025-26 scrutiny notice" /></Field>
    <Field label="Notice type" htmlFor="notice_type" required><Select items={Object.fromEntries(TYPES.map((type) => [type, type]))} value={noticeType || null} onValueChange={(v) => setNoticeType(v ?? '')}><SelectTrigger id="notice_type"><SelectValue placeholder="Choose type" /></SelectTrigger><SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Notice date" htmlFor="notice_date" required><Input id="notice_date" name="notice_date" type="date" /></Field><Field label="Response deadline" htmlFor="response_deadline"><Input id="response_deadline" name="response_deadline" type="date" /></Field></div>
    <Field label="Amount in dispute (₹)" htmlFor="amount_in_dispute"><Input id="amount_in_dispute" name="amount_in_dispute" inputMode="decimal" placeholder="0.00" /></Field>
    <Field label="Initial note" htmlFor="notes"><Textarea id="notes" name="notes" rows={3} placeholder="What needs attention?" /></Field>
    <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add matter'}</Button>
  </form>
}
