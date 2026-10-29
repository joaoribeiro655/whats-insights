import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dashboard é 100% dinâmico (dados por request), então o modelo clássico é mais simples.
  cacheComponents: false,
  output: "standalone",
  serverExternalPackages: ["postgres"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
