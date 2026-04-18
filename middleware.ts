import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// TODO: Add real auth before this URL is shared.

export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
