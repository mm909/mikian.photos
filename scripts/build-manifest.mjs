/**
 * build-manifest.mjs
 * Run with: node scripts/build-manifest.mjs
 *
 * Reads EXIF DateTimeOriginal from all photos under public/downtownkruz/photos/,
 * converts from America/Los_Angeles → UTC, and writes public/downtownkruz/manifest.json.
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, relative, sep } from "path";
import exifr from "exifr";
import { fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Los_Angeles";
const BASE = new URL("../public/downtownkruz", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const PHOTOS_DIR = join(BASE, "photos");
const GPX_DIR = join(BASE, "gpx");

// --- collect GPX filenames ---
const gpxFiles = (await readdir(GPX_DIR)).filter((f) => f.endsWith(".gpx")).sort();
console.log(`GPX files (${gpxFiles.length}):`, gpxFiles);

// --- collect all photos recursively ---
async function scanPhotos(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await scanPhotos(full)));
    } else if (/\.(jpe?g|JPE?G)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const allPhotoPaths = (await scanPhotos(PHOTOS_DIR)).sort();
console.log(`Found ${allPhotoPaths.length} photos`);

// --- extract EXIF timestamps ---
const photoEntries = [];
let ok = 0, missing = 0;

for (const fullPath of allPhotoPaths) {
  const buf = await readFile(fullPath);
  let utcTime = null;

  try {
    const tags = await exifr.parse(buf, { pick: ["DateTimeOriginal"] });
    if (tags?.DateTimeOriginal) {
      // exifr returns a JS Date already in some cases, or a string
      let raw = tags.DateTimeOriginal;
      if (raw instanceof Date) {
        // exifr may interpret as UTC; we need to reinterpret as LA local time
        // The EXIF value is local time with no TZ — get the raw string instead
        const rawTags = await exifr.parse(buf, { pick: ["DateTimeOriginal"], rawValues: true });
        raw = rawTags?.DateTimeOriginal ?? raw;
      }
      if (typeof raw === "string") {
        // Format: "2026:02:11 19:32:20"
        const normalized = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T");
        utcTime = fromZonedTime(normalized, TIMEZONE).toISOString();
      } else if (raw instanceof Date) {
        utcTime = raw.toISOString();
      }
    }
  } catch (e) {
    // ignore EXIF parse errors
  }

  // Build public URL path (forward slashes, relative to public/)
  const rel = relative(BASE, fullPath).split(sep).join("/");
  const url = `/downtownkruz/${rel}`;
  const filename = fullPath.split(sep).pop();

  if (utcTime) {
    photoEntries.push({ filename, utcTime, url });
    ok++;
  } else {
    console.warn(`  NO EXIF: ${filename}`);
    missing++;
  }
}

console.log(`\nEXIF OK: ${ok}  |  missing: ${missing}`);

// Sort by utcTime ascending
photoEntries.sort((a, b) => a.utcTime.localeCompare(b.utcTime));

// --- write manifest.json ---
const manifest = { gpxFiles, photos: photoEntries };
const outPath = join(BASE, "manifest.json");
await writeFile(outPath, JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${outPath}`);
console.log(`  ${gpxFiles.length} GPX files`);
console.log(`  ${photoEntries.length} photos`);
