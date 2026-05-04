import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "prisma", "bcrypt"],
  outputFileTracingIncludes: {
    "*": ["node_modules/.prisma/**"],
  },
};

export default nextConfig;
