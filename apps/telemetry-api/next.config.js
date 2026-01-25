/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for Edge runtime
  experimental: {
    // Enable Edge runtime for API routes
  },
  // Disable unnecessary features for API-only app
  images: {
    unoptimized: true,
  },
  // Skip type checking during build (CI handles it)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true, // Main repo handles linting
  },
};

module.exports = nextConfig;
