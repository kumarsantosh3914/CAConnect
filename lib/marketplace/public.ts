import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ServiceType } from '@/types/database'

/**
 * The public marketplace reads.
 *
 * Note what this file does NOT import: the service-role client. Marketplace
 * data is public by design, so the `anon` SELECT policies in migration 0011
 * are the boundary and RLS stays in charge. A logged-out visitor is the `anon`
 * role and a signed-in CA is `authenticated`; both see exactly the published
 * rows and nothing else.
 *
 * Contact details are absent from these tables entirely — RLS is row-level,
 * not column-level, so a public row is public in full. The booking form is the
 * contact channel.
 */

export type ProfileCard = {
  id: string
  slug: string
  display_name: string
  headline: string | null
  city: string | null
  state: string | null
  years_experience: number | null
  languages: string[]
  specialisations: ServiceType[]
  is_featured: boolean
  review_count: number
  average_rating: number | null
  from_price_paise: number | null
}

export type SearchFilters = {
  q?: string
  city?: string
  service?: ServiceType
  maxPricePaise?: number
}

/**
 * Marketplace search.
 *
 * Ordering puts featured listings first (Revenue Stream 3, not sold yet but
 * the column exists), then better-reviewed firms, then newer ones — so an
 * unreviewed firm that just joined is still reachable rather than buried
 * forever behind incumbents.
 */
export async function searchProfiles(filters: SearchFilters = {}): Promise<ProfileCard[]> {
  const supabase = await createClient()

  let query = supabase
    .from('ca_profiles')
    .select(
      'id,slug,display_name,headline,city,state,years_experience,languages,specialisations,is_featured,created_at,ca_packages(price_paise,is_active)'
    )
    .eq('is_published', true)

  if (filters.city) query = query.ilike('city', filters.city)
  if (filters.service) query = query.contains('specialisations', [filters.service])
  if (filters.q) {
    const term = `%${filters.q}%`
    query = query.or(`display_name.ilike.${term},headline.ilike.${term},about.ilike.${term}`)
  }

  const { data, error } = await query.limit(60)
  if (error || !data) return []

  const ids = data.map((row) => row.id)
  const ratings = await ratingsFor(ids)

  const cards: ProfileCard[] = data.map((row) => {
    const active = (row.ca_packages ?? []).filter((p) => p.is_active)
    const from = active.length > 0 ? Math.min(...active.map((p) => p.price_paise)) : null
    const rating = ratings.get(row.id)
    return {
      id: row.id,
      slug: row.slug,
      display_name: row.display_name,
      headline: row.headline,
      city: row.city,
      state: row.state,
      years_experience: row.years_experience,
      languages: row.languages,
      specialisations: row.specialisations,
      is_featured: row.is_featured,
      review_count: rating?.review_count ?? 0,
      average_rating: rating?.average_rating ?? null,
      from_price_paise: from,
    }
  })

  // Price filtering happens here rather than in SQL: "from ₹X" is the minimum
  // across a firm's packages, which Postgres cannot filter on without an
  // aggregate join that would drop firms having no packages at all.
  const filtered =
    filters.maxPricePaise === undefined
      ? cards
      : cards.filter(
          (card) => card.from_price_paise !== null && card.from_price_paise <= filters.maxPricePaise!
        )

  return filtered.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
    if ((b.average_rating ?? 0) !== (a.average_rating ?? 0)) {
      return (b.average_rating ?? 0) - (a.average_rating ?? 0)
    }
    return b.review_count - a.review_count
  })
}

async function ratingsFor(profileIds: string[]) {
  const map = new Map<string, { review_count: number; average_rating: number }>()
  if (profileIds.length === 0) return map

  const supabase = await createClient()
  const { data } = await supabase
    .from('ca_profile_ratings')
    .select('profile_id,review_count,average_rating')
    .in('profile_id', profileIds)

  for (const row of data ?? []) {
    map.set(row.profile_id, {
      review_count: row.review_count,
      average_rating: row.average_rating,
    })
  }
  return map
}

export type PublicProfile = ProfileCard & {
  about: string | null
  membership_no: string | null
  packages: {
    id: string
    title: string
    description: string | null
    service_type: ServiceType | null
    price_paise: number
    turnaround_days: number | null
  }[]
  reviews: {
    id: string
    rating: number
    title: string | null
    body: string | null
    reviewer_name: string
    created_at: string
  }[]
}

export async function getPublicProfile(slug: string): Promise<PublicProfile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('ca_profiles')
    .select(
      'id,slug,display_name,headline,about,city,state,membership_no,years_experience,languages,specialisations,is_featured'
    )
    .eq('slug', slug)
    // Belt and braces: the RLS policy already hides unpublished rows, but an
    // explicit filter means a future policy change cannot quietly expose a
    // draft profile through this function.
    .eq('is_published', true)
    .maybeSingle()

  if (!data) return null

  const [{ data: packages }, { data: reviews }, ratings] = await Promise.all([
    supabase
      .from('ca_packages')
      .select('id,title,description,service_type,price_paise,turnaround_days')
      .eq('profile_id', data.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('price_paise'),
    supabase
      .from('reviews')
      .select('id,rating,title,body,reviewer_name,created_at')
      .eq('profile_id', data.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(50),
    ratingsFor([data.id]),
  ])

  const rating = ratings.get(data.id)
  const prices = (packages ?? []).map((p) => p.price_paise)

  return {
    ...data,
    review_count: rating?.review_count ?? 0,
    average_rating: rating?.average_rating ?? null,
    from_price_paise: prices.length > 0 ? Math.min(...prices) : null,
    packages: packages ?? [],
    reviews: reviews ?? [],
  }
}

/** Cities that actually have a listing, for the search filter. */
export async function listMarketplaceCities(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ca_profiles')
    .select('city')
    .eq('is_published', true)
    .not('city', 'is', null)

  return [...new Set((data ?? []).map((r) => r.city).filter((c): c is string => Boolean(c)))].sort()
}
