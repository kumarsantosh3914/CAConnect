'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { resolveMismatches } from '@/app/(dashboard)/reconciliations/actions'
import type { ReconciliationMismatch } from '@/lib/reconciliation/queries'
import type { ReconciliationResolution } from '@/types/database'
import { formatPaise } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { CheckCircle2 } from 'lucide-react'

const MATCH_LABELS: Record<string, string> = {
  purchase_only: 'In purchases only',
  gstr_only: 'In GSTR-2B only',
  amount_mismatch: 'Amount mismatch',
}

const RESOLUTIONS: { value: ReconciliationResolution; label: string }[] = [
  { value: 'follow_up_supplier', label: 'Follow up with supplier' },
  { value: 'accepted_difference', label: 'Accept the difference' },
  { value: 'resolved', label: 'Mark resolved' },
]

export function MismatchTable({ runId, mismatches }: { runId: string; mismatches: ReconciliationMismatch[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resolution, setResolution] = useState<ReconciliationResolution>('follow_up_supplier')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const unresolved = mismatches.filter((m) => m.resolution === 'unresolved')
  const allUnresolvedIds = unresolved.map((m) => m.id)
  const allSelected = allUnresolvedIds.length > 0 && allUnresolvedIds.every((id) => selected.has(id))

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allUnresolvedIds))
  }

  function onResolve() {
    if (!selected.size) return
    startTransition(async () => {
      const result = await resolveMismatches(runId, [...selected], resolution, note)
      if (!result.ok) { toast.error(result.error); return }
      toast.success(`${selected.size} row${selected.size === 1 ? '' : 's'} marked as ${RESOLUTIONS.find((r) => r.value === resolution)?.label.toLowerCase()}`)
      setSelected(new Set())
      setNote('')
      router.refresh()
    })
  }

  if (mismatches.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No mismatches" description="Every invoice in the purchase register matches the GSTR-2B. You're clear to file." />
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <span className="text-sm font-medium">{selected.size} row{selected.size === 1 ? '' : 's'} selected</span>
          <Select value={resolution} onValueChange={(v) => setResolution(v as ReconciliationResolution)} items={Object.fromEntries(RESOLUTIONS.map((r) => [r.value, r.label]))}>
            <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{RESOLUTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-8 w-48" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={pending} onClick={onResolve}>{pending ? 'Saving…' : 'Apply'}</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all unresolved" />
              </TableHead>
              <TableHead>Supplier GSTIN</TableHead>
              <TableHead>Invoice no.</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Purchase ₹</TableHead>
              <TableHead className="hidden sm:table-cell text-right">GSTR-2B ₹</TableHead>
              <TableHead className="text-right">Diff ₹</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mismatches.map((row) => (
              <TableRow key={row.id} data-state={selected.has(row.id) ? 'selected' : undefined}>
                <TableCell>
                  {row.resolution === 'unresolved' && (
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Select ${row.invoice_number}`} />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.supplier_gstin}</TableCell>
                <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{row.invoice_date ?? '—'}</TableCell>
                <TableCell className="hidden sm:table-cell text-right text-sm tabular-nums">
                  {row.purchase_amount_paise !== null ? formatPaise(row.purchase_amount_paise) : '—'}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right text-sm tabular-nums">
                  {row.gstr_amount_paise !== null ? formatPaise(row.gstr_amount_paise) : '—'}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium">
                  {formatPaise(Math.abs(row.difference_paise))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">{MATCH_LABELS[row.match_type]}</Badge>
                </TableCell>
                <TableCell><StatusBadge status={row.resolution} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
