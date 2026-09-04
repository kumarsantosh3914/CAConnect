import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'
import { listMarketplaceCities, searchProfiles } from '@/lib/marketplace/public'
import { RatingStars } from '@/components/marketplace/rating-stars'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPaise, serviceLabel } from '@/lib/format'
import type { ServiceType } from '@/types/database'

export const metadata: Metadata = {
  title: 'Find a CA',
  description:
    'Find a verified Chartered Accountant in your city. Compare fixed prices, read real reviews from actual clients, and book directly — no phone calls, no guessing.',
}

const SERVICES: ServiceType[] = [
  'itr',
  'gstr1',
  'gstr3b',
  'tds',
  'roc',
  'company_registration',
  'other',
]

function isService(value: string | undefined): value is ServiceType {
  return Boolean(value) && (SERVICES as string[]).includes(value as string)
}

export default async function FindACaPage(props: PageProps<'/find-a-ca'>) {
  const params = await props.searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const q = one(params.q)?.trim() || undefined
  const city = one(params.city)?.trim() || undefined
  const serviceParam = one(params.service)
  // Validated at the page boundary: an unknown enum value reaching the query
  // is a 500, and a search page must never break on a hand-edited URL.
  const service = isService(serviceParam) ? serviceParam : undefined

  const [profiles, cities] = await Promise.all([
    searchProfiles({ q, city, service }),
    listMarketplaceCities(),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Find a CA you can trust</h1>
        <p className="mt-3 text-muted-foreground">
          Real Chartered Accountants, upfront prices, and reviews written only by people who
          actually hired them. No calls to three offices to find out what something costs.
        </p>
      </div>

      <form className="mt-8 flex flex-wrap gap-2" action="/find-a-ca">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Name or speciality"
            className="pl-9"
            aria-label="Search by name or speciality"
          />
        </div>

        <select
          name="city"
          defaultValue={city ?? ''}
          aria-label="City"
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Any city</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          name="service"
          defaultValue={service ?? ''}
          aria-label="Service"
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Any service</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {serviceLabel(s)}
            </option>
          ))}
        </select>

        <Button type="submit">Search</Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        {profiles.length} {profiles.length === 1 ? 'CA' : 'CAs'} found
      </p>

      {profiles.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No CAs match that yet"
            description="The marketplace is new and filling up. Try a wider search, or check back soon."
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    <Link href={`/ca/${profile.slug}`} className="hover:underline">
                      {profile.display_name}
                    </Link>
                  </h2>
                  {profile.city && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden />
                      {profile.city}
                      {profile.state ? `, ${profile.state}` : ''}
                    </p>
                  )}
                </div>
                {profile.is_featured && <Badge>Featured</Badge>}
              </div>

              {profile.headline && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {profile.headline}
                </p>
              )}

              <div className="mt-3">
                <RatingStars rating={profile.average_rating} count={profile.review_count} />
              </div>

              {profile.specialisations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {profile.specialisations.slice(0, 4).map((s) => (
                    <Badge key={s} variant="secondary">
                      {serviceLabel(s)}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm">
                  {profile.from_price_paise !== null ? (
                    <>
                      <span className="text-muted-foreground">from </span>
                      <span className="font-semibold">
                        {formatPaise(profile.from_price_paise)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Ask for a quote</span>
                  )}
                </p>
                <Button size="sm" nativeButton={false} render={<Link href={`/ca/${profile.slug}`} />}>
                  View profile
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
