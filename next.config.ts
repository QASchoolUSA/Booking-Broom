import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    // lucide-react + date-fns are already optimized by Next.js defaults
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default withSerwist(nextConfig);
