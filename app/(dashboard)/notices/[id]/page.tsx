import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getNotice } from '@/lib/notices/queries'
import { NoticeDetail } from '@/components/notices/notice-detail'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export async function generateMetadata(props: PageProps<'/notices/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const notice = await getNotice(id)
  return { title: notice?.title ?? 'Notice' }
}

export default async function NoticePage(props: PageProps<'/notices/[id]'>) {
  const { id } = await props.params
  const notice = await getNotice(id)

  // RLS returns nothing for another CA's notice, so "not found" and "not
  // yours" are indistinguishable here — which is correct.
  if (!notice) notFound()

  return (
    <>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/notices" />}>
        <ArrowLeft className="size-4" aria-hidden />
        All notices
      </Button>

      <PageHeader
        title={notice.title}
        description={`Drafted ${formatDateTime(notice.created_at)}${notice.model ? ` · ${notice.model}` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {notice.notice_type && <Badge variant="outline">{notice.notice_type}</Badge>}
            {notice.client_id && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/clients/${notice.client_id}`} />}
              >
                {notice.clients?.name ?? 'Client'}
              </Button>
            )}
          </div>
        }
      />

      <NoticeDetail
        noticeId={notice.id}
        title={notice.title}
        noticeText={notice.notice_text}
        draftResponse={notice.draft_response}
        editedResponse={notice.edited_response}
      />
    </>
  )
}
