import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker file relative to its own
  // package location at runtime. Bundling it into the server build breaks
  // that lookup ("Cannot find module '.../pdf.worker.mjs'") because the
  // worker file never gets copied into the build's chunk output. Keeping it
  // external makes Node load it straight from node_modules instead.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
