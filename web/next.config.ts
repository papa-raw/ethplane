import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the dashboard is copied to hawk's /var/www/ethplane and served by nginx, and the
  // API is same-origin /api, so nothing here needs a Node server.
  output: 'export',
  images: { unoptimized: true },
  /* config options here */
};

export default nextConfig;
