'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarClock,
  FileText,
  LayoutDashboard,
  Mail,
  Receipt,
  Scale,
  Store,
  Users,
  UsersRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/deadlines', label: 'Deadlines', icon: CalendarClock },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/fees', label: 'Fees', icon: Receipt },
  { href: '/notices', label: 'IT Notices', icon: Scale },
  { href: '/client-emails', label: 'Client Emails', icon: Mail },
  { href: '/team', label: 'Team', icon: UsersRound },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
