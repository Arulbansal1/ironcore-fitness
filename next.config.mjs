/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel builds its own output; `standalone` is only for self-hosting
  // (our Dockerfile and `npm start`).
  output: process.env.VERCEL ? undefined : 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {
    // Attachment uploads are streamed through a route handler; raise the body cap.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
