import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://donefast.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  // Allow any *.vercel.app origin for preview deploys, plus configured origins
  if (
    origin &&
    (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))
  ) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  const response = NextResponse.next();

  // Add CORS headers to all API responses
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // Redirect unauthenticated customers to customer login page
  if (
    request.nextUrl.pathname === '/customer' &&
    !request.cookies.get('auth-token') &&
    !request.headers.get('authorization')
  ) {
    return NextResponse.redirect(new URL('/customer/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/customer'],
};
