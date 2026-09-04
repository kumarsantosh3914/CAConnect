import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="What needs your attention today." />
      <p className="text-sm text-muted-foreground">Coming together this week.</p>
    </>
  )
}
