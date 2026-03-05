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

export interface LoadProgress {
  total: number;
  loaded: number;
  name: string;
  date: string;
  status: "ok" | "error";
}

export async function loadRunsProgressive(
  onProgress: (progress: LoadProgress) => void,
  signal?: AbortSignal
): Promise<Run[]> {
  const res = await fetch(`${BASE}/manifest.json`, { signal });
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
  const manifest: DowntownkruzManifest = await res.json();

  const total = manifest.gpxFiles.length;
  const runs: Run[] = [];
  let loaded = 0;

  for (const filename of manifest.gpxFiles) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      const r = await fetch(`${BASE}/gpx/${filename}`, { signal });
      if (!r.ok) throw new Error(`${r.status}`);
      const text = await r.text();
      const run = parseGpxText(text, filename);
      runs.push(run);
      loaded++;

      const date = run.startTime.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      onProgress({ total, loaded, name: run.name, date, status: "ok" });
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn("GPX load error:", filename, err);
      loaded++;
      onProgress({ total, loaded, name: filename, date: "", status: "error" });
    }
  }

  return runs;
}
