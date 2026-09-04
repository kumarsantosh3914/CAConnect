import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ratings are the trust signal a first-time CA seeker leans on hardest, so an
 * unrated firm must not look like a badly rated one. No stars at all is the
 * honest rendering of "nobody has reviewed this firm yet".
 */
export function RatingStars({
  rating,
  count,
  className,
}: {
  rating: number | null
  count: number
  className?: string
}) {
  if (rating === null || count === 0) {
    return <span className={cn('text-xs text-muted-foreground', className)}>No reviews yet</span>
  }

  return (
    <span className={cn('flex items-center gap-1 text-sm', className)}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              'size-3.5',
              n <= Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/40'
            )}
          />
        ))}
      </span>
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({count} {count === 1 ? 'review' : 'reviews'})
      </span>
    </span>
  )
}
