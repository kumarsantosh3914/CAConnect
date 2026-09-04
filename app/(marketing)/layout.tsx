import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { MarketingNav } from '@/components/layout/marketing-nav'

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <MarketingNav />
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CAConnect · Built for Indian CA firms</p>
          <nav className="flex gap-4">
            <Link href="/find-a-ca" className="hover:text-foreground">
              Find a CA
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/how-it-works" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
