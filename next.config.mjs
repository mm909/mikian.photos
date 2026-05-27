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
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "sharp"],
  },
};

export default nextConfig;
