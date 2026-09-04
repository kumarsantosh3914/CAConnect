'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createManualDeadline } from '@/app/(dashboard)/deadlines/actions'
import { SERVICE_TYPES } from '@/lib/validations/client'
import { serviceLabel } from '@/lib/format'
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
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const schema = z.object({
  client_id: z.string().min(1, 'Pick a client'),
  service_type: z.enum(SERVICE_TYPES),
  label: z.string().trim().min(1, 'Give this deadline a name').max(120),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a due date'),
  notes: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof schema>

export function AddDeadlineButton({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: '',
      service_type: 'other',
      label: '',
      due_date: '',
      notes: '',
    },
  })

  const clientItems: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name])
  )
  const serviceItems: Record<string, string> = Object.fromEntries(
    SERVICE_TYPES.map((type) => [type, serviceLabel(type)])
  )

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createManualDeadline(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Deadline added')
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add deadline
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a one-off deadline</DialogTitle>
            <DialogDescription>
              For dates the compliance calendar cannot know — a notice reply-by date, a hearing,
              an ad-hoc filing.
            </DialogDescription>
          </DialogHeader>

          {clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              description="Add a client first, then you can attach deadlines to them."
            />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Field label="Client" htmlFor="client_id" required error={errors.client_id?.message}>
                <Controller
                  control={control}
                  name="client_id"
                  render={({ field }) => (
                    <Select
                      items={clientItems}
                      value={field.value || null}
                      onValueChange={field.onChange}
                    >
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

              <Field label="What is due" htmlFor="label" required error={errors.label?.message}>
                <Input id="label" placeholder="Reply to 143(2) notice" {...register('label')} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service" htmlFor="service_type" error={errors.service_type?.message}>
                  <Controller
                    control={control}
                    name="service_type"
                    render={({ field }) => (
                      <Select
                        items={serviceItems}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="service_type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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

                <Field label="Due date" htmlFor="due_date" required error={errors.due_date?.message}>
                  <Input id="due_date" type="date" {...register('due_date')} />
                </Field>
              </div>

              <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
                <Textarea id="notes" rows={2} {...register('notes')} />
              </Field>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Adding…' : 'Add deadline'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
