import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BookingRow, CaPackageRow, CaProfileRow } from '@/types/database'

/**
 * CA-side reads. All firm-scoped by RLS, so an id from another firm simply
 * returns nothing.
 */

export type MyProfile = CaProfileRow & {
  review_count: number
  average_rating: number | null
}

export async function getMyProfile(firmId: string): Promise<MyProfile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('ca_profiles')
    .select('*')
    .eq('firm_id', firmId)
    .maybeSingle()

  if (!data) return null

  const { data: rating } = await supabase
    .from('ca_profile_ratings')
    .select('review_count,average_rating')
    .eq('profile_id', data.id)
    .maybeSingle()

  return {
    ...data,
    review_count: rating?.review_count ?? 0,
    average_rating: rating?.average_rating ?? null,
  }
}

export async function listMyPackages(profileId: string): Promise<CaPackageRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ca_packages')
    .select('*')
    .eq('profile_id', profileId)
    .order('sort_order')
    .order('created_at')
  return data ?? []
}

export type BookingSummary = BookingRow & {
  package_title: string | null
  client_name: string | null
}

export async function listMyBookings(firmId: string): Promise<BookingSummary[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select('*,ca_packages(title),clients(name)')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => {
    const { ca_packages, clients, ...booking } = row as typeof row & {
      ca_packages: { title: string } | null
      clients: { name: string } | null
    }
    return {
      ...(booking as BookingRow),
      package_title: ca_packages?.title ?? null,
      client_name: clients?.name ?? null,
    }
  })
}

/** Reviews of this firm, including any that have been unpublished. */
export async function listMyReviews(firmId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('id,rating,title,body,reviewer_name,is_published,created_at')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })
  return data ?? []
}
