import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Reconciliation imports are validated server-side and capped at 10 MB.
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
