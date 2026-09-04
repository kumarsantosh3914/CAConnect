import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            CAConnect
          </Link>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/how-it-works" />}>
              How it works
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/pricing" />}>
              Pricing
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
              Log in
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
              Start free
            </Button>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CAConnect · Built for Indian CA firms</p>
          <nav className="flex gap-4">
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
