import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'
import { listNotices, noticeTrackerTotals } from '@/lib/notices/queries'
import { NoticesList } from '@/components/notices/notices-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'IT Notices' }

export default async function NoticesPage() {
  const [notices, total] = await Promise.all([listNotices(), noticeTrackerTotals()])

  return (
    <>
      <PageHeader
        title="Notice Tracker"
        description={`₹${(total / 100).toLocaleString('en-IN')} in open matters.`}
        action={
          <div className="flex gap-2"><Button variant="outline" nativeButton={false} render={<Link href="/notices/new" />}><Sparkles className="size-4" aria-hidden />Draft a reply</Button><Button nativeButton={false} render={<Link href="/notices/new-matter" />}><Plus className="size-4" aria-hidden />Add matter</Button></div>
        }
      />
      <NoticesList notices={notices} />
    </>
  )
}
