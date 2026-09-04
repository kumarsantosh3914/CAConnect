'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { profileSlug, uniqueSlug } from '@/lib/marketplace/slug'
import { planLimits } from '@/lib/plans'
import { rupeesToPaise } from '@/lib/format'
import type { BookingRow, ServiceType } from '@/types/database'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const SERVICES = [
  'itr',
  'gstr1',
  'gstr3b',
  'tds',
  'roc',
  'company_registration',
  'other',
] as const

const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Your public name is required').max(120),
  headline: z.string().trim().max(160).optional(),
  about: z.string().trim().max(3000).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  membership_no: z.string().trim().max(40).optional(),
  years_experience: z.number().int().min(0).max(70).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(10),
  specialisations: z.array(z.enum(SERVICES)).max(SERVICES.length),
})

export type ProfileInput = z.infer<typeof profileSchema>

/**
 * Creates or updates the firm's public listing.
 *
 * The slug is set once, on creation, and never changed afterwards. A published
 * profile's URL may already be in a WhatsApp message or a search index, and
 * silently moving it would 404 every one of those.
 */
export async function saveProfile(input: ProfileInput): Promise<ActionResult<{ slug: string }>> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('ca_profiles')
    .select('id,slug')
    .eq('firm_id', firm.firmId)
    .maybeSingle()

  const fields = {
    display_name: parsed.data.display_name,
    headline: parsed.data.headline || null,
    about: parsed.data.about || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    membership_no: parsed.data.membership_no || null,
    years_experience: parsed.data.years_experience ?? null,
    languages: parsed.data.languages,
    specialisations: parsed.data.specialisations as ServiceType[],
  }

  if (existing) {
    const { error } = await supabase.from('ca_profiles').update(fields).eq('id', existing.id)
    if (error) return { ok: false, error: 'Could not save your listing. Please try again.' }
    revalidatePath('/marketplace')
    revalidatePath(`/ca/${existing.slug}`)
    return { ok: true, slug: existing.slug }
  }

  // Slugs are globally unique, so the candidates already in use have to be
  // read across every firm — one of the few queries that legitimately looks
  // beyond the caller's own tenant, and safe because a slug is public anyway.
  const base = profileSlug(fields.display_name, fields.city)
  const { data: taken } = await supabase
    .from('ca_profiles')
    .select('slug')
    .like('slug', `${base}%`)
  const slug = uniqueSlug(base, new Set((taken ?? []).map((row) => row.slug)))

  const { error } = await supabase.from('ca_profiles').insert({
    firm_id: firm.firmId,
    created_by: user.id,
    slug,
    ...fields,
  })
  if (error) return { ok: false, error: 'Could not create your listing. Please try again.' }

  revalidatePath('/marketplace')
  return { ok: true, slug }
}

/**
 * Publishing is the opt-in the vision doc calls for: a firm appears in the
 * marketplace only when it says so, and can withdraw at any time.
 */
export async function setProfilePublished(published: boolean): Promise<ActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { firm } = ctx

  if (firm.role !== 'owner') {
    return { ok: false, error: 'Only the firm owner can list the firm publicly.' }
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('ca_profiles')
    .select('id,display_name,city,slug')
    .eq('firm_id', firm.firmId)
    .maybeSingle()

  if (!profile) return { ok: false, error: 'Create your listing first.' }

  if (published && !profile.city) {
    // City is how the marketplace is searched. Publishing without one puts a
    // firm in a listing nobody filtering by city will ever see.
    return { ok: false, error: 'Add your city before going live — it is how clients search.' }
  }

  const { error } = await supabase
    .from('ca_profiles')
    .update({
      is_published: published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq('id', profile.id)

  if (error) return { ok: false, error: 'Could not update your listing.' }

  revalidatePath('/marketplace')
  revalidatePath('/find-a-ca')
  revalidatePath(`/ca/${profile.slug}`)
  return { ok: true }
}

const packageSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, 'Give the package a name').max(120),
  description: z.string().trim().max(1000).optional(),
  service_type: z.union([z.enum(SERVICES), z.literal('')]).optional(),
  price_rupees: z.string().trim().min(1, 'Set a price'),
  turnaround_days: z.number().int().min(1).max(365).optional(),
})

