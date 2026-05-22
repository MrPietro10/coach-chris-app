import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdf-parse + pdfjs-dist on Node; bundling breaks text extraction in API routes.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
