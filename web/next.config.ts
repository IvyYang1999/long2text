import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp is used for image splitting in serverless functions
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
