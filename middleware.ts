import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // Not logged in → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // /dashboard/agent و /api/agent → للمدير فقط
  const path = req.nextUrl.pathname
  if (
    path.startsWith('/dashboard/agent') ||
    path.startsWith('/api/agent')
  ) {
    if (token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/agent/:path*'],
}
