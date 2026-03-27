import { NextResponse } from 'next/server'
import { unsealData } from 'iron-session'

const COOKIE_NAME = 'poi.session'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(request) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If already logged in and visiting /login → redirect to app
    if (pathname.startsWith('/login')) {
      const cookieValue = request.cookies.get(COOKIE_NAME)?.value
      if (cookieValue) {
        try {
          const session = await unsealData(cookieValue, {
            password: process.env.SESSION_SECRET,
          })
          if (session?.user) {
            return NextResponse.redirect(new URL('/', request.url))
          }
        } catch {
          // invalid cookie — let them see the login page
        }
      }
    }
    return NextResponse.next()
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value

  if (!cookieValue) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const session = await unsealData(cookieValue, {
      password: process.env.SESSION_SECRET,
    })

    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Forward user info to API routes and server components via headers.
    const response = NextResponse.next()
    response.headers.set('x-user-id',       String(session.user.id))
    response.headers.set('x-user-username', session.user.username)
    response.headers.set('x-user-role',     session.user.role)
    return response
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
