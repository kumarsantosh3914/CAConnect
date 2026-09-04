import Link from 'next/link'
import { CalendarClock, Check, FileText, Receipt, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/plans'

/** Placeholders until real beta CAs replace them. See the section comment. */
const TESTIMONIAL_SLOTS = [
  { id: 1, placeholder: 'Your words here.', persona: 'Solo CA · ITR and GST practice' },
  { id: 2, placeholder: 'Your words here.', persona: 'Three-person firm · 120+ clients' },
  { id: 3, placeholder: 'Your words here.', persona: 'Growing practice · Tier 2 city' },
]

/**
 * Four, not five. The AI notice drafter used to sit here as a fifth tile,
 * which left a hole in a three-column grid and buried the one feature CAs
 * actually tell each other about. It leads the page now instead.
 */
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
]

const PASTED = `Notice under section 143(2) of the
Income-tax Act, 1961

Your case has been selected for scrutiny
under CASS on the following issues:
 (i)  Large deduction claimed under
      Chapter VI-A…
 (ii) Substantial cash deposits not
      commensurate with turnover…`

const DRAFTED = `Respected Sir/Madam,

With reference to the captioned notice
dated 12/08/2026 issued under section
143(2)… the assessee respectfully
submits as under.

1. Large deduction claimed under
   Chapter VI-A

   The deduction claimed in the return
   of income is ₹[insert amount]…`

/**
 * The product, shown doing the thing. This sits in the hero because a page
 * that only asserts is a page nobody believes, and this is the single output
 * a CA can judge in five seconds.
 */
function NoticeDemo() {
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-muted/40 p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            You paste
          </p>
          <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {PASTED}
          </pre>
        </div>

        <div className="rounded-xl border bg-background p-5 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            You get, in under 30 seconds
          </p>
          <pre className="mt-3 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {DRAFTED}
          </pre>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-pretty text-muted-foreground">
        Figures are left as placeholders, never invented. You fill them in and take professional
        responsibility, as you always have.
      </p>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main>
      {/*
        The hero carries the product, not just a promise. The previous version
        was type and buttons alone, which left a screen of empty page above the
        fold and gave a visitor nothing to believe.
      */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-16 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Practice management for Indian CA firms
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Run your CA firm without the chaos
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            Client deadlines, document collection, fee tracking and AI-drafted IT notice replies —
            in one place, built for firms of one to five people.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-11 px-6" nativeButton={false} render={<Link href="/signup" />}>
              Start Free — No Credit Card
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6"
              nativeButton={false}
              render={<Link href="/how-it-works" />}
            >
              See how it works
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free for up to 10 clients · Set up in under 5 minutes
          </p>
        </div>

        <div className="mt-14">
          <p className="mb-5 text-center text-sm font-medium">
            The notice reply that took an hour, in half a minute
          </p>
          <NoticeDemo />
        </div>
      </section>

      {/*
        Rhythm: this is the second-most important section, so it gets the
        heavier treatment — tinted ground, generous padding. The founding-firm
        band below is the least important and is sized accordingly.
      */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              And everything else the firm runs on
            </h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              The parts that live in WhatsApp threads and a spreadsheet nobody has opened since
              March.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border bg-background p-6">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button size="lg" className="h-11 px-6" nativeButton={false} render={<Link href="/signup" />}>
              Start Free — No Credit Card
            </Button>
          </div>
        </div>
      </section>

      {/*
        Testimonial slots, per the platform decisions doc. Deliberately empty
        until real beta CAs say something — inventing quotes for a product with
        no users would be fabricating social proof.

        Kept visually quiet on purpose: three prominent empty boxes read as
        "nobody uses this", which is worse than saying plainly that we are
        still onboarding the first firms.
      */}
      <section className="border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-lg font-semibold tracking-tight">From the CAs using it</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We are onboarding our first firms now. These are their seats — we would rather leave
              them empty than invent quotes.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {TESTIMONIAL_SLOTS.map((slot) => (
              <figure
                key={slot.id}
                className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
              >
                <blockquote className="italic">&ldquo;{slot.placeholder}&rdquo;</blockquote>
                <figcaption className="mt-3 text-xs">
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
        <div className="mx-auto w-full max-w-5xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simple pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Upgrade when your client list outgrows it.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['starter', 'solo', 'pro', 'team'] as const).map((tier) => {
              const plan = PLANS[tier]
              // Team is the tier that carries the multi-user, staff assignment
              // and client portal features, so it is the one worth pointing at
              // — not Solo, which was highlighted before any of that existed.
              const highlighted = tier === 'team'
              return (
                <div
                  key={tier}
                  className={
                    highlighted
                      ? 'relative rounded-xl border-2 border-primary bg-background p-6 shadow-sm'
                      : 'rounded-xl border bg-background p-6'
                  }
                >
                  {/*
                    The badge row is always rendered, empty or not. Only two of
                    the four tiers carry a label, and letting it collapse left
                    Starter and Pro sitting a line higher than their
                    neighbours — a misalignment you see immediately across a
                    row of four.
                  */}
                  <p
                    className={
                      highlighted
                        ? 'mb-2 h-4 text-xs font-medium text-primary'
                        : 'mb-2 h-4 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {highlighted ? 'Best for growing firms' : tier === 'solo' ? 'Most popular' : ''}
                  </p>
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-semibold">
                    {plan.priceMonthly === 0
                      ? 'Free'
                      : `₹${plan.priceMonthly.toLocaleString('en-IN')}`}
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    )}
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
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
                      {plan.maxMembers === 1
                        ? 'Single login'
                        : Number.isFinite(plan.maxMembers)
                          ? `${plan.maxMembers} team members`
                          : 'Unlimited team members'}
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                      {plan.clientPortal ? 'Client portals included' : 'All five core features'}
                    </li>
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-12 text-center">
            <Button size="lg" className="h-11 px-6" nativeButton={false} render={<Link href="/signup" />}>
              Start Free — No Credit Card
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              No card. No trial clock. Upgrades are applied by hand while we are small.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
