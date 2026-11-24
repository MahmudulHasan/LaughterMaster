import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // PGlite loads its WASM and data files via `new URL(..., import.meta.url)`;
  // bundling rewrites that into a URL Node's fs can't read, so load it from
  // node_modules at runtime instead.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  // The share card reads its fonts from disk at request time; make sure the
  // deployed function bundle includes them.
  outputFileTracingIncludes: {
    "/joke/[id]/opengraph-image": ["./assets/fonts/**"],
  },
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
