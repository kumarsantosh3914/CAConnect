import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Link href="/">
        <Logo className="text-xl" markClassName="size-7" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
