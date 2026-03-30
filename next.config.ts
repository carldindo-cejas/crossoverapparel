import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    return [
      // /owner/* → /admin/* (admin pages serve under /admin route group)
      { source: "/owner", destination: "/admin" },
      { source: "/owner/:path*", destination: "/admin/:path*" },
      // /api/owner/* → /api/admin/* (API routes under /api/admin)
      { source: "/api/owner/:path*", destination: "/api/admin/:path*" },
    ];
  }
};

export default nextConfig;
