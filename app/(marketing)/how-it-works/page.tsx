import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'How it works',
  description: 'Three steps to running your CA practice on CAConnect.',
}

const STEPS = [
  {
    n: '1',
    title: 'Add your clients',
    body: 'Name, PAN, GSTIN, and which services you handle for them — ITR, GST, TDS, ROC. Two minutes each, and you can import the rest as you go. Nothing is mandatory except the name.',
  },
  {
    n: '2',
    title: 'Their deadlines appear',
    body: 'The moment you tag a client with a service, their compliance calendar fills in: GSTR-1 on the 11th, GSTR-3B on the 20th, TDS quarterly, ITR on 31 July — or 31 October for audit cases. Grouped by what is overdue, what is due this week, and what can wait.',
  },
  {
    n: '3',
    title: 'Stop chasing, start filing',
    body: 'Send a document checklist over WhatsApp and your client uploads from their phone camera. Log fees as you bill them. Paste an IT notice and get a formal draft reply back in under 30 seconds.',
  },
]

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 text-muted-foreground">
        CAConnect replaces the WhatsApp groups, the Excel sheet and the bit you were keeping in
        your head.
      </p>

      <ol className="mt-12 space-y-10">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border font-medium">
              {step.n}
            </span>
            <div>
              <h2 className="font-medium">{step.title}</h2>
              <p className="mt-1.5 text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">What about the AI?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It drafts, you decide. The notice drafter produces a formal, point-wise reply in Indian
          legal register — and it will never invent a figure, date or document number. Anything it
          does not know from the notice comes back as{' '}
          <code className="rounded bg-background px-1 py-0.5 text-xs">[insert amount]</code> for you
          to complete. It is a drafting aid, not a legal opinion; you remain professionally
          responsible for what you file.
        </p>
      </div>

      <div className="mt-12 text-center">
        <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
          Start Free — No Credit Card
        </Button>
      </div>
    </main>
  )
}
