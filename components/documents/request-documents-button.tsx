'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createDocumentRequest } from '@/app/(dashboard)/documents/actions'
import { ShareLinkDialog } from './share-link-dialog'
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
import { Checkbox } from '@/components/ui/checkbox'
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
  title: z.string().trim().min(1, 'Give this request a title').max(120),
  message: z.string().max(1000).optional(),
  expires_in_days: z.coerce.number().int().min(1).max(180),
  items: z
    .array(z.object({ label: z.string().trim().min(1, 'Name this item'), is_required: z.boolean() }))
    .min(1, 'Add at least one document'),
})

type FormValues = z.input<typeof schema>

/** The checklists a CA actually asks for, so the common case is two clicks. */
const PRESETS: Record<string, { label: string; is_required: boolean }[]> = {
  'ITR — Salaried': [
    { label: 'Form 16', is_required: true },
    { label: 'Bank statement (full year)', is_required: true },
    { label: 'Investment proofs (80C)', is_required: false },
    { label: 'Rent receipts / HRA proof', is_required: false },
  ],
  'GST — Monthly': [
    { label: 'Sales register', is_required: true },
    { label: 'Purchase register', is_required: true },
    { label: 'Bank statement', is_required: true },
  ],
  'Company Registration': [
    { label: 'PAN card (all directors)', is_required: true },
    { label: 'Aadhaar card (all directors)', is_required: true },
    { label: 'Passport photo', is_required: true },
    { label: 'Registered office address proof', is_required: true },
  ],
}

export function RequestDocumentsButton({
  clients,
  defaultClientId,
  firmName,
  label = 'Request documents',
}: {
  clients: { id: string; name: string; phone: string | null }[]
  defaultClientId?: string
  firmName: string | null
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [share, setShare] = useState<{ url: string; clientId: string; title: string } | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: defaultClientId ?? '',
      title: '',
      message: '',
      expires_in_days: 30,
      items: [{ label: '', is_required: true }],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  const clientItems: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name])
  )

  function applyPreset(name: string) {
    replace(PRESETS[name])
    setValue('title', name)
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createDocumentRequest({
        ...values,
        expires_in_days: Number(values.expires_in_days),
        items: values.items,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      setShare({ url: result.url, clientId: values.client_id, title: values.title })
      reset()
      router.refresh()
    })
  }

  const shareClient = clients.find((c) => c.id === share?.clientId)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request documents</DialogTitle>
            <DialogDescription>
              Your client gets a link they can upload from — no login required.
            </DialogDescription>
          </DialogHeader>

          {clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              description="Add a client first, then you can request documents from them."
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

              <div className="space-y-2">
                <p className="text-sm font-medium">Start from a checklist</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(PRESETS).map((name) => (
                    <Button
                      key={name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(name)}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>

              <Field label="Title" htmlFor="title" required error={errors.title?.message}>
                <Input id="title" placeholder="ITR 2026-27 documents" {...register('title')} />
              </Field>

              <Field
                label="Documents needed"
                htmlFor="items"
                required
                error={errors.items?.message ?? errors.items?.root?.message}
              >
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Form 16"
                        aria-label={`Document ${index + 1}`}
                        {...register(`items.${index}.label`)}
                      />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Controller
                          control={control}
                          name={`items.${index}.is_required`}
                          render={({ field: checkbox }) => (
                            <Checkbox
                              checked={checkbox.value}
                              onCheckedChange={checkbox.onChange}
                            />
                          )}
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                        aria-label={`Remove document ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ label: '', is_required: true })}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add item
                  </Button>
                </div>
              </Field>

              <Field label="Message (optional)" htmlFor="message" error={errors.message?.message}>
                <Textarea
                  id="message"
                  rows={2}
                  placeholder="Please send these by Friday so we can file on time."
                  {...register('message')}
                />
              </Field>

              <Field
                label="Link expires in (days)"
                htmlFor="expires_in_days"
                error={errors.expires_in_days?.message}
                hint="Links are time-limited so an old one cannot be reused"
              >
                <Input
                  id="expires_in_days"
                  type="number"
                  min={1}
                  max={180}
                  {...register('expires_in_days')}
                />
              </Field>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Creating…' : 'Create link'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {share && shareClient && (
        <ShareLinkDialog
          open
          onOpenChange={(next) => !next && setShare(null)}
          url={share.url}
          title={share.title}
          clientName={shareClient.name}
          clientPhone={shareClient.phone}
          firmName={firmName}
        />
      )}
    </>
  )
}
