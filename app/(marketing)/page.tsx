import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/plans'

/**
 * The landing page, built as a statutory document rather than a SaaS template.
 *
 * The identity here is carried by STRUCTURE, not colour: hairline rules where
 * a template would put card borders, ruled columns, figures right-aligned and
 * tabular, and section labels set like the clause markers on a filing. That is
 * deliberate — a cream ground with a display serif and a terracotta accent is
 * itself a house style now, and the point was to not look assembled.
 *
 * The stamp ochre is spent sparingly: section labels and the one marker on the
 * drafted reply. It is never used for a button. The moment it appears
 * everywhere it stops meaning anything.
 */

const FEATURES = [
  {
    term: 'Client register',
    detail:
      'PAN, GSTIN, service tags and contact details in one record. Replaces the WhatsApp contact list and the spreadsheet nobody has opened since March.',
  },
  {
    term: 'Compliance calendar',
    detail:
      'Tag a client with ITR, GST, TDS or ROC and their filing dates appear — every GSTR-1 on the 11th, every GSTR-3B on the 20th, already dated, for every month ahead.',
  },
  {
    term: 'Document collection',
    detail:
      'Build a checklist, send one WhatsApp link. Your client uploads from their phone camera. No login, no app, nothing lost in a forwarded thread.',
  },
  {
    term: 'Fee register',
    detail:
      'Logged per client per service. Collected, outstanding and overdue for the month, which most small practices genuinely cannot state on demand.',
  },
]

const PASTED = `NOTICE UNDER SECTION 143(2) OF THE
INCOME-TAX ACT, 1961

DIN: ITBA/AST/S/143(2)/2026-27/10982…
Date: 12/08/2026

Your case has been selected for
scrutiny under CASS on the following
issues:
 (i)  Large deduction claimed under
      Chapter VI-A
 (ii) Substantial cash deposits not
      commensurate with turnover`

const DRAFTED = `To,
The Assessing Officer
Circle 2(1), Pune
DIN: ITBA/AST/S/143(2)/2026-27/10982…

Respected Sir/Madam,

With reference to the captioned notice
dated 12/08/2026 issued under section
143(2) for Assessment Year 2026-27, the
assessee respectfully submits as under.

1. Large deduction claimed under
   Chapter VI-A

   The deduction claimed in the return
   of income is ₹[state amount]…`

/** A clause marker. Small, ochre, letterspaced — the page's only stamp. */
function Marker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">{children}</p>
  )
}

