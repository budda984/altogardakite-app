/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // per firme/foto
    },
  },
};

export default nextConfig;
