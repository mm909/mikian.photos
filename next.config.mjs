/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep tesseract.js + sharp out of webpack's bundle:
  //
  //  - tesseract.js spawns a Node worker thread whose script path is computed
  //    relative to the package's own files. Webpack-bundled, that path becomes
  //    `.next/worker-script/node/index.js` which doesn't exist on disk and the
  //    worker crashes with MODULE_NOT_FOUND. Loading the package from
  //    node_modules at runtime sidesteps the whole problem.
  //
  //  - sharp ships a native binary per platform and shouldn't be re-bundled
  //    either (webpack happily duplicates it, doubling cold-start memory).
  //
  // (archiver is pinned to v7 — the last CommonJS release; v8 went ESM-only and
  // dropped the `archiver(format, opts)` factory, which broke webpack's default
  // import. v7 bundles cleanly, so it does NOT need to be externalized.)
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "sharp"],
  },

  // /rowtember is a second front door to the challenge. The challenge was
  // named 100K September when it launched and /row100k is printed on shirts,
  // stickers and share cards, so that stays the canonical path; /rowtember is
  // a rewrite (the address bar keeps what the reader typed) rather than a
  // redirect, so both spellings read as first-class.
  async rewrites() {
    return [
      { source: "/rowtember", destination: "/row100k" },
      { source: "/rowtember/:path*", destination: "/row100k/:path*" },
    ];
  },
};

export default nextConfig;
