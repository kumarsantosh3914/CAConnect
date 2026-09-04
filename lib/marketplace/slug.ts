/**
 * Public profile slugs: /ca/<slug>.
 *
 * Built from the firm's public name and city, so the URL reads like the thing
 * it points at — "sharma-associates-pune" rather than a uuid. It has to match
 * the CHECK constraint in migration 0011 exactly, so the two are tested
 * together.
 */

const MAX_LENGTH = 60

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks, so "Bengalūru" becomes "bengaluru" rather than
    // losing the letter entirely.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '')
}

export function profileSlug(displayName: string, city?: string | null): string {
  const base = slugify([displayName, city].filter(Boolean).join(' '))
  // A name of only punctuation would slugify to nothing, and an empty slug
  // fails the CHECK. Fall back to something valid rather than erroring at the
  // database on what is really a naming problem.
  return base || 'ca-firm'
}

/**
 * Appends -2, -3 … until the slug is free.
 *
 * `taken` is passed in rather than queried here so this stays a pure function
 * the tests can pin.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`
    const candidate = base.slice(0, MAX_LENGTH - suffix.length) + suffix
    if (!taken.has(candidate)) return candidate
  }
  // Vanishingly unlikely; a random tail beats throwing at a CA mid-publish.
  return `${base.slice(0, MAX_LENGTH - 7)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Mirrors the CHECK in 0011: lowercase alphanumerics, single hyphens. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
}
