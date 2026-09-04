import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Run your CA firm without the chaos
      </h1>
      <p className="text-muted-foreground">
        Client deadlines, document collection, fees and AI-drafted IT notice responses — in one
        place, built for small Indian CA firms.
      </p>
      <div className="flex gap-3">
        <Button size="lg" render={<Link href="/signup" />}>
          Start Free — No Credit Card
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/login" />}>
          Log in
        </Button>
      </div>
    </main>
  )
}
