import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp is used for image splitting in serverless functions
  serverExternalPackages: ["sharp"],
  // Two root layouts (English at /, Chinese at /zh) need a global 404 page
  experimental: { globalNotFound: true },
};

export default nextConfig;
