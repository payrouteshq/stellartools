import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stellartools/shared-ui"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
