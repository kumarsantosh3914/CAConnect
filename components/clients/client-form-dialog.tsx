'use client'

import { useState, useTransition } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { clientSchema, CLIENT_TYPES, SERVICE_TYPES } from '@/lib/validations/client'
import type { ClientInput } from '@/lib/validations/client'
import { isGstinChecksumValid, panFromGstin, stateFromGstin } from '@/lib/validations/india'
import { saveClient } from '@/app/(dashboard)/clients/actions'
import { clientTypeLabel, serviceLabel } from '@/lib/format'
import { KYC_ENTITY_LABELS, KYC_ENTITY_TYPES } from '@/lib/kyc/checklists'
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
import { AssigneeSelect } from '@/components/team/assignee-select'
import { UNASSIGNED, type AssignableMember } from '@/lib/team/assignable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ClientFormValues = ClientInput

// Base UI renders the raw value in the trigger unless Root gets an items map.
const CLIENT_TYPE_ITEMS: Record<string, string> = Object.fromEntries(
  CLIENT_TYPES.map((type) => [type, clientTypeLabel(type)])
)
const KYC_ENTITY_ITEMS: Record<string, string> = KYC_ENTITY_LABELS

export function ClientFormDialog({
  open,
  onOpenChange,
  clientId,
  defaultValues,
  onSaved,
  members = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: string
  defaultValues: ClientFormValues
  onSaved?: (clientId: string) => void
  /** Firm members who can own this client. Empty in a one-person firm. */
  members?: AssignableMember[]
}) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues,
  })

  // useWatch over watch(): watch() returns a fresh function each render, which
  // React Compiler cannot memoize.
  const gstin = useWatch({ control, name: 'gstin' })
  const pan = useWatch({ control, name: 'pan' })
  const services = useWatch({ control, name: 'services' })

  // Advisory only — a wrong check digit warns, it never blocks the save.
  // CAs type these off paper and losing the whole record to a typo is worse
  // than storing one that needs correcting later.
  let gstinWarning: string | undefined
  if (gstin && gstin.length === 15) {
    if (!isGstinChecksumValid(gstin)) {
      gstinWarning = 'This GSTIN’s check digit does not match. Saving anyway — please verify.'
    } else if (pan && panFromGstin(gstin) && panFromGstin(gstin) !== pan) {
      gstinWarning = 'The PAN inside this GSTIN does not match the PAN above.'
    } else {
      const state = stateFromGstin(gstin)
      if (state) gstinWarning = undefined
    }
  }

  const gstinHint =
    gstin && gstin.length === 15 && isGstinChecksumValid(gstin)
      ? `Verified · ${stateFromGstin(gstin) ?? 'Unknown state'}`
      : 'Optional. 15 characters, e.g. 27ABCDE1234F1Z5'

  function onSubmit(values: ClientFormValues) {
    setFormError(null)
    startTransition(async () => {
      const result = await saveClient(values, clientId)
      if (!result.ok) {
        setFormError(result.error)
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ClientFormValues, { message })
        }
        return
      }
      toast.success(clientId ? 'Client updated' : `${values.name} added`)
      onOpenChange(false)
      reset(defaultValues)
      onSaved?.(result.clientId)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{clientId ? 'Edit client' : 'Add client'}</DialogTitle>
          <DialogDescription>
            Only the name is required — you can fill in the rest later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <Field label="Client name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" autoFocus placeholder="Ramesh Traders" {...register('name')} />
          </Field>

          <Field label="Client type" htmlFor="client_type" error={errors.client_type?.message}>
            <Controller
              control={control}
              name="client_type"
              render={({ field }) => (
                <Select
                  items={CLIENT_TYPE_ITEMS}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="client_type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {clientTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="KYC entity type" htmlFor="kyc_entity_type" required error={errors.kyc_entity_type?.message} hint="Creates the right KYC checklist after the client is added">
            <Controller
              control={control}
              name="kyc_entity_type"
              render={({ field }) => (
                <Select items={KYC_ENTITY_ITEMS} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="kyc_entity_type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KYC_ENTITY_TYPES.map((type) => <SelectItem key={type} value={type}>{KYC_ENTITY_LABELS[type]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="PAN"
              htmlFor="pan"
              error={errors.pan?.message}
              hint="Optional. e.g. ABCDE1234F"
            >
              <Input
                id="pan"
                placeholder="ABCDE1234F"
                className="uppercase"
                maxLength={10}
                {...register('pan', { setValueAs: (v: string) => v?.trim().toUpperCase() ?? '' })}
              />
            </Field>

            <Field
              label="GSTIN"
              htmlFor="gstin"
              error={errors.gstin?.message}
              warning={gstinWarning}
              hint={gstinHint}
            >
              <Input
                id="gstin"
                placeholder="27ABCDE1234F1Z5"
                className="uppercase"
                maxLength={15}
                {...register('gstin', { setValueAs: (v: string) => v?.trim().toUpperCase() ?? '' })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" placeholder="client@example.com" {...register('email')} />
            </Field>
            <Field
              label="Phone"
              htmlFor="phone"
              error={errors.phone?.message}
              hint="Used for the WhatsApp document link"
            >
              <Input id="phone" type="tel" placeholder="98765 43210" {...register('phone')} />
            </Field>
          </div>

          <Field label="Services" htmlFor="services" error={errors.services?.message}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Controller
                control={control}
                name="services"
                render={({ field }) => (
                  <>
                    {SERVICE_TYPES.map((service) => {
                      const checked = field.value.includes(service)
                      return (
                        <label
                          key={service}
                          className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[[data-checked]]:border-primary"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              field.onChange(
                                next
                                  ? [...field.value, service]
                                  : field.value.filter((s) => s !== service)
                              )
                            }}
                          />
                          {serviceLabel(service)}
                        </label>
                      )
                    })}
                  </>
                )}
              />
            </div>
          </Field>

          {/* These two only matter for the deadlines they drive, so only ask
              when the relevant service is actually tagged. */}
          {services?.includes('itr') && (
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Controller
                control={control}
                name="is_audit_case"
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <span>
                Audit case
                <span className="block text-xs text-muted-foreground">
                  ITR due 31 October instead of 31 July
                </span>
              </span>
            </label>
          )}

          {services?.includes('roc') && (
            <Field
              label="AGM date"
              htmlFor="agm_date"
              error={errors.agm_date?.message}
              hint="ROC annual return is due within 60 days of the AGM"
            >
              <Input id="agm_date" type="date" {...register('agm_date')} />
            </Field>
          )}

          {members.length > 1 && (
            <Field
              label="Handled by"
              htmlFor="assigned_to"
              hint="New filings for this client go to them"
            >
              <Controller
                control={control}
                name="assigned_to"
                render={({ field }) => (
                  <AssigneeSelect
                    id="assigned_to"
                    className="w-full"
                    members={members}
                    value={field.value ?? ''}
                    onChange={(next) => field.onChange(next === UNASSIGNED ? '' : next)}
                  />
                )}
              />
            </Field>
          )}

          <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} placeholder="Anything worth remembering" {...register('notes')} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : clientId ? 'Save changes' : 'Add client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
