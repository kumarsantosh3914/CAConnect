import type { Metadata } from 'next'
import Link from 'next/link'
import { lookupBooking } from '@/lib/marketplace/booking-actions'
import { ReviewForm } from '@/components/marketplace/review-form'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatPaise, serviceLabel } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Your request',
  // A booking link is personal; it must never end up in search results.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  requested: {
    title: 'Waiting on your CA',
    body: 'Your request has been sent. They will get back to you directly, usually within a day or two.',
  },
  accepted: {
    title: 'Your CA has accepted',
    body: 'They have taken this on and will be in touch about next steps.',
  },
  declined: {
    title: 'Not taken up',
    body: 'This CA could not take this on. You can find another on the marketplace.',
  },
  completed: {
    title: 'Work complete',
    body: 'Your CA has marked this finished. If it went well — or if it did not — say so below.',
  },
  cancelled: {
    title: 'Cancelled',
    body: 'This request was cancelled.',
  },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      {children}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Secured by CAConnect · This page is private to you
      </p>
    </main>
  )
}

export default async function BookingPage(props: PageProps<'/booking/[token]'>) {
  const { token } = await props.params
  const booking = await lookupBooking(token)

  if (!booking) {
    return (
      <Shell>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">This link is not valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please check the link in your email, or{' '}
            <Link href="/find-a-ca" className="underline">
              find a CA
            </Link>{' '}
            to make a new request.
          </p>
        </div>
      </Shell>
    )
  }

  const copy = STATUS_COPY[booking.status] ?? STATUS_COPY.requested

  return (
    <Shell>
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                <Link href={`/ca/${booking.ca_slug}`} className="hover:underline">
                  {booking.ca_display_name}
                </Link>
                {booking.ca_city ? ` · ${booking.ca_city}` : ''}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">{copy.title}</h1>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>

          <dl className="mt-5 divide-y border-t pt-2 text-sm">
            {booking.package_title && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Service</dt>
                <dd className="text-right font-medium">{booking.package_title}</dd>
              </div>
            )}
            {booking.service_type && !booking.package_title && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Service</dt>
                <dd className="text-right font-medium">{serviceLabel(booking.service_type)}</dd>
              </div>
            )}
            {booking.quoted_amount_paise !== null && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Quoted price</dt>
                <dd className="text-right font-medium">
                  {formatPaise(booking.quoted_amount_paise)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">Requested</dt>
              <dd className="text-right font-medium">{formatDate(booking.created_at)}</dd>
            </div>
          </dl>

          {booking.message && (
            <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
              {booking.message}
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Payment is settled directly with your CA. CAConnect does not take payment.
          </p>
        </div>

        {/*
          A review is offered only once the CA has marked the work complete —
          that is what makes it a review of work that actually happened rather
          than of a conversation.
        */}
        {booking.status === 'completed' && !booking.has_review && (
          <ReviewForm token={token} caName={booking.ca_display_name} />
        )}

        {booking.has_review && (
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold tracking-tight">Thanks for your review</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It is live on {booking.ca_display_name}&apos;s profile and helps the next person
              choose.
            </p>
          </div>
        )}
      </div>
    </Shell>
  )
}
