import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host" as const, value: "www.long2text.com" }],
      destination: "https://long2text.com/:path*",
      permanent: true,
    }];
  },
  // Sharp is used for image splitting in serverless functions
  serverExternalPackages: ["sharp"],
  // Two root layouts (English at /, Chinese at /zh) need a global 404 page
  experimental: { globalNotFound: true },
};

export default nextConfig;
