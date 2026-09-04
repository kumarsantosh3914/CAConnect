import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/plans'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'CAConnect pricing for Indian CA firms. Free to start, ₹999 to ₹2,999 a month as your practice grows.',
}

const TIERS = ['starter', 'solo', 'pro', 'team'] as const

// Kept in step with lib/plans.ts by hand. The seat and portal rows are the
// ones that actually gate — everything else here is descriptive.
const ROWS: { label: string; values: (string | boolean)[] }[] = [
  { label: 'Client management', values: [true, true, true, true] },
  { label: 'Compliance deadline tracker', values: [true, true, true, true] },
  { label: 'Document collection links', values: [false, true, true, true] },
  { label: 'Fee tracker', values: [false, true, true, true] },
  {
    label: 'AI drafting (notices + client emails)',
    values: ['3 / month', '20 / month', '100 / month', 'Unlimited'],
  },
  { label: 'Email deadline reminders', values: [false, false, true, true] },
  {
    label: 'Team members',
    values: ['Just you', 'Just you', '3 people', 'Unlimited'],
  },
  { label: 'Assign work to staff', values: [false, false, true, true] },
  { label: 'Client portal', values: [false, false, true, true] },
  { label: 'Priority support', values: [false, false, true, true] },
]

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Start free. No credit card, no trial clock. Upgrade when it earns its keep.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const plan = PLANS[tier]
          return (
            <div
              key={tier}
              className={
                tier === 'solo' ? 'rounded-lg border-2 border-primary p-5' : 'rounded-lg border p-5'
              }
            >
              {tier === 'solo' && <p className="mb-2 text-xs font-medium text-primary">Most popular</p>}
              <h2 className="font-medium">{plan.name}</h2>
              <p className="mt-2 text-3xl font-semibold">
                {plan.priceMonthly === 0 ? 'Free' : `₹${plan.priceMonthly.toLocaleString('en-IN')}`}
                {plan.priceMonthly > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                )}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {Number.isFinite(plan.maxClients)
                  ? `Up to ${plan.maxClients} clients`
                  : 'Unlimited clients'}
              </p>
              <p className="text-sm text-muted-foreground">
                {plan.maxMembers === 1
                  ? 'Single login'
                  : Number.isFinite(plan.maxMembers)
                    ? `${plan.maxMembers} team members`
                    : 'Unlimited team members'}
              </p>
              <Button className="mt-5 w-full" nativeButton={false} render={<Link href="/signup" />}>
                {plan.priceMonthly === 0 ? 'Start free' : 'Start free trial'}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="mt-14 overflow-x-auto">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-3 text-left font-medium">Feature</th>
              {TIERS.map((tier) => (
                <th key={tier} className="px-4 py-3 text-center font-medium">
                  {PLANS[tier].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b">
                <td className="py-3 pr-4">{row.label}</td>
                {row.values.map((value, index) => (
                  <td key={index} className="px-4 py-3 text-center">
                    {value === true ? (
                      <Check className="mx-auto size-4" aria-label="Included" />
                    ) : value === false ? (
                      <Minus className="mx-auto size-4 text-muted-foreground" aria-label="Not included" />
                    ) : (
                      <span className="text-muted-foreground">{value}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Larger firm or 10+ staff? Email us about Enterprise — white-label and custom integrations.
      </p>
    </main>
  )
}
