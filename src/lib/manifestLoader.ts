/**
 * Loads Downtownkruz run data from the static manifest.
 *
 * Expected file tree under /public/downtownkruz/:
 *   manifest.json          — { gpxFiles: ["run1.gpx", ...] }
 *   gpx/                   — one .gpx file per run
 */

import { parseGpxText } from "./gpxParser";
import type { Run, DowntownkruzManifest } from "./types";

const BASE = "/downtownkruz";

export async function loadRuns(): Promise<Run[]> {
  // 1. Fetch manifest
  const res = await fetch(`${BASE}/manifest.json`);
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
  const manifest: DowntownkruzManifest = await res.json();

  // 2. Parse all GPX files in parallel
  const results = await Promise.allSettled(
    manifest.gpxFiles.map(async (filename) => {
      const r = await fetch(`${BASE}/gpx/${filename}`);
      if (!r.ok) throw new Error(`Failed to fetch GPX ${filename}: ${r.status}`);
      const text = await r.text();
      return parseGpxText(text, filename);
    })
  );

  const runs: Run[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      runs.push(result.value);
    } else {
      console.warn("GPX load error:", result.reason);
    }
  }

  return runs;
}
