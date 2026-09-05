import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'What CAConnect actually looks like: the compliance calendar filling itself in, a document checklist your client opens on their phone, and an IT notice reply drafted in under 30 seconds.',
}

/**
 * The demonstration page.
 *
 * The previous version claimed to show how the product works and contained no
 * product at all — three paragraphs and a grey box, on a page a sceptical CA
 * clicks precisely because they want to see it before believing it. Every step
 * here now carries the screen it actually produces, captured from a live
 * account rather than mocked up.
 *
 * Numbering is real: this is a sequence, and the order is the order a firm
 * actually does these things in. Set as clause numbers rather than circled
 * chips, to match the ledger language on the rest of the site.
 */

type Step = {
  n: string
  title: string
  body: string
  shot?: { src: string; alt: string; w: number; h: number; caption: string }
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'Add your clients',
    body: 'Name, PAN, GSTIN, and which services you handle for them — ITR, GST, TDS, ROC. Two minutes each, and you can add the rest as you go. Nothing is mandatory except the name.',
  },
  {
    n: '02',
    title: 'Their deadlines appear on their own',
    body: 'The moment you tag a client with a service, their filing calendar fills in: GSTR-1 on the 11th, GSTR-3B on the 20th, TDS quarterly, ITR on 31 July — or 31 October for audit cases. You never type a date. Grouped by what is overdue, what is due this week, and what can wait.',
    shot: {
      src: '/product/deadlines.png',
      alt: 'The deadlines screen, grouped into overdue and the next seven days, showing GSTR-1 and GSTR-3B filings per client with due dates and status.',
      w: 1360,
      h: 760,
      caption: 'Nobody typed these rows. Tag a client with GST and every month appears, already dated.',
    },
  },
  {
    n: '03',
    title: 'Ask for documents once',
    body: 'Build a checklist, send one WhatsApp link. This is what your client sees when they tap it — no login, no account, no app to install. They photograph the register on their phone and it lands against the right line on your checklist.',
    shot: {
      src: '/product/upload-phone.png',
      alt: 'The client-facing upload page on a phone: a checklist of sales register, purchase register and bank statement, each with an upload button.',
      w: 420,
      h: 620,
      caption: 'Your client’s side of the link. The part that usually lives in a WhatsApp thread.',
    },
  },
  {
    n: '04',
    title: 'Draft the notice reply',
    body: 'Paste an Income Tax or GST notice, or upload the PDF. You get a formal point-wise reply in Indian legal register, in under 30 seconds, ready to review and sign on your letterhead.',
    shot: {
      src: '/product/notice-drafter.png',
      alt: 'The notice drafter: a pasted 143(2) scrutiny notice on the left, and a formal drafted reply on the right addressed to the Assessing Officer with the DIN carried through.',
      w: 1360,
      h: 560,
      caption:
        'A real 143(2) notice in, a real draft out. The DIN, section and assessment year are carried across from the notice.',
    },
  },
  {
    n: '05',
    title: 'Know what you are owed',
    body: 'Log a fee per client per service as you bill it. Collected this month, outstanding, and overdue — three numbers most small practices genuinely cannot state on demand.',
    shot: {
      src: '/product/fees.png',
      alt: 'The fee register showing collected this month, outstanding and overdue totals above a table of fees by client and service.',
      w: 1360,
      h: 470,
      caption: 'Every fee against a client and a service, so the month totals itself.',
    },
  },
  {
    n: '06',
    title: 'Let new clients find you',
    body: 'Optional, and off until you switch it on. Publish a profile with your ICAI number, your specialisations and fixed prices for the work you do most. People searching for a CA in your city can see exactly what something costs and request it directly — and an accepted request becomes a client in your list, with their details already filled in.',
    shot: {
      src: '/product/marketplace.png',
      alt: 'A public CA profile showing ICAI membership number, years of experience, languages, specialisations and a request-a-consultation form.',
      w: 1360,
      h: 470,
      caption: 'Your public listing. Reviews on it can only be written by someone who actually booked.',
    },
  },
]

