import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { verifyLogin, safeUser } from '@/lib/auth/userService'
import { SESSION_OPTIONS } from '@/lib/auth/session'

export async function POST(request) {
  const formData = await request.formData()
  const username = (formData.get('username') ?? '').trim()
  const password = formData.get('password') ?? ''

  if (!username || !password) {
    return NextResponse.redirect(new URL('/login?error=1', request.url))
  }

  const user = await verifyLogin(username, password)

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=1', request.url))
  }

  const cookieStore = await cookies()
  const session = await getIronSession(cookieStore, SESSION_OPTIONS)
  session.user = safeUser(user)
  await session.save()

  return NextResponse.redirect(new URL('/', request.url))
}
