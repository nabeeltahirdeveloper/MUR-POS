import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Firebase Admin SDK is Node-only and can confuse bundlers (especially Turbopack).
  // Externalizing it ensures it's required at runtime on the server instead of bundled.
  serverExternalPackages: ["firebase-admin", "@prisma/client", "prisma"],
  // Prisma loads generated client code from `node_modules/.prisma/**`.
  // Some bundlers/tracers can miss dot-folders, causing:
  // "@prisma/client did not initialize yet. Please run prisma generate..."
  outputFileTracingIncludes: {
    "*": ["node_modules/.prisma/**"],
  },
};

export default nextConfig;
