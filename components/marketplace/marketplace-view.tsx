'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  deletePackage,
  respondToBooking,
  savePackage,
  saveProfile,
  setPackageActive,
  setProfilePublished,
} from '@/app/(dashboard)/marketplace/actions'
import type { MyProfile } from '@/lib/marketplace/queries'
import type { BookingSummary } from '@/lib/marketplace/queries'
import type { CaPackageRow, ServiceType } from '@/types/database'
import { RatingStars } from './rating-stars'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, formatPaise, paiseToRupees, serviceLabel } from '@/lib/format'

const SERVICES: ServiceType[] = [
  'itr',
  'gstr1',
  'gstr3b',
  'tds',
  'roc',
  'company_registration',
  'other',
]

type Review = {
  id: string
  rating: number
  title: string | null
  body: string | null
  reviewer_name: string
  is_published: boolean
  created_at: string
}

export function MarketplaceView({
  firmName,
  firmCity,
  isOwner,
  profile,
  packages,
  bookings,
  reviews,
  newBookings,
  publicUrl,
}: {
  firmName: string | null
  firmCity: string | null
  isOwner: boolean
  profile: MyProfile | null
  packages: CaPackageRow[]
  bookings: BookingSummary[]
  reviews: Review[]
  newBookings: number
  publicUrl: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  function run(action: () => Promise<{ ok: boolean; error?: string; note?: string }>, success: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error ?? 'Something went wrong.')
        return
      }
      toast.success(result.note ?? success)
      router.refresh()
    })
  }

  return (
    <Tabs defaultValue={profile ? 'bookings' : 'listing'}>
      <TabsList>
        <TabsTrigger value="listing">Listing</TabsTrigger>
        <TabsTrigger value="packages">Packages ({packages.length})</TabsTrigger>
        <TabsTrigger value="bookings">
          Bookings {newBookings > 0 ? `(${newBookings} new)` : ''}
        </TabsTrigger>
        <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="listing">
        <ListingTab
          firmName={firmName}
          firmCity={firmCity}
          isOwner={isOwner}
          profile={profile}
          publicUrl={publicUrl}
          pending={pending}
          copied={copied}
          setCopied={setCopied}
          run={run}
        />
      </TabsContent>

      <TabsContent value="packages">
        <PackagesTab profile={profile} packages={packages} pending={pending} run={run} />
      </TabsContent>

      <TabsContent value="bookings">
        <BookingsTab bookings={bookings} pending={pending} run={run} />
      </TabsContent>

      <TabsContent value="reviews">
        {reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Clients can review you once you mark their booking complete. You cannot edit or delete reviews — that is what makes them worth reading."
          />
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RatingStars rating={review.rating} count={1} className="[&>span:last-child]:hidden" />
                  <span className="text-xs text-muted-foreground">
                    {review.reviewer_name} · {formatDate(review.created_at)}
                  </span>
                </div>
                {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                {review.body && (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                    {review.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}

type Runner = (
  action: () => Promise<{ ok: boolean; error?: string; note?: string }>,
  success: string
) => void

function ListingTab({
  firmName,
  firmCity,
  isOwner,
  profile,
  publicUrl,
  pending,
  copied,
  setCopied,
  run,
}: {
  firmName: string | null
  firmCity: string | null
  isOwner: boolean
  profile: MyProfile | null
  publicUrl: string | null
  pending: boolean
  copied: boolean
  setCopied: (v: boolean) => void
  run: Runner
}) {
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? firmName ?? '',
    headline: profile?.headline ?? '',
    about: profile?.about ?? '',
    city: profile?.city ?? firmCity ?? '',
    state: profile?.state ?? '',
    membership_no: profile?.membership_no ?? '',
    years_experience: profile?.years_experience?.toString() ?? '',
    languages: (profile?.languages ?? []).join(', '),
    specialisations: new Set<ServiceType>(profile?.specialisations ?? []),
  })

  function toggle(service: ServiceType) {
    setForm((f) => {
      const next = new Set(f.specialisations)
      if (next.has(service)) next.delete(service)
      else next.add(service)
      return { ...f, specialisations: next }
    })
  }

  function save() {
    run(
      () =>
        saveProfile({
          display_name: form.display_name,
          headline: form.headline,
          about: form.about,
          city: form.city,
          state: form.state,
          membership_no: form.membership_no,
          years_experience: form.years_experience ? Number(form.years_experience) : undefined,
          languages: form.languages
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean),
          specialisations: [...form.specialisations],
        }),
      'Listing saved.'
    )
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy.')
    }
  }

  return (
    <div className="space-y-4">
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {profile.is_published ? 'Live on the marketplace' : 'Not listed yet'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.is_published && publicUrl ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={publicUrl} className="font-mono text-xs" aria-label="Public profile link" />
                  <Button variant="outline" size="icon" onClick={() => copy(publicUrl)}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    <span className="sr-only">Copy link</span>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={publicUrl} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    View public page
                  </Button>
                  {isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => setProfilePublished(false), 'Listing withdrawn.')}
                    >
                      Withdraw listing
                    </Button>
                  )}
                  <RatingStars rating={profile.average_rating} count={profile.review_count} />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Your listing is saved but not visible to anyone. Publishing puts you in search
                  results at /find-a-ca. You can withdraw at any time.
                </p>
                {isOwner ? (
                  <Button
                    disabled={pending}
                    onClick={() => run(() => setProfilePublished(true), 'You are live on the marketplace.')}
                  >
                    Go live
                  </Button>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Only the firm owner can list the firm publicly.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your public listing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This is what someone looking for a CA sees. Your clients&apos; details, your fees and
            everything else in CAConnect stay private — only what is on this form is public.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Public name" htmlFor="mp-name" required>
              <Input
                id="mp-name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </Field>
            <Field label="ICAI membership no." htmlFor="mp-icai" hint="Shown as a trust signal">
              <Input
                id="mp-icai"
                value={form.membership_no}
                onChange={(e) => setForm((f) => ({ ...f, membership_no: e.target.value }))}
              />
            </Field>
            <Field label="City" htmlFor="mp-city" required hint="How clients search">
              <Input
                id="mp-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </Field>
            <Field label="State" htmlFor="mp-state">
              <Input
                id="mp-state"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </Field>
            <Field label="Years of experience" htmlFor="mp-years">
              <Input
                id="mp-years"
                type="number"
                min={0}
                max={70}
                value={form.years_experience}
                onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))}
              />
            </Field>
            <Field label="Languages" htmlFor="mp-langs" hint="Comma separated">
              <Input
                id="mp-langs"
                value={form.languages}
                onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
                placeholder="Hindi, English, Marathi"
              />
            </Field>
          </div>

          <Field label="Headline" htmlFor="mp-headline" hint="One line, shown in search results">
            <Input
              id="mp-headline"
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
              placeholder="GST and ITR for small businesses in Pune"
            />
          </Field>

          <Field label="About" htmlFor="mp-about">
            <Textarea
              id="mp-about"
              rows={5}
              value={form.about}
              onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
              placeholder="Who you work with and what you are good at."
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium">Specialisations</p>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((service) => {
                const on = form.specialisations.has(service)
                return (
                  <Button
                    key={service}
                    type="button"
                    size="sm"
                    variant={on ? 'default' : 'outline'}
                    onClick={() => toggle(service)}
                  >
                    {serviceLabel(service)}
                  </Button>
                )
              })}
            </div>
          </div>

          <Button disabled={pending || !form.display_name.trim()} onClick={save}>
            {profile ? 'Save listing' : 'Create listing'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function PackagesTab({
  profile,
  packages,
  pending,
  run,
}: {
  profile: MyProfile | null
  packages: CaPackageRow[]
  pending: boolean
  run: Runner
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CaPackageRow | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    service_type: '' as ServiceType | '',
    price_rupees: '',
    turnaround_days: '',
  })

  function openNew() {
    setEditing(null)
    setForm({ title: '', description: '', service_type: '', price_rupees: '', turnaround_days: '' })
    setOpen(true)
  }

  function openEdit(pkg: CaPackageRow) {
    setEditing(pkg)
    setForm({
      title: pkg.title,
      description: pkg.description ?? '',
      service_type: pkg.service_type ?? '',
      price_rupees: String(paiseToRupees(pkg.price_paise)),
      turnaround_days: pkg.turnaround_days?.toString() ?? '',
    })
    setOpen(true)
  }

  function save() {
    run(
      () =>
        savePackage({
          id: editing?.id,
          title: form.title,
          description: form.description,
          service_type: form.service_type,
          price_rupees: form.price_rupees,
          turnaround_days: form.turnaround_days ? Number(form.turnaround_days) : undefined,
        }),
      editing ? 'Package updated.' : 'Package added.'
    )
    setOpen(false)
  }

  if (!profile) {
    return (
      <EmptyState
        title="Create your listing first"
        description="Packages hang off your public listing, so that has to exist before you can price anything."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          A fixed price is the whole reason someone picks you over a phone call to three offices.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" aria-hidden />
          Add package
        </Button>
      </div>

      {packages.length === 0 ? (
        <EmptyState
          title="No packages yet"
          description="Add one or two of your most common jobs with a real price on them."
        />
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) => (
            <li key={pkg.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{pkg.title}</p>
                    {!pkg.is_active && <Badge variant="secondary">Hidden</Badge>}
                    {pkg.service_type && (
                      <Badge variant="outline">{serviceLabel(pkg.service_type)}</Badge>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                  )}
                  {pkg.turnaround_days && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Usually {pkg.turnaround_days} day{pkg.turnaround_days === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatPaise(pkg.price_paise)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(pkg)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setPackageActive(pkg.id, !pkg.is_active),
                      pkg.is_active ? 'Package hidden.' : 'Package shown.'
                    )
                  }
                >
                  {pkg.is_active ? 'Hide' : 'Show'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => deletePackage(pkg.id), 'Package removed.')}
                >
                  <Trash2 className="size-4" aria-hidden />
                  <span className="sr-only">Remove {pkg.title}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit package' : 'Add a package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Title" htmlFor="pk-title" required>
              <Input
                id="pk-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Company Registration"
              />
            </Field>
            <Field label="Price (₹)" htmlFor="pk-price" required>
              <Input
                id="pk-price"
                inputMode="decimal"
                value={form.price_rupees}
                onChange={(e) => setForm((f) => ({ ...f, price_rupees: e.target.value }))}
                placeholder="15000"
              />
            </Field>
            <Field label="Service" htmlFor="pk-service">
              <select
                id="pk-service"
                value={form.service_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_type: e.target.value as ServiceType | '' }))
                }
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">None</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {serviceLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Turnaround (days)" htmlFor="pk-days">
              <Input
                id="pk-days"
                type="number"
                min={1}
                value={form.turnaround_days}
                onChange={(e) => setForm((f) => ({ ...f, turnaround_days: e.target.value }))}
              />
            </Field>
            <Field label="Description" htmlFor="pk-desc">
              <Textarea
                id="pk-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is included, and what is not."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !form.title.trim() || !form.price_rupees.trim()} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BookingsTab({
  bookings,
  pending,
  run,
}: {
  bookings: BookingSummary[]
  pending: boolean
  run: Runner
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Enquiries from the marketplace land here. Accepting one adds the person to your client list automatically."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{booking.contact_name}</p>
                <StatusBadge status={booking.status} />
                {booking.client_name && <Badge variant="secondary">In your clients</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <a href={`mailto:${booking.contact_email}`} className="hover:underline">
                  {booking.contact_email}
                </a>
                {booking.contact_phone && (
                  <>
                    {' · '}
                    <a href={`tel:${booking.contact_phone}`} className="hover:underline">
                      {booking.contact_phone}
                    </a>
                  </>
                )}
                {booking.city ? ` · ${booking.city}` : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {booking.package_title ?? 'General enquiry'} · {formatDate(booking.created_at)}
              </p>
              {booking.message && (
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {booking.message}
                </p>
              )}
            </div>

            <div className="text-right">
              {booking.quoted_amount_paise !== null && (
                <p className="font-semibold">{formatPaise(booking.quoted_amount_paise)}</p>
              )}
              {booking.commission_paise !== null && booking.commission_paise > 0 && (
                // Shown so nothing about the commercial arrangement is a
                // surprise later. Nothing is charged today — there is no
                // gateway — and the CA keeps their full fee.
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatPaise(booking.commission_paise)} platform fee
                  <br />
                  <span className="text-[11px]">
                    from the client, not you · not charged yet
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {booking.status === 'requested' && (
              <>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => respondToBooking(booking.id, 'accepted'), 'Booking accepted.')}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => respondToBooking(booking.id, 'declined'), 'Booking declined.')}
                >
                  Decline
                </Button>
              </>
            )}
            {booking.status === 'accepted' && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => respondToBooking(booking.id, 'completed'), 'Marked complete.')}
              >
                Mark complete
              </Button>
            )}
          </div>

          {booking.status === 'accepted' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Marking it complete is what lets the client leave a review.
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
