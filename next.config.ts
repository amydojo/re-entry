import type { NextConfig } from "next";

const privateNoStore = [{ key: "Cache-Control", value: "private, no-store, max-age=0" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    typedEnv: false
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      },
      { source: "/client/:path*", headers: privateNoStore },
      { source: "/desk/:path*", headers: privateNoStore },
      { source: "/protocols/:path*", headers: privateNoStore },
      { source: "/issue", headers: privateNoStore }
    ];
  }
};

export default nextConfig;
