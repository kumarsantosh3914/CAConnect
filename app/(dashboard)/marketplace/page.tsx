import type { Metadata } from 'next'
import { requireFirm } from '@/lib/auth'
import { getMyProfile, listMyBookings, listMyPackages, listMyReviews } from '@/lib/marketplace/queries'
import { MarketplaceView } from '@/components/marketplace/marketplace-view'
import { PageHeader } from '@/components/ui/page-header'
import { requestOrigin } from '@/lib/url'

export const metadata: Metadata = { title: 'Marketplace' }

export default async function MarketplacePage() {
  const { firm } = await requireFirm()

  const profile = await getMyProfile(firm.firmId)
  const [packages, bookings, reviews, origin] = await Promise.all([
    profile ? listMyPackages(profile.id) : Promise.resolve([]),
    listMyBookings(firm.firmId),
    listMyReviews(firm.firmId),
    requestOrigin(),
  ])

  const newBookings = bookings.filter((b) => b.status === 'requested').length

  return (
    <>
      <PageHeader
        title="Marketplace"
        description={
          profile?.is_published
            ? 'Your firm is listed publicly. Clients can find you and request work.'
            : 'List your firm publicly so clients searching for a CA can find you.'
        }
      />
      <MarketplaceView
        firmName={firm.name}
        firmCity={firm.city}
        isOwner={firm.role === 'owner'}
        profile={profile}
        packages={packages}
        bookings={bookings}
        reviews={reviews}
        newBookings={newBookings}
        publicUrl={profile ? `${origin}/ca/${profile.slug}` : null}
      />
    </>
  )
}
