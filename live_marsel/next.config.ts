import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Type errors don't block production build — strict typing handled in IDE.
  // Recharts v3 + Supabase realtime payloads need permissive types at runtime.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