export default function LandingPage() {
  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-14 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <Marker>Practice management for Indian CA firms</Marker>
          <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-[3.4rem]">
            Run your CA firm without the chaos
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Client deadlines, document collection, fee tracking and AI-drafted IT notice replies —
            in one place, built for firms of one to five people.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-11 px-7" nativeButton={false} render={<Link href="/signup" />}>
              Start free — no credit card
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-7"
              nativeButton={false}
              render={<Link href="/how-it-works" />}
            >
              See how it works
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Free for up to 10 clients · Set up in under 5 minutes
          </p>
        </div>
      </section>

      {/* ── The notice drafter, presented as a specimen document ──────── */}
      <section className="border-t border-rule bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Marker>The drafting</Marker>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              An hour of drafting, in half a minute
            </h2>
          </div>

          {/*
            Framed like a document under review: a header strip, then two
            columns split by a single hairline. Not two cards — a ledger has
            rules, not boxes.
          */}
          <div className="mt-10 overflow-hidden rounded-sm border border-rule bg-background">
            <div className="grid divide-y divide-rule md:grid-cols-2 md:divide-x md:divide-y-0">
              <div>
                <p className="border-b border-rule px-5 py-2.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Notice, as received
                </p>
                <pre className="overflow-x-auto px-5 py-5 font-mono text-xs leading-relaxed whitespace-pre text-muted-foreground">
                  {PASTED}
                </pre>
              </div>
              <div>
                {/* The one place the stamp appears in this section. */}
                <p className="text-brand border-b border-rule px-5 py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
                  Draft reply, 28 seconds later
                </p>
                <pre className="overflow-x-auto px-5 py-5 font-mono text-xs leading-relaxed whitespace-pre">
                  {DRAFTED}
                </pre>
              </div>
            </div>
            <p className="border-t border-rule px-5 py-3 text-xs text-muted-foreground">
              The DIN, section, date and assessment year are carried through from the notice.
              Figures are left as <span className="font-mono">₹[state amount]</span> — never
              invented. You fill them in and sign, as you always have.
            </p>
          </div>
        </div>
      </section>

      {/* ── The actual product ───────────────────────────────────────── */}
      <section className="border-t border-rule">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Marker>The software</Marker>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              What you open at nine in the morning
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Not a report you run. The four things that decide your day, with whatever is already
              past its due date at the top.
            </p>
          </div>

          <figure className="mt-10">
            <div className="overflow-hidden rounded-sm border border-rule bg-background">
              <Image
                src="/product/dashboard.png"
                alt="The CAConnect dashboard: overdue filings, deadlines due in seven days, client count and fees overdue, above a list of filings past their due date."
                width={1360}
                height={470}
                className="w-full"
                priority
              />
            </div>
            <figcaption className="mt-3 text-center text-xs text-muted-foreground">
              A live account. Overdue filings first, because that is the order the day happens in.
            </figcaption>
          </figure>

          <figure className="mt-10">
            <div className="overflow-hidden rounded-sm border border-rule bg-background">
              <Image
                src="/product/fees.png"
                alt="The fee register: collected this month, outstanding and overdue totals above a table of fees by client."
                width={1360}
                height={470}
                className="w-full"
              />
            </div>
            <figcaption className="mt-3 text-center text-xs text-muted-foreground">
              Collected, outstanding, overdue. Three numbers most practices cannot state on demand.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Features, as a ruled schedule ────────────────────────────── */}
      <section className="border-t border-rule bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Marker>The rest of the practice</Marker>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Everything else the firm runs on
            </h2>
          </div>

          {/*
            A schedule, not a card grid: term on the left, detail on the right,
            separated by hairlines. This is how a compliance annexure reads.
          */}
          <dl className="mx-auto mt-10 max-w-3xl divide-y divide-rule border-y border-rule">
            {FEATURES.map(({ term, detail }) => (
              <div key={term} className="grid gap-2 py-5 sm:grid-cols-[190px_1fr] sm:gap-8">
                <dt className="font-medium">{term}</dt>
                <dd className="text-pretty text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 text-center">
            <Button size="lg" className="h-11 px-7" nativeButton={false} render={<Link href="/signup" />}>
              Start free — no credit card
            </Button>
          </div>
        </div>
      </section>

      {/* ── Pricing, as a ruled schedule of rates ────────────────────── */}
      <section className="border-t border-rule">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Marker>Schedule of rates</Marker>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Simple pricing
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Upgrade when your client list outgrows it.
            </p>
          </div>

          {/*
            Columns divided by hairlines rather than four bordered cards. Team
            carries the one ochre marker because it is the tier that holds the
            multi-user, portal and staff features.
          */}
          <div className="mt-10 grid divide-y divide-rule border-y border-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {(['starter', 'solo', 'pro', 'team'] as const).map((tier) => {
              const plan = PLANS[tier]
              const flagship = tier === 'team'
              return (
                <div key={tier} className="px-5 py-6 first:pl-0 last:pr-0">
                  <p
                    className={
                      flagship
                        ? 'text-brand h-4 text-[11px] font-semibold tracking-[0.12em] uppercase'
                        : 'h-4 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase'
                    }
                  >
                    {flagship ? 'Growing firms' : tier === 'solo' ? 'Most popular' : ''}
                  </p>
                  <h3 className="mt-3 font-medium">{plan.name}</h3>
                  <p className="tabular mt-1 text-3xl font-semibold">
                    {plan.priceMonthly === 0 ? 'Free' : `₹${plan.priceMonthly.toLocaleString('en-IN')}`}
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    )}
                  </p>

                  <dl className="mt-5 space-y-2 text-sm">
                    {[
                      [
                        'Clients',
                        Number.isFinite(plan.maxClients) ? String(plan.maxClients) : 'Unlimited',
                      ],
                      [
                        'AI drafts',
                        Number.isFinite(plan.aiDraftsPerMonth)
                          ? `${plan.aiDraftsPerMonth} / month`
                          : 'Unlimited',
                      ],
                      [
                        'Team',
                        plan.maxMembers === 1
                          ? 'Single login'
                          : Number.isFinite(plan.maxMembers)
                            ? `${plan.maxMembers} people`
                            : 'Unlimited',
                      ],
                      ['Client portals', plan.clientPortal ? 'Included' : '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="tabular text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-center">
            <Button size="lg" className="h-11 px-7" nativeButton={false} render={<Link href="/signup" />}>
              Start free — no credit card
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              No card, no trial clock. Upgrades are applied by hand while we are small.
            </p>
          </div>
        </div>
      </section>

      {/* ── Founding firms ──────────────────────────────────────────── */}
      <section className="border-t border-rule bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <div className="mx-auto max-w-2xl text-center">
            <Marker>Currently onboarding</Marker>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-balance">
              We are signing up the first twenty firms
            </h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              You would be early. That means the compliance rules get checked against your
              practice, and what you ask for gets built. It also means there are no testimonials on
              this page yet — we would rather leave the space empty than invent one.
            </p>
            <div className="mt-7">
              <Button size="lg" className="h-11 px-7" nativeButton={false} render={<Link href="/signup" />}>
                Take one of the twenty seats
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
