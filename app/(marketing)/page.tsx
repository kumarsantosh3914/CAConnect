import Link from 'next/link'
import {
  CalendarClock,
  FileText,
  Receipt,
  Scale,
  Users,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/plans'

/** Placeholders until real beta CAs replace them. See the section comment. */
const TESTIMONIAL_SLOTS = [
  { id: 1, placeholder: 'Your words here.', persona: 'Solo CA · ITR and GST practice' },
  { id: 2, placeholder: 'Your words here.', persona: 'Three-person firm · 120+ clients' },
  { id: 3, placeholder: 'Your words here.', persona: 'Growing practice · Tier 2 city' },
]

const FEATURES = [
  {
    icon: Users,
    title: 'Every client in one place',
    body: 'PAN, GSTIN, contact details and service tags. Replaces the WhatsApp contact list and the Excel sheet you keep meaning to tidy up.',
  },
  {
    icon: CalendarClock,
    title: 'Deadlines that fill themselves in',
    body: 'Tag a client with ITR, GST, TDS or ROC and their filing calendar appears — every GSTR-1 on the 11th, every GSTR-3B on the 20th, already dated.',
  },
  {
    icon: FileText,
    title: 'Document collection without the chasing',
    body: 'Build a checklist, send one WhatsApp link. Your client uploads from their phone camera. No login, no app, no lost forwards.',
  },
  {
    icon: Receipt,
    title: 'Know what you are owed',
    body: 'Log a fee per client per service. See collected, outstanding and overdue for the month at a glance.',
  },
  {
    icon: Scale,
    title: 'IT notice replies in 30 seconds',
    body: 'Paste a notice or upload the PDF. Get a formal, point-wise draft in proper Indian legal language — for you to review, amend and sign.',
  },
]

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:py-28">
        <p className="text-sm font-medium text-muted-foreground">
          Practice management for Indian CA firms
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Run your CA firm without the chaos
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Client deadlines, document collection, fee tracking and AI-drafted IT notice replies —
          in one place, built for firms of one to five people.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Start Free — No Credit Card
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/how-it-works" />}>
            See how it works
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Free for up to 10 clients · Set up in under 5 minutes
        </p>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Five things, done properly
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border bg-background p-5">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The AI feature is the hook, so show it doing the thing. */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            The notice reply that took an hour, in half a minute
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Paste the notice. Read the draft. Change what you want. Sign it.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              You paste
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
{`Notice under section 143(2) of the
Income-tax Act, 1961

Your case has been selected for scrutiny
under CASS on the following issues:
 (i)  Large deduction claimed under
      Chapter VI-A…
 (ii) Substantial cash deposits not
      commensurate with turnover…`}
            </pre>
          </div>

          <div className="rounded-lg border p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              You get
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
{`Respected Sir/Madam,

With reference to the captioned notice
dated 12/08/2026 issued under section
143(2)… the assessee respectfully
submits as under.

1. Large deduction claimed under
   Chapter VI-A

   The deduction claimed in the return
   of income is ₹[insert amount]…`}
            </pre>
            <p className="mt-3 text-xs text-muted-foreground">
              Figures are left as placeholders, never invented. You fill them in and take
              professional responsibility, as you always have.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Start Free — No Credit Card
          </Button>
        </div>
      </section>

      {/*
        Testimonial slots, per the platform decisions doc. Deliberately empty
        until real beta CAs say something — inventing quotes for a product
        with no users would be fabricating social proof.
      */}
      <section className="border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            From the CAs using it
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We are onboarding our first firms now. These are their seats.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {TESTIMONIAL_SLOTS.map((slot) => (
              <figure
                key={slot.id}
                className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground"
              >
                <blockquote className="italic">“{slot.placeholder}”</blockquote>
                <figcaption className="mt-4 text-xs">
                  <span className="block font-medium text-foreground/70">Reserved</span>
                  {slot.persona}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link href="/signup" className="font-medium underline underline-offset-4">
              Be one of the first 20 firms
            </Link>{' '}
            <span className="text-muted-foreground">— free while we build with you.</span>
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Simple pricing</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Start free. Upgrade when your client list outgrows it.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['starter', 'solo', 'pro', 'team'] as const).map((tier) => {
              const plan = PLANS[tier]
              return (
                <div
                  key={tier}
                  className={
                    tier === 'solo'
                      ? 'rounded-lg border-2 border-primary bg-background p-5'
                      : 'rounded-lg border bg-background p-5'
                  }
                >
                  {tier === 'solo' && (
                    <p className="mb-2 text-xs font-medium text-primary">Most popular</p>
                  )}
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-semibold">
                    {plan.priceMonthly === 0 ? 'Free' : `₹${plan.priceMonthly.toLocaleString('en-IN')}`}
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    )}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                      {Number.isFinite(plan.maxClients)
                        ? `Up to ${plan.maxClients} clients`
                        : 'Unlimited clients'}
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                      {Number.isFinite(plan.aiDraftsPerMonth)
                        ? `${plan.aiDraftsPerMonth} AI drafts a month`
                        : 'Unlimited AI drafts'}
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                      All five features
                    </li>
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-center">
            <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
              Start Free — No Credit Card
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
