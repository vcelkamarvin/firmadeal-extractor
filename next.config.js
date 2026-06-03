/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  },
};

module.exports = nextConfig;
