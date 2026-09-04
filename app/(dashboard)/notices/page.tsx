import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'IT Notices' }

export default function Page() {
  return <PageHeader title="IT Notices" />
}
