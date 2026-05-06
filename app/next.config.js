/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove 'output: export' to enable API routes on Vercel
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;