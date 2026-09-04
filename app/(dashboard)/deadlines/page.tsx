import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Deadlines' }

export default function Page() {
  return <PageHeader title="Deadlines" />
}
