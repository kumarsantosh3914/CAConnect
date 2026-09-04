'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { generateShareToken, isValidTokenFormat } from '@/lib/tokens'
import { requestOrigin } from '@/lib/url'
import { sendEmail } from '@/lib/email/send'
import { bookingReceivedEmail } from '@/lib/email/templates'

/**
 * Consumer-side actions. The caller here has NO ACCOUNT.
 *
 * Every write goes through a SECURITY DEFINER function from migration 0011
 * rather than a direct insert, so the trustworthy values — which firm, what
 * price, what commission, what status — are all derived in the database from
 * rows the caller cannot choose. A logged-out visitor reaching these actions
 * is the `anon` role, which by design has no INSERT policy on `bookings` or
 * `reviews` at all.
 *
 * Rate limiting lives here because SQL is a poor place for it. It is
 * best-effort — serverless means several instances — which is why the
 * durable protections are in the function itself.
 */

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k)
    }
    return false
  }
  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

const bookingSchema = z.object({
  profile_id: z.string().uuid(),
  package_id: z.union([z.string().uuid(), z.literal('')]).optional(),
  contact_name: z.string().trim().min(2, 'Please enter your name').max(120),
  contact_email: z.email('Please enter a valid email'),
  contact_phone: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
})

export type BookingInput = z.infer<typeof bookingSchema>

export type BookingResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function requestBooking(input: BookingInput): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  // Keyed on the email rather than an IP: a Server Action has no clean access
  // to the request address, and one person spamming enquiries is the shape of
  // abuse this actually needs to blunt.
  if (rateLimited(`b:${parsed.data.contact_email.toLowerCase()}`)) {
    return { ok: false, error: 'Too many requests just now. Please wait a minute and try again.' }
  }

  const supabase = await createClient()
  const token = generateShareToken()

  const { error } = await supabase.rpc('create_booking', {
    p_profile_id: parsed.data.profile_id,
    p_token: token,
    p_contact_name: parsed.data.contact_name,
    p_contact_email: parsed.data.contact_email,
    p_package_id: parsed.data.package_id || null,
    p_contact_phone: parsed.data.contact_phone || null,
    p_city: parsed.data.city || null,
    p_message: parsed.data.message || null,
  })

  if (error) {
    // The function raises human-readable messages on purpose; pass them
    // through rather than replacing them with something vaguer.
    return { ok: false, error: error.message || 'Could not send that request. Please try again.' }
  }

  const url = `${await requestOrigin()}/booking/${token}`

  // The consumer's email carries their ONLY credential, so it is sent here and
  // now. The booking is already saved either way, so a send failure is not an
  // error to report — it would be misread as "your request did not go through".
  //
  // The CA is NOT emailed from here. Their address is not readable by `anon`,
  // and correctly so: a function that handed out CA emails to anyone who asked
  // would be a harvesting endpoint. The reminder cron notifies them instead,
  // where the service-role key can see firm addresses safely.
  const booking = await lookupBooking(token)
  if (booking) {
    await sendEmail({
      to: parsed.data.contact_email,
      ...bookingReceivedEmail({
        contactName: booking.contact_name,
        caName: booking.ca_display_name,
        bookingUrl: url,
        packageTitle: booking.package_title,
        amountPaise: booking.quoted_amount_paise,
      }),
    })
  }

  revalidatePath('/marketplace')
  return { ok: true, url }
}

export type ConsumerBooking = {
  id: string
  status: string
  contact_name: string
  contact_email: string
  service_type: string | null
  message: string | null
  quoted_amount_paise: number | null
  created_at: string
  completed_at: string | null
  ca_display_name: string
  ca_slug: string
  ca_city: string | null
  package_title: string | null
  has_review: boolean
}

export async function lookupBooking(token: string): Promise<ConsumerBooking | null> {
  if (!isValidTokenFormat(token)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('booking_by_token', { p_token: token })
  if (error || !data || data.length === 0) return null
  return data[0] as ConsumerBooking
}

const reviewSchema = z.object({
  token: z.string(),
  rating: z.number().int().min(1, 'Pick a rating').max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(2000).optional(),
})

export async function submitReview(
  input: z.infer<typeof reviewSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }
  if (!isValidTokenFormat(parsed.data.token)) {
    return { ok: false, error: 'That booking could not be found.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_review', {
    p_token: parsed.data.token,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title || null,
    p_body: parsed.data.body || null,
  })

  if (error) {
    return { ok: false, error: error.message || 'Could not save your review. Please try again.' }
  }

  revalidatePath(`/booking/${parsed.data.token}`)
  return { ok: true }
}
