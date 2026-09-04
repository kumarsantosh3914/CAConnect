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
  openaiModel: () => process.env.OPENAI_MODEL || 'gpt-5.6-terra',
  resendApiKey: () => required('RESEND_API_KEY', process.env.RESEND_API_KEY),
  resendFrom: () => process.env.RESEND_FROM_EMAIL || 'CAConnect <onboarding@resend.dev>',
  cronSecret: () => required('CRON_SECRET', process.env.CRON_SECRET),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000',
}
