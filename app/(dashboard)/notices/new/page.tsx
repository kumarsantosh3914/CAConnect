import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { listClients } from '@/lib/clients/queries'
import { NoticeDrafter } from '@/components/notices/notice-drafter'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Draft a notice reply' }

export default async function NewNoticePage() {
  const clients = await listClients()

  return (
    <>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/notices" />}>
        <ArrowLeft className="size-4" aria-hidden />
        All notices
      </Button>
      <PageHeader
        title="Draft a notice reply"
        description="Paste an Income Tax or GST notice and get a formal draft in Indian legal language."
      />
      <NoticeDrafter clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  )
}
