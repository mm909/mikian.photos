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
    serverComponentsExternalPackages: ["tesseract.js", "sharp", "@napi-rs/canvas"],
    // The live tracker's event files (events/<slug>.yaml + .gpx) are read
    // from disk by the sync route, which upserts them into the database;
    // nothing else reads the files at runtime. Output tracing would not
    // otherwise ship them to the serverless function.
    outputFileTracingIncludes: {
      "/api/track/sync": ["./events/**/*"],
      // The share cards drawn on the server (share/serverCard.ts) read their
      // three faces off disk.
      "/api/row100k/app/card": ["./src/app/row100k/share/fonts/*"],
      // The reel route also loads its video encoder at run time, outside the
      // bundle (erg/reel/serverReel.ts), so the package is shipped by name.
      "/api/row100k/app/reel": ["./src/app/row100k/share/fonts/*", "./node_modules/h264-mp4-encoder/**/*"],
      // The M2D count-ups (row100k/m2dReel.ts) are filmed the same way.
      "/api/row100k/app/m2d-reel": ["./src/app/row100k/share/fonts/*", "./node_modules/h264-mp4-encoder/**/*"],
    },
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
