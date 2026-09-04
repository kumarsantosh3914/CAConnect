/**
 * Env access in one place, so a missing key fails loudly at the boundary
 * instead of surfacing as a confusing runtime error deep in a request.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    )
  }
  return value
}

export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: () =>
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  openaiApiKey: () => required('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
  openaiModel: () => process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  resendApiKey: () => required('RESEND_API_KEY', process.env.RESEND_API_KEY),
  resendFrom: () => process.env.RESEND_FROM_EMAIL || 'CAConnect <onboarding@resend.dev>',
  cronSecret: () => required('CRON_SECRET', process.env.CRON_SECRET),
  /**
   * The origin used to build client-facing upload links.
   *
   * Falls back to Vercel's stable production domain so those links are correct
   * on the very first deploy. Without this, a fresh deploy sends clients a
   * WhatsApp link pointing at localhost — the document collection feature
   * would look broken to the CA's client, not to the CA.
   *
   * VERCEL_PROJECT_PRODUCTION_URL is the project's stable domain, not the
   * per-deployment VERCEL_URL, so a preview build never mints links that die
   * when the next deployment supersedes it. Both callers are server-side, so
   * an unprefixed Vercel variable is fine here.
   *
   * Set NEXT_PUBLIC_APP_URL explicitly once a custom domain exists — it wins.
   */
  appUrl: () => {
    const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
    if (explicit) return explicit.replace(/\/$/, '')

    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

    return 'http://localhost:3000'
  },
}
