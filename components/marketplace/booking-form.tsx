'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { requestBooking } from '@/lib/marketplace/booking-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatPaise } from '@/lib/format'

/**
 * The booking form, for someone with no account and no intention of making
 * one. Name and email are the only required fields — every extra box here is
 * a percentage of demand that walks away, and the CA can ask for the rest.
 */
export function BookingForm({
  profileId,
  caName,
  packages,
}: {
  profileId: string
  caName: string
  packages: { id: string; title: string; price_paise: number }[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [form, setForm] = useState({
    package_id: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    message: '',
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await requestBooking({ profile_id: profileId, ...form })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSentTo(form.contact_email)
    })
  }

  if (sentTo) {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <CheckCircle2 className="size-6 text-green-600" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold tracking-tight">Request sent</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {caName} will get back to you directly. We have emailed{' '}
          <span className="font-medium text-foreground">{sentTo}</span> a link to check the status
          of your request — keep it, it is the only way back to this.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Request a consultation</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        No account needed. {caName} replies to you directly.
      </p>

      <div className="mt-4 space-y-3">
        {packages.length > 0 && (
          <Field label="What do you need?" htmlFor="bk-package">
            <select
              id="bk-package"
              value={form.package_id}
              onChange={(e) => set('package_id', e.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Not sure yet — just an enquiry</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {formatPaise(p.price_paise)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Your name" htmlFor="bk-name" required>
          <Input
            id="bk-name"
            value={form.contact_name}
            onChange={(e) => set('contact_name', e.target.value)}
            autoComplete="name"
          />
        </Field>

        <Field label="Email" htmlFor="bk-email" required>
          <Input
            id="bk-email"
            type="email"
            value={form.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
            autoComplete="email"
          />
        </Field>

        <Field label="Phone" htmlFor="bk-phone">
          <Input
            id="bk-phone"
            type="tel"
            value={form.contact_phone}
            onChange={(e) => set('contact_phone', e.target.value)}
            autoComplete="tel"
          />
        </Field>

        <Field label="City" htmlFor="bk-city">
          <Input id="bk-city" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>

        <Field label="What do you need help with?" htmlFor="bk-message">
          <Textarea
            id="bk-message"
            rows={3}
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="A sentence or two is plenty."
          />
        </Field>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          disabled={pending || !form.contact_name.trim() || !form.contact_email.trim()}
          onClick={submit}
        >
          {pending ? 'Sending…' : 'Send request'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Your details go to {caName} only. CAConnect does not take payment — you settle directly
          with your CA.
        </p>
      </div>
    </div>
  )
}
