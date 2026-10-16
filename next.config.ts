import type { NextConfig } from 'next'

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  distDir: process.env.PLAYWRIGHT_TEST_SERVER === '1' ? '.next/e2e' : '.next',
  output: 'standalone',
  allowedDevOrigins,
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
}

export default nextConfig
