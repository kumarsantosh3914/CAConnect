'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/theme-toggle'

/**
 * The public header.
 *
 * There are five destinations here and a 390px phone cannot hold them in one
 * row — laying them out inline made the whole page scroll sideways, which is
 * how most Indian CAs will first see this. So below `sm` everything except the
 * primary action collapses behind a menu.
 *
 * "Find a CA" leads because it is the one link addressed to a different person
 * entirely: someone looking to hire, not to buy software.
 */
const LINKS = [
  { href: '/find-a-ca', label: 'Find a CA' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
] as const

export function MarketingNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <nav className="hidden items-center gap-1 sm:flex">
        {LINKS.map((link) => (
          <Button
            key={link.href}
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={link.href} />}
          >
            {link.label}
          </Button>
        ))}
        <ThemeToggle />
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
          Log in
        </Button>
        <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
          Start free
        </Button>
      </nav>

      {/* Mobile: the primary action stays visible; the rest collapses. */}
      <div className="flex items-center gap-1 sm:hidden">
        <ThemeToggle />
        <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
          Start free
        </Button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          // 44px, the minimum reliable tap target on a phone.
          className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-expanded={open}
          aria-controls="marketing-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <div
          id="marketing-menu"
          className="absolute inset-x-0 top-14 border-b bg-background p-2 shadow-sm sm:hidden"
        >
          <nav className="mx-auto flex w-full max-w-5xl flex-col">
            {[...LINKS, { href: '/login', label: 'Log in' }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
