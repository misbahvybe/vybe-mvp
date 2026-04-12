/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['plus.unsplash.com', 'images.unsplash.com', 'unsplash-assets.imgix.net'],
  },
  /** Admin UI should not be served from stale CDN cache after a deploy. */
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
