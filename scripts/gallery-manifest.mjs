/**
 * Snapshot the Rowtember gallery folder into a JSON manifest.
 *
 *   node scripts/gallery-manifest.mjs      (runs automatically via `prebuild`)
 *
 * Why a manifest at all: /row100k/gallery lists the photos, but on Vercel the
 * page renders inside a serverless function whose filesystem does NOT contain
 * public/ (assets go to the CDN; output tracing never bundles a readdir'd
 * directory). A request-time readdir there throws ENOENT and the gallery
 * would silently render empty. So the build snapshots the folder here, and
 * the page falls back to this manifest when the live readdir fails. In local
 * dev the readdir works and stays authoritative — new photos show up without
 * re-running this script.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "row100k", "rowtember-profiles");
const OUT = path.join(process.cwd(), "src", "app", "row100k", "gallery", "manifest.json");

const files = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => /\.jpe?g$/i.test(f))
  : [];

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(files, null, 2) + "\n");
console.log(`gallery manifest: ${files.length} photo${files.length === 1 ? "" : "s"} → ${path.relative(process.cwd(), OUT)}`);
