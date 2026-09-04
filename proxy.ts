import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`. Same behaviour.
 *
 * Two jobs:
 *   1. Refresh the Supabase session cookie so Server Components see a live session.
 *   2. Optimistic redirect for signed-out visitors hitting the dashboard.
 *
 * (2) is a UX nicety, NOT the security boundary. Every page and API route
 * re-checks the user server-side via requireUser(), and RLS is the real
 * backstop. Per the Next.js docs, proxy should not be treated as an
 * authorization solution.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // getUser() revalidates the token with Supabase — getSession() would trust
  // whatever the cookie says, which is not good enough for a redirect decision.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/clients',
  '/deadlines',
  '/documents',
  '/fees',
  '/notices',
  '/settings',
  '/onboarding',
]

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files, and the anonymous
     * client-upload paths.
     *
     * /upload and /api/upload are excluded deliberately: they must work with
     * no session, and running getUser() there would add a Supabase round-trip
     * to every request from a client's phone for a session that never exists.
     */
    '/((?!_next/static|_next/image|favicon.ico|upload/|api/upload/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
