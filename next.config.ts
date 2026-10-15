import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Lets a phone on the same Wi-Fi use the dev server.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  experimental: {
    // Photos are shrunk to ~1600px in the browser; this leaves headroom.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
