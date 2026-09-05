import Link from 'next/link'
import { requireUser, getFirmContext } from '@/lib/auth'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { UserMenu } from '@/components/layout/user-menu'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  // proxy.ts already redirected signed-out visitors, but that is an optimistic
  // check. This is the real gate.
  const user = await requireUser()

  // Not requireFirm(): onboarding lives inside this layout, and a user who has
  // not created a firm yet must be able to reach it rather than be bounced.
  const firm = await getFirmContext()

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 p-4 md:flex">
        <Link href="/dashboard" className="mb-6 px-3">
          <Logo className="text-lg" />
        </Link>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
          <Link href="/dashboard" className="md:hidden">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={user.email ?? ''} firmName={firm?.name ?? null} />
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
