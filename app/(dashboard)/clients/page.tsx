import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Clients' }

export default function Page() {
  return <PageHeader title="Clients" />
}
