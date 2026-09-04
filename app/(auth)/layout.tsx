import Link from 'next/link'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        CAConnect
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
