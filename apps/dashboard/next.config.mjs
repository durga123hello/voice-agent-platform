/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_VOICE_PLATFORM_URL: process.env.NEXT_PUBLIC_VOICE_PLATFORM_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
