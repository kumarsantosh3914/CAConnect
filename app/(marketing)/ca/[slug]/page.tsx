import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Award, Clock, Globe, MapPin } from 'lucide-react'
import { getPublicProfile } from '@/lib/marketplace/public'
import { RatingStars } from '@/components/marketplace/rating-stars'
import { BookingForm } from '@/components/marketplace/booking-form'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatPaise, serviceLabel } from '@/lib/format'

export async function generateMetadata(props: PageProps<'/ca/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const profile = await getPublicProfile(slug)
  if (!profile) return { title: 'CA not found' }

  return {
    title: `${profile.display_name}${profile.city ? ` — ${profile.city}` : ''}`,
    description:
      profile.headline ??
      `${profile.display_name} is a Chartered Accountant${profile.city ? ` in ${profile.city}` : ''} on CAConnect. See fixed prices, reviews, and book directly.`,
    // A public listing is the one part of CAConnect that SHOULD be indexed —
    // it is how demand finds supply.
    openGraph: {
      title: profile.display_name,
      description: profile.headline ?? undefined,
      type: 'profile',
    },
  }
}

export default async function PublicCaProfilePage(props: PageProps<'/ca/[slug]'>) {
  const { slug } = await props.params
  const profile = await getPublicProfile(slug)

  // An unpublished or withdrawn listing is indistinguishable from one that
  // never existed, which is what a CA who withdraws expects.
  if (!profile) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{profile.display_name}</h1>
              {profile.is_featured && <Badge>Featured</Badge>}
            </div>

            {profile.headline && <p className="text-lg text-muted-foreground">{profile.headline}</p>}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden />
                  {profile.city}
                  {profile.state ? `, ${profile.state}` : ''}
                </span>
              )}
              {profile.years_experience !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-4" aria-hidden />
                  {profile.years_experience} years
                </span>
              )}
              {profile.membership_no && (
                <span className="flex items-center gap-1">
                  <Award className="size-4" aria-hidden />
                  ICAI {profile.membership_no}
                </span>
              )}
              {profile.languages.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe className="size-4" aria-hidden />
                  {profile.languages.join(', ')}
                </span>
              )}
            </div>

            <RatingStars rating={profile.average_rating} count={profile.review_count} />
          </header>

          {profile.specialisations.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground">Specialises in</h2>
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.specialisations.map((s) => (
                  <Badge key={s} variant="secondary">
                    {serviceLabel(s)}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {profile.about && (
            <section>
              <h2 className="text-lg font-semibold tracking-tight">About</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {profile.about}
              </p>
            </section>
          )}

          {profile.packages.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold tracking-tight">Fixed price packages</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The price you see is the price you pay.
              </p>
              <ul className="mt-3 space-y-3">
                {profile.packages.map((pkg) => (
                  <li key={pkg.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{pkg.title}</p>
                        {pkg.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pkg.service_type && (
                            <Badge variant="secondary">{serviceLabel(pkg.service_type)}</Badge>
                          )}
                          {pkg.turnaround_days && (
                            <Badge variant="outline">
                              {pkg.turnaround_days} day{pkg.turnaround_days === 1 ? '' : 's'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-lg font-semibold">{formatPaise(pkg.price_paise)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Reviews {profile.review_count > 0 && `(${profile.review_count})`}
            </h2>
            {profile.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No reviews yet. Only clients who actually booked through CAConnect can leave one,
                so there is nothing here until someone has.
              </p>
            ) : (
              <ul className="mt-3 space-y-4">
                {profile.reviews.map((review) => (
                  <li key={review.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <RatingStars rating={review.rating} count={1} className="[&>span:last-child]:hidden" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                    {review.body && (
                      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                        {review.body}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {review.reviewer_name} · verified booking
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <BookingForm
            profileId={profile.id}
            caName={profile.display_name}
            packages={profile.packages.map((p) => ({
              id: p.id,
              title: p.title,
              price_paise: p.price_paise,
            }))}
          />
        </aside>
      </div>
    </main>
  )
}
