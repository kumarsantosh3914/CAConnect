'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { saveFee } from '@/app/(dashboard)/fees/actions'
import { feeSchema, feeDefaults, FEE_STATUSES, type FeeInput } from '@/lib/validations/fee'
import { SERVICE_TYPES } from '@/lib/validations/client'
import { serviceLabel, statusLabel } from '@/lib/format'
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
import { Field } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NO_SERVICE = 'none'

export function FeeFormDialog({
  open,
  onOpenChange,
  clients,
  feeId,
  defaultValues = feeDefaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: { id: string; name: string }[]
  feeId?: string
  defaultValues?: FeeInput
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FeeInput>({ resolver: zodResolver(feeSchema), defaultValues })

  const clientItems: Record<string, string> = Object.fromEntries(clients.map((c) => [c.id, c.name]))
  const serviceItems: Record<string, string> = {
    [NO_SERVICE]: 'No service',
    ...Object.fromEntries(SERVICE_TYPES.map((t) => [t, serviceLabel(t)])),
  }
  const statusItems: Record<string, string> = Object.fromEntries(
    FEE_STATUSES.map((s) => [s, statusLabel(s)])
  )

  function onSubmit(values: FeeInput) {
    startTransition(async () => {
      const result = await saveFee(values, feeId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(feeId ? 'Fee updated' : 'Fee logged')
      onOpenChange(false)
      reset(defaultValues)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{feeId ? 'Edit fee' : 'Log a fee'}</DialogTitle>
          <DialogDescription>Track what you have billed and what has come in.</DialogDescription>
        </DialogHeader>

        {clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Add a client first, then you can log fees against them."
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Client" htmlFor="client_id" required error={errors.client_id?.message}>
              <Controller
                control={control}
                name="client_id"
                render={({ field }) => (
                  <Select items={clientItems} value={field.value || null} onValueChange={field.onChange}>
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
                )}
              />
            </Field>

            <Field label="For what" htmlFor="description" required error={errors.description?.message}>
              <Input id="description" placeholder="ITR filing AY 2026-27" {...register('description')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Amount (₹)"
                htmlFor="amount"
                required
                error={errors.amount?.message}
                hint="e.g. 2500 or 2,500.50"
              >
                <Input id="amount" inputMode="decimal" placeholder="2500" {...register('amount')} />
              </Field>

              <Field label="Service" htmlFor="service_type" error={errors.service_type?.message}>
                <Controller
                  control={control}
                  name="service_type"
                  render={({ field }) => (
                    <Select
                      items={serviceItems}
                      value={field.value || NO_SERVICE}
                      onValueChange={(next) => field.onChange(next === NO_SERVICE ? '' : next)}
                    >
                      <SelectTrigger id="service_type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SERVICE}>No service</SelectItem>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {serviceLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" htmlFor="status" error={errors.status?.message}>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select items={statusItems} value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEE_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Due date"
                htmlFor="due_date"
                error={errors.due_date?.message}
                hint="Overdue is worked out from this"
              >
                <Input id="due_date" type="date" {...register('due_date')} />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : feeId ? 'Save changes' : 'Log fee'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
