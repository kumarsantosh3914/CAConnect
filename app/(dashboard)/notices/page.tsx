import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { listNotices } from '@/lib/notices/queries'
import { NoticesList } from '@/components/notices/notices-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'IT Notices' }

export default async function NoticesPage() {
  const notices = await listNotices()

  return (
    <>
      <PageHeader
        title="IT Notices"
        description="Formal draft replies to Income Tax and GST notices."
        action={
          <Button nativeButton={false} render={<Link href="/notices/new" />}>
            <Sparkles className="size-4" aria-hidden />
            Draft a reply
          </Button>
        }
      />
      <NoticesList notices={notices} />
    </>
  )
}
