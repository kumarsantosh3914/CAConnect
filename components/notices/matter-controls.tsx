'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { addHearing, saveToNoticeTracker, updateMatterStatus } from '@/app/(dashboard)/notices/actions'
import type { NoticeCaseStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUSES: { value: NoticeCaseStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'response_drafted', label: 'Response drafted' },
  { value: 'response_sent', label: 'Response sent' },
  { value: 'hearing_scheduled', label: 'Hearing scheduled' },
  { value: 'order_received', label: 'Order received' },
  { value: 'closed', label: 'Closed' },
  { value: 'appeal_filed', label: 'Appeal filed' },
  { value: 'appeal_pending', label: 'Appeal pending' },
  { value: 'appeal_order', label: 'Appeal order' },
]

export function MatterControls({ noticeId, tracked, status, canTrack }: { noticeId: string; tracked: boolean; status: NoticeCaseStatus | null; canTrack: boolean }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [next, setNext] = useState<NoticeCaseStatus | null>(status); const [date, setDate] = useState('')
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => startTransition(async () => { const result = await work(); if (!result.ok) { toast.error(result.error ?? 'Could not save changes.'); return; } toast.success(success); router.refresh() })
  if (!tracked) return canTrack ? <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => saveToNoticeTracker(noticeId), 'Added to Notice Tracker')}>Track this matter</Button> : null
  return <div className="flex flex-wrap items-center gap-2"><Select items={Object.fromEntries(STATUSES.map((item) => [item.value, item.label]))} value={next} onValueChange={(value) => setNext(value as NoticeCaseStatus)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Button size="sm" disabled={pending || !next || next === status} onClick={() => next && run(() => updateMatterStatus(noticeId, next), 'Matter status updated')}>Update</Button><Input aria-label="Hearing date" type="date" className="w-40" value={date} onChange={(event) => setDate(event.target.value)} /><Button variant="outline" size="sm" disabled={pending || !date} onClick={() => run(() => addHearing(noticeId, date), 'Hearing added')}>Add hearing</Button></div>
}
