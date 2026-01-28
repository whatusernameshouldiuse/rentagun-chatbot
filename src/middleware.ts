import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting
// In production, use Redis or Vercel KV
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_CHAT = parseInt(process.env.RATE_LIMIT_CHAT || '20');
const RATE_LIMIT_ORDERS = parseInt(process.env.RATE_LIMIT_ORDERS || '5');

function getRateLimit(pathname: string): number {
  if (pathname.includes('/api/orders')) {
    return RATE_LIMIT_ORDERS;
  }
  return RATE_LIMIT_CHAT;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return ip.trim();
}

export function middleware(request: NextRequest) {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  const ip = getClientIP(request);
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const limit = getRateLimit(request.nextUrl.pathname);

  // Get or create rate limit entry
  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW) {
    // Reset if window expired
    entry = { count: 1, timestamp: now };
  } else {
    entry.count++;
  }

  rateLimitMap.set(key, entry);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW;
    const keysToDelete: string[] = [];
    rateLimitMap.forEach((v, k) => {
      if (v.timestamp < cutoff) {
        keysToDelete.push(k);
      }
    });
    keysToDelete.forEach((k) => rateLimitMap.delete(k));
  }

  // Check rate limit
  if (entry.count > limit) {
    return NextResponse.json(
      {
        error: true,
        code: 'rate_limit',
        message: "You're sending too many requests. Please wait a moment.",
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set(
    'X-RateLimit-Remaining',
    Math.max(0, limit - entry.count).toString()
  );

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