function Marker({ children }: { children: React.ReactNode }) {
  return <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">{children}</p>
}

export default function HowItWorksPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-12">
        <div className="mx-auto max-w-2xl text-center">
          <Marker>How it works</Marker>
          <h1 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            The whole practice, on one screen
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            CAConnect replaces the WhatsApp groups, the Excel sheet, and the bit you were keeping in
            your head. Here is every screen of it, from a live account.
          </p>
        </div>
      </section>

      {/* Each step is a ruled clause: number, statement, then the screen it produces. */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-4">
        <div className="divide-y divide-rule border-y border-rule">
          {STEPS.map((step) => (
            <article key={step.n} className="py-12">
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[64px_1fr]">
                <p className="text-brand font-mono text-sm font-semibold tabular">{step.n}</p>
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold tracking-tight text-balance">
                    {step.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>

              {step.shot && (
                <figure className={step.shot.w === 420 ? 'mt-8' : 'mt-8 sm:pl-[72px]'}>
                  {/*
                    The phone shot is shown at its own size rather than stretched
                    across the column — blowing a 420px screen up to 1200 would
                    misrepresent what the client actually holds.
                  */}
                  <div
                    className={
                      step.shot.w === 420
                        ? 'mx-auto w-full max-w-[320px] overflow-hidden rounded-sm border border-rule bg-background'
                        : 'overflow-hidden rounded-sm border border-rule bg-background'
                    }
                  >
                    <Image
                      src={step.shot.src}
                      alt={step.shot.alt}
                      width={step.shot.w}
                      height={step.shot.h}
                      className="w-full"
                    />
                  </div>
                  <figcaption
                    className={
                      step.shot.w === 420
                        ? 'mt-3 text-center text-xs text-muted-foreground'
                        : 'mt-3 text-xs text-muted-foreground'
                    }
                  >
                    {step.shot.caption}
                  </figcaption>
                </figure>
              )}
            </article>
          ))}
        </div>
      </section>

      {/*
        Promoted out of the footnote it used to be. This is the strongest trust
        argument on the site — a CA is professionally liable for what they file,
        and the honest limits of the drafter are the reason to believe the rest.
      */}
      <section className="border-t border-rule bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mx-auto max-w-2xl">
            <Marker>On the AI, plainly</Marker>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              It drafts. You decide.
            </h2>

            <dl className="mt-8 divide-y divide-rule border-y border-rule">
              {[
                [
                  'It will not invent a figure',
                  'Anything the notice does not state comes back as a marked placeholder — ₹[state amount], [attach Form 26AS] — for you to complete. A plausible-looking fabricated number in a statutory reply is the worst thing this could do, so it does not do it.',
                ],
                [
                  'It uses what the notice gives it',
                  'The DIN, the section, the notice date, the assessment year, the acknowledgement number, the ward or circle — carried through verbatim. A placeholder for something stated plainly in the notice is work handed back to you, not caution.',
                ],
                [
                  'It is a drafting aid, not an opinion',
                  'It does not advise you on the merits and it is not a legal opinion. You review, amend and sign, and you remain professionally responsible for what you file — exactly as you always have.',
                ],
                [
                  'Your clients’ data stays yours',
                  'Every record is scoped to your firm at the database level, not merely hidden in the interface. Client documents sit in private storage and are reachable only through short-lived signed links.',
                ],
              ].map(([term, detail]) => (
                <div key={term} className="grid gap-2 py-5 sm:grid-cols-[210px_1fr] sm:gap-8">
                  <dt className="font-medium text-balance">{term}</dt>
                  <dd className="text-pretty text-muted-foreground">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto w-full max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Set up in under five minutes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            Add one client, tag them with a service, and watch their filing calendar appear. That is
            the whole test — and it is free for your first ten clients.
          </p>
          <div className="mt-8">
            <Button size="lg" className="h-11 px-7" nativeButton={false} render={<Link href="/signup" />}>
              Start free — no credit card
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