export type PackageInput = z.infer<typeof packageSchema>

export async function savePackage(input: PackageInput): Promise<ActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const parsed = packageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  let pricePaise: number
  try {
    pricePaise = rupeesToPaise(parsed.data.price_rupees)
  } catch {
    return { ok: false, error: 'Enter a valid price.' }
  }
  if (pricePaise < 0) return { ok: false, error: 'A price cannot be negative.' }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('ca_profiles')
    .select('id')
    .eq('firm_id', firm.firmId)
    .maybeSingle()
  if (!profile) return { ok: false, error: 'Create your listing first.' }

  const fields = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    service_type: (parsed.data.service_type || null) as ServiceType | null,
    price_paise: pricePaise,
    turnaround_days: parsed.data.turnaround_days ?? null,
  }

  const { error } = parsed.data.id
    ? await supabase
        .from('ca_packages')
        .update(fields)
        .eq('id', parsed.data.id)
        .eq('profile_id', profile.id)
    : await supabase.from('ca_packages').insert({
        firm_id: firm.firmId,
        created_by: user.id,
        profile_id: profile.id,
        ...fields,
      })

  if (error) return { ok: false, error: 'Could not save that package. Please try again.' }

  revalidatePath('/marketplace')
  return { ok: true }
}

export async function setPackageActive(packageId: string, active: boolean): Promise<ActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ca_packages')
    .update({ is_active: active })
    .eq('id', packageId)

  if (error) return { ok: false, error: 'Could not update that package.' }
  revalidatePath('/marketplace')
  return { ok: true }
}

export async function deletePackage(packageId: string): Promise<ActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase.from('ca_packages').delete().eq('id', packageId)
  if (error) return { ok: false, error: 'Could not remove that package.' }
  revalidatePath('/marketplace')
  return { ok: true }
}

/**
 * Accepting a booking turns an enquiry into a client, which is the whole point
 * of the marketplace feeding the practice tool.
 *
 * The client is created on a best-effort basis: if the firm is at its plan's
 * client cap, the booking is still accepted and the CA is told separately.
 * Refusing inbound work because of a billing limit would be the wrong trade
 * every single time.
 */
export async function respondToBooking(
  bookingId: string,
  status: 'accepted' | 'declined' | 'completed' | 'cancelled'
): Promise<ActionResult<{ note?: string }>> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id,contact_name,contact_email,contact_phone,city,service_type,client_id,status')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'That booking could not be found.' }

  const patch: Partial<BookingRow> = { status }
  if (status === 'accepted' || status === 'declined') {
    patch.responded_at = new Date().toISOString()
  }
  if (status === 'completed') patch.completed_at = new Date().toISOString()

  let note: string | undefined

  if (status === 'accepted' && !booking.client_id) {
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)

    if ((count ?? 0) >= planLimits(firm.plan).maxClients) {
      note = `Accepted. Your ${planLimits(firm.plan).name} plan is at its client limit, so this booking was not added to your client list.`
    } else {
      const { data: client } = await supabase
        .from('clients')
        .insert({
          firm_id: firm.firmId,
          created_by: user.id,
          name: booking.contact_name,
          email: booking.contact_email,
          phone: booking.contact_phone,
          notes: 'Added from a marketplace booking.',
        })
        .select('id')
        .single()
      if (client) patch.client_id = client.id
    }
  }

  const { error } = await supabase.from('bookings').update(patch).eq('id', bookingId)
  if (error) return { ok: false, error: 'Could not update that booking.' }

  revalidatePath('/marketplace')
  revalidatePath('/clients')
  return note ? { ok: true, note } : { ok: true }
}
