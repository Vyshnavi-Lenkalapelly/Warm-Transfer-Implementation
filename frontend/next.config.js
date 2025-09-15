/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
          : 'http://localhost:8000/api/:path*',
      },
    ];
  },
  env: {
    NEXT_PUBLIC_LIVEKIT_WS_URL: process.env.NEXT_PUBLIC_LIVEKIT_WS_URL,
    NEXT_PUBLIC_LIVEKIT_API_KEY: process.env.NEXT_PUBLIC_LIVEKIT_API_KEY,
  },
}

module.exports = nextConfig