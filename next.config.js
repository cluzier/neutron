/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Ensure static files are served correctly in production
  assetPrefix: './',
  // Disable server-side features since we're running in Electron
  typescript: {
    // Dangerously allow production builds to successfully complete even if your project has type errors
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig 