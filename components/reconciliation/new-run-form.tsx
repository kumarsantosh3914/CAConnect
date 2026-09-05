'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createReconciliationRun } from '@/app/(dashboard)/reconciliations/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileInput } from '@/components/ui/file-input'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState } from 'react'

export function NewRunForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set('client_id', clientId)
    startTransition(async () => {
      const result = await createReconciliationRun(formData)
      if (!result.ok) { setError(result.error); return }
      toast.success('Reconciliation complete — review the mismatches below.')
      router.push(`/reconciliations/${result.runId}`)
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Field label="Client" htmlFor="client" required>
        <Select value={clientId || null} onValueChange={(v) => setClientId(v ?? '')}>
          <SelectTrigger id="client" className="w-full">
            <SelectValue placeholder="Select a client">
              {clientId ? clients.find((c) => c.id === clientId)?.name : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Month" htmlFor="period_month" required hint="The GST return period, e.g. 2025-06">
        <Input id="period_month" name="period_month" type="month" className="w-full" required />
      </Field>
      <Field label="Purchase register" htmlFor="purchase_register" required hint="CSV with columns: supplier_gstin, invoice_number, invoice_date, invoice_amount">
        <FileInput id="purchase_register" name="purchase_register" accept=".csv,text/csv" required />
      </Field>
      <Field label="GSTR-2B JSON" htmlFor="gstr_2b" required hint="Download from the GST portal → Returns → GSTR-2B → Download JSON">
        <FileInput id="gstr_2b" name="gstr_2b" accept=".json,application/json" required />
      </Field>
      <Button type="submit" disabled={pending || !clientId}>
        {pending ? 'Running reconciliation…' : 'Run reconciliation'}
      </Button>
    </form>
  )
}
