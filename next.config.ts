import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A 3,000-row bulk-import CSV can run a few MB; default is 1MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
