import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "picsum.photos" },
      { hostname: "i.pravatar.cc" },
      { hostname: "placehold.co" },
    ],
  },
  turbopack: {
    root: resolve(__dirname),
  },
};

export default nextConfig;
