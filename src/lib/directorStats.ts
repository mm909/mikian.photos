/* ============================================================
   Race-director landing — derived stats + representative figures
   ------------------------------------------------------------
   Pure data module (no React) so it's importable from both the
   server-rendered page sections and the client viz components.

   Finish-time curves AND winners are derived from the REAL 2026
   Lighthouse roster (src/lib/lighthouseRoster.ts), which holds all
   three races. The kernel-density curves are computed with a fixed
   bandwidth — fully deterministic, so server and client render
   identically (no hydration mismatch).

   Only SALES_SNAPSHOT is representative — an example of the report a
   director receives. Its per-distance counts are kept consistent
   with the real finisher counts shown elsewhere on the page.
   ============================================================ */

import { LIGHTHOUSE_RACERS } from "./lighthouseRoster";
import { DISTANCE_LABELS, type DistanceKey } from "./gpx";

/* ---- Contact / booking (swap these for your own) -------------------- */

/** Your scheduling link (Cal.com / Calendly / etc.). TODO: replace. */
export const DEMO_URL = "https://cal.com/mikian-photos/race-demo";
/** Visible contact address shown alongside the demo button. */
export const CONTACT_EMAIL = "mikian.photos@gmail.com";

/* ---- Time formatting ------------------------------------------------- */

/** Minutes → "h:mm" (>=60) or "mm" for short races. */
export function fmtMinutes(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min - h * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  return `${Math.round(min)}m`;
}

/* ---- Winners / results (REAL data, all three distances) ------------- */

export type Finisher = {
  bib: number;
  name: string;
  age: number;
  city: string;
  state: string;
  chipTime: string;
  chipMinutes: number;
  gender: "Male" | "Female" | "Unknown";
};

function finishersFor(d: DistanceKey): Finisher[] {
  return LIGHTHOUSE_RACERS.filter((r) => r.distance === d)
    .map((r) => ({
      bib: r.bib,
      name: r.name,
      age: r.age,
      city: r.city,
      state: r.state,
      chipTime: r.chipTime,
      chipMinutes: r.chipMinutes,
      gender: r.gender,
    }))
    .sort((a, b) => a.chipMinutes - b.chipMinutes);
}

export type DistanceResults = {
  key: DistanceKey;
  label: string;
  total: number;
  podium: Finisher[];
  table: Finisher[];
  topMale: Finisher | null;
  topFemale: Finisher | null;
};

function resultsFor(d: DistanceKey): DistanceResults {
  const f = finishersFor(d);
  return {
    key: d,
    label: DISTANCE_LABELS[d],
    total: f.length,
    podium: f.slice(0, 3),
    table: f.slice(0, 10),
    topMale: f.find((r) => r.gender === "Male") ?? null,
    topFemale: f.find((r) => r.gender === "Female") ?? null,
  };
}

export const DISTANCES: DistanceKey[] = ["half", "10k", "5k"];
export const resultsByDistance: Record<DistanceKey, DistanceResults> = {
  half: resultsFor("half"),
  "10k": resultsFor("10k"),
  "5k": resultsFor("5k"),
};

/* ---- Finish-time distributions (REAL, shared time axis) ------------- */

export type FinishCurve = {
  key: DistanceKey;
  label: string;
  finishers: number;
  medianMin: number;
  fastestMin: number;
  /** Even-spaced density samples across [AXIS_MIN, AXIS_MAX]. */
  samples: { min: number; density: number }[];
  /** Color token (CSS var) for this curve. */
  color: string;
};

export const AXIS_MIN = 15; // minutes
export const AXIS_MAX = 205; // minutes
const SAMPLE_STEP = 2;

/** Gaussian kernel-density curve of the real finish times for a distance. */
function realCurve(d: DistanceKey, color: string, bandwidth: number): FinishCurve {
  const mins = finishersFor(d).map((r) => r.chipMinutes);
  const sorted = [...mins].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const fastest = sorted[0] ?? 0;
  const samples: { min: number; density: number }[] = [];
  for (let t = AXIS_MIN; t <= AXIS_MAX; t += SAMPLE_STEP) {
    let dens = 0;
    for (const m of mins) {
      const z = (t - m) / bandwidth;
      dens += Math.exp(-0.5 * z * z);
    }
    dens /= mins.length * bandwidth * Math.sqrt(2 * Math.PI);
    samples.push({ min: t, density: dens });
  }
  return { key: d, label: DISTANCE_LABELS[d], finishers: mins.length, medianMin: median, fastestMin: fastest, samples, color };
}

/** Three real curves on one shared time axis. Bandwidth scales with race length. */
export const finishCurves: FinishCurve[] = [
  realCurve("5k", "var(--muted)", 2.6),
  realCurve("10k", "var(--green)", 3.6),
  realCurve("half", "var(--accent)", 6),
];

/* ---- Course photo stations (for the density map) -------------------- */

/**
 * Generic photographer stations expressed as a fraction along the route
 * (0 = start, 1 = finish) so the same set maps onto any distance. `weight`
 * scales how many photos cluster there; start + finish always run hot.
 */
export type Station = { at: number; label: string; weight: number };

export const PHOTO_STATIONS: Station[] = [
  { at: 0.0, label: "Start line", weight: 1.0 },
  { at: 0.16, label: "Shoreline straight", weight: 0.55 },
  { at: 0.33, label: "Mile cheer zone", weight: 0.72 },
  { at: 0.5, label: "Turnaround", weight: 0.85 },
  { at: 0.67, label: "Bluff overlook", weight: 0.6 },
  { at: 0.84, label: "Final push", weight: 0.78 },
  { at: 1.0, label: "Finish chute", weight: 1.0 },
];

/* ---- Representative sales / purchase reporting ---------------------- */

/**
 * Example of the post-race report a director receives. Internally consistent:
 * buyers × avgOrder ≈ revenue, buyers / matched ≈ conversion, and the
 * per-distance "matched" counts stay below the real finisher counts shown
 * elsewhere (Half 120, 10K 73, 5K 163).
 */
export const SALES_SNAPSHOT = {
  event: "Lighthouse Half Marathon",
  date: "May 24, 2026",
  photosCaptured: 1248,
  runnersMatched: 312,
  buyers: 168,
  conversionPct: 54, // of matched runners
  revenue: 4870,
  avgOrder: 29,
  payoutToOrganizer: 974, // representative 20% share
  byDistance: [
    { key: "half" as DistanceKey, label: "Half", matched: 112, buyers: 68, conversionPct: 61 },
    { key: "10k" as DistanceKey, label: "10K", matched: 64, buyers: 33, conversionPct: 52 },
    { key: "5k" as DistanceKey, label: "5K", matched: 136, buyers: 67, conversionPct: 49 },
  ],
  // Cumulative revenue over the first 7 days after the race (representative).
  salesByDay: [
    { day: "Race day", revenue: 1290 },
    { day: "+1", revenue: 2480 },
    { day: "+2", revenue: 3360 },
    { day: "+3", revenue: 3980 },
    { day: "+4", revenue: 4380 },
    { day: "+5", revenue: 4660 },
    { day: "+6", revenue: 4870 },
  ],
};
