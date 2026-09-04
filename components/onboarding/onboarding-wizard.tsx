'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { completeOnboarding, saveFirmDetails } from '@/app/(dashboard)/onboarding/actions'
import { ClientFormDialog } from '@/components/clients/client-form-dialog'
import { clientDefaults } from '@/lib/validations/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'

/**
 * Three steps, because the build plan's first success criterion is "a CA can
 * sign up and add their first client in under 5 minutes". Step 3 exists to
 * show the payoff — the deadlines they did not have to type in.
 */
export function OnboardingWizard({
  defaultFirmName,
  defaultFullName,
  defaultCity,
}: {
  defaultFirmName: string
  defaultFullName: string
  defaultCity: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [firmName, setFirmName] = useState(defaultFirmName)
  const [fullName, setFullName] = useState(defaultFullName)
  const [city, setCity] = useState(defaultCity)
  const [clientAdded, setClientAdded] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSaveFirm() {
    startTransition(async () => {
      const result = await saveFirmDetails({
        firm_name: firmName,
        full_name: fullName || undefined,
        city: city || undefined,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStep(2)
    })
  }

  function onFinish() {
    startTransition(async () => {
      const result = await completeOnboarding()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 py-8">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={
              n <= step
                ? 'h-1.5 flex-1 rounded-full bg-primary'
                : 'h-1.5 flex-1 rounded-full bg-muted'
            }
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to CAConnect</h1>
            <p className="mt-1.5 text-muted-foreground">
              Two questions, then we will get your first client in.
            </p>
          </div>

          <Field label="Firm name" htmlFor="firm_name" required>
            <Input
              id="firm_name"
              autoFocus
              value={firmName}
              onChange={(event) => setFirmName(event.target.value)}
              placeholder="Sharma & Associates"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="full_name">
              <Input
                id="full_name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="CA Rajesh Sharma"
              />
            </Field>
            <Field label="City" htmlFor="city">
              <Input
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Nagpur"
              />
            </Field>
          </div>

          <Button onClick={onSaveFirm} disabled={isPending || !firmName.trim()}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add your first client</h1>
            <p className="mt-1.5 text-muted-foreground">
              Tag the services you handle for them and their entire compliance calendar fills in
              automatically. Only the name is required.
            </p>
          </div>

          {clientAdded ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-50 p-4 dark:bg-green-950/30">
              <span className="flex size-8 items-center justify-center rounded-full bg-green-600 text-white">
                <Check className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-medium">Client added — deadlines generated</p>
            </div>
          ) : (
            <Button onClick={() => setClientOpen(true)}>Add a client</Button>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              {clientAdded ? 'Continue' : 'Skip for now'}
            </Button>
          </div>

          <ClientFormDialog
            open={clientOpen}
            onOpenChange={setClientOpen}
            defaultValues={clientDefaults}
            onSaved={() => {
              setClientAdded(true)
              router.refresh()
            }}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">You are set up</h1>
            <p className="mt-1.5 text-muted-foreground">
              Here is where things live. You can come back to any of it from the sidebar.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            {[
              ['Deadlines', 'Your morning view — what is overdue, what is due this week.'],
              ['Documents', 'Build a checklist, send one WhatsApp link, stop chasing.'],
              ['Fees', 'What you have billed and what has actually come in.'],
              ['IT Notices', 'Paste a notice, get a formal draft reply in under 30 seconds.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3 rounded-lg border p-3">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <Button onClick={onFinish} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Go to my dashboard
          </Button>
        </div>
      )}
    </div>
  )
}
