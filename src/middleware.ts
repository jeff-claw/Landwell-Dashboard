import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { pathToPageKey, canAccess } from '@/lib/pages'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except auth pages and certain API routes)
  const isPublicApi = request.nextUrl.pathname.startsWith('/api/migrate') ||
                      request.nextUrl.pathname.startsWith('/api/upload-image') ||
                      request.nextUrl.pathname.startsWith('/api/exchange-rate') ||
                      request.nextUrl.pathname.startsWith('/api/create-profile')
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/signup') && !isPublicApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Per-user page access control. Founders bypass; null page_access = full access.
  if (user) {
    const path = request.nextUrl.pathname
    const isAppPage = !path.startsWith('/api') && !path.startsWith('/login') && !path.startsWith('/signup')
    const pageKey = pathToPageKey(path)
    if (isAppPage && pageKey !== 'access-denied') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, page_access')
        .eq('id', user.id)
        .single()
      if (!canAccess(profile?.role, profile?.page_access as string[] | null, pageKey)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/access-denied'
        url.search = `?page=${encodeURIComponent(pageKey)}`
        return NextResponse.rewrite(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-.*\.js|manifest\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
