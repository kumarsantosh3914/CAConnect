import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { UserMenu } from '@/components/layout/user-menu'

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  // proxy.ts already redirected signed-out visitors, but that is an optimistic
  // check. This is the real gate.
  const user = await requireUser()

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 p-4 md:flex">
        <Link href="/dashboard" className="mb-6 px-3 text-lg font-semibold tracking-tight">
          CAConnect
        </Link>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
          <Link href="/dashboard" className="font-semibold tracking-tight md:hidden">
            CAConnect
          </Link>
          <div className="ml-auto">
            <UserMenu email={user.email ?? ''} firmName={profile?.firm_name ?? null} />
          </div>
        </header>

        {/* Mobile nav — CAs work on laptops, but a phone check-in should still work. */}
        <div className="border-b px-4 py-2 md:hidden">
          <SidebarNav />
        </div>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
