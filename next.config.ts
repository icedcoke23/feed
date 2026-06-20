import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /* config options here */
  output: 'standalone', // 启用standalone输出，用于Docker部署
  poweredByHeader: false, // 隐藏 X-Powered-By 响应头
  allowedDevOrigins: ['*.dev.coze.site'],
  serverExternalPackages: ['coze-coding-dev-sdk'],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
