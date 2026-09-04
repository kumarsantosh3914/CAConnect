import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <Link href="/">
        <Logo className="text-xl" markClassName="size-7" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
