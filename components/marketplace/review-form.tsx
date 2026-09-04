'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { submitReview } from '@/lib/marketplace/booking-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

/**
 * Only reachable from a completed booking's own link, so every review written
 * here is attached to work that actually happened. That is the whole basis for
 * calling them verified.
 */
export function ReviewForm({ token, caName }: { token: string; caName: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await submitReview({ token, rating, title, body })
      if (!result.ok) setError(result.error)
      // On success the page revalidates and swaps this form for a thank-you.
    })
  }

  const shown = hovered || rating

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="font-semibold tracking-tight">How did it go?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your review appears on {caName}&apos;s profile. It is the main thing the next person has to
        go on.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-1.5 text-sm font-medium">Rating</p>
          <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                aria-pressed={rating === n}
                className="rounded p-0.5 outline-offset-2"
              >
                <Star
                  className={cn(
                    'size-7 transition-colors',
                    n <= shown
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-transparent text-muted-foreground/40'
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <Field label="Headline" htmlFor="rv-title">
          <Input
            id="rv-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sorted my GST in a week"
          />
        </Field>

        <Field label="What happened?" htmlFor="rv-body">
          <Textarea
            id="rv-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What you needed, how it went, whether you would go back."
          />
        </Field>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button className="w-full" disabled={pending || rating === 0} onClick={submit}>
          {pending ? 'Posting…' : 'Post review'}
        </Button>

        <p className="text-xs text-muted-foreground">
          You can post one review per booking, and it cannot be edited afterwards.
        </p>
      </div>
    </div>
  )
}
