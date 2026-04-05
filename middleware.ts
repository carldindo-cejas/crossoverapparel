import { NextRequest, NextResponse } from "next/server";

/* ── Sliding-window rate limiter (per-isolate) ──
 * Cloudflare Workers may recycle isolates, so this is best-effort.
 * For hard limits, pair with Cloudflare WAF Rate Limiting Rules.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Configurable limits per path prefix
const RATE_LIMITS: { pattern: RegExp; limit: number; windowSec: number }[] = [
  { pattern: /^\/api\/auth/, limit: 10, windowSec: 60 },          // auth: 10 req/min
  { pattern: /^\/api\/orders$/, limit: 20, windowSec: 60 },        // order creation: 20 req/min
  { pattern: /^\/api\/uploads/, limit: 15, windowSec: 60 },        // file uploads: 15 req/min
  { pattern: /^\/login/, limit: 20, windowSec: 60 },               // login pages: 20 req/min
  { pattern: /^\/api\//, limit: 120, windowSec: 60 },              // general API: 120 req/min
];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// Clean up stale buckets periodically (max 2000 entries)
function pruneStale() {
  if (buckets.size < 2000) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Find matching rate limit rule
  const rule = RATE_LIMITS.find((r) => r.pattern.test(pathname));
  if (!rule) return NextResponse.next();

  const ip = getClientIp(request);
  const key = `${ip}:${rule.pattern.source}`;
  const now = Date.now();

  pruneStale();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowSec * 1000 };
    buckets.set(key, bucket);
  }

  bucket.count++;

  const remaining = Math.max(0, rule.limit - bucket.count);
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > rule.limit) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(rule.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(rule.limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/login", "/admin/login", "/designer/login"],
};
