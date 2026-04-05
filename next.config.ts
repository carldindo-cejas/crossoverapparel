import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://static.cloudflareinsights.com https://interfaces.zapier.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com https://interfaces.zapier.com",
      "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org",
      "font-src 'self' https://unpkg.com https://interfaces.zapier.com",
      "connect-src 'self' wss: https: https://*.zapier.com https://interfaces.zapier.com",
      "frame-src 'self' https://interfaces.zapier.com https://*.zapier.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  output: "standalone",
  // Cloudflare Workers does not support Next.js built-in image optimisation (Node.js required).
  // Use next/image for lazy-loading, decoding hints, and layout stability; skip server-side optimisation.
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
