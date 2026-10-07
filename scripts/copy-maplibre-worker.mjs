/**
 * Copy MapLibre's web worker into public/ so the browser loads it as a plain
 * static file (/track/maplibre-gl-worker.mjs).
 *
 * Why: maplibre-gl 6 ships ESM only and needs setWorkerUrl() under a bundler.
 * The documented `new URL("maplibre-gl/dist/maplibre-gl-worker.mjs",
 * import.meta.url)` form makes webpack emit the file as an asset, and Next's
 * production minifier then chokes on it ("'import' and 'export' cannot be
 * used outside of module code" — the worker is itself an ES module). Serving
 * the file from public/ sidesteps the bundler entirely. Runs on postinstall
 * and prebuild, so the copy always matches the installed package version;
 * the copy itself is gitignored.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const dstDir = path.join(root, "public", "track");
const dst = path.join(dstDir, "maplibre-gl-worker.mjs");

if (!existsSync(src)) {
  console.warn("[copy-maplibre-worker] maplibre-gl is not installed; skipping");
  process.exit(0);
}
mkdirSync(dstDir, { recursive: true });
copyFileSync(src, dst);
console.log(`[copy-maplibre-worker] ${path.relative(root, dst)}`);
