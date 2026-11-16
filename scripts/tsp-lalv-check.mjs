/**
 * LOOK FOR MAP BUGS IN THE BUILT COURSES (owner, 2026-11-16, of the line
 * zig-zagging through Lenwood: "What is the best way for me to clean up
 * these issues/map bugs").
 *
 *   node scripts/tsp-lalv-check.mjs [--only powerline|og|pahrump] [--secrets]
 *
 * Reads public/tsp/lalv-course/course-<id>.json and prints SUSPECTS:
 *   KINK    at a named place (a waypoint the route was built through): the
 *           points 200 m before and after along the line are much closer
 *           together than 400 m — the line went out to touch the waypoint
 *           and came back, which means the waypoint is off the through road.
 *   WIGGLE  a 1.5 km window whose ends are closer than 65% of the distance
 *           along the line. A canyon road does this honestly; a router
 *           detouring round a block does it too. Overlapping windows are
 *           merged into one line.
 * Nothing here is fetched; it reads the files only. A suspect is a place to
 * LOOK (the Google Maps link), not a verdict.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public/tsp/lalv-course");
const MI = 1609.344;
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const secrets = args.includes("--secrets");

const KINK_ARM_M = 200;
const KINK_RATIO = 0.75;
const WIN_M = 1500;
const WIN_STEP_M = 100;
const WIN_RATIO = 0.65;

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const d = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * d) / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(((bLon - aLon) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function pointAt(c, m) {
  const mm = Math.max(0, Math.min(c.length_m, m));
  let lo = 0;
  let hi = c.cum_m.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c.cum_m[mid] <= mm) lo = mid;
    else hi = mid - 1;
  }
  const i = Math.min(lo, c.coords.length - 2);
  const span = c.cum_m[i + 1] - c.cum_m[i];
  const t = span > 0 ? Math.min(1, (mm - c.cum_m[i]) / span) : 0;
  return [c.coords[i][0] + (c.coords[i + 1][0] - c.coords[i][0]) * t, c.coords[i][1] + (c.coords[i + 1][1] - c.coords[i][1]) * t];
}

const chord = (c, a, b) => {
  const p = pointAt(c, a);
  const q = pointAt(c, b);
  return hav(p[1], p[0], q[1], q[0]);
};
const link = ([lon, lat]) => `https://www.google.com/maps?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
const nearestPlace = (c, m) => c.places.reduce((best, p) => (Math.abs(p.m - m) < Math.abs(best.m - m) ? p : best), c.places[0]);

function check(id) {
  const file = resolve(OUT, `course-${id}.json`);
  if (!existsSync(file)) return;
  const c = JSON.parse(readFileSync(file, "utf8"));
  console.log(`\n${c.name} — ${(c.length_m / MI).toFixed(1)} mi`);
  let n = 0;

  for (const p of c.places) {
    if (p.m < KINK_ARM_M || p.m > c.length_m - KINK_ARM_M) continue;
    const d = chord(c, p.m - KINK_ARM_M, p.m + KINK_ARM_M);
    if (d < 2 * KINK_ARM_M * KINK_RATIO) {
      n++;
      console.log(`  KINK    mile ${(p.m / MI).toFixed(1)}  ${p.name}: 400 m of line, ends ${Math.round(d)} m apart  ${p.lat.toFixed(5)},${p.lon.toFixed(5)}  ${link([p.lon, p.lat])}`);
    }
  }

  // Wiggles: windows merged while they overlap; the worst ratio names the run.
  let run = null;
  const flush = () => {
    if (!run) return;
    n++;
    const mid = pointAt(c, run.worstM + WIN_M / 2);
    const near = nearestPlace(c, run.worstM + WIN_M / 2);
    console.log(
      `  WIGGLE  mile ${(run.from / MI).toFixed(1)}–${(run.to / MI).toFixed(1)}  worst: 1.5 km of line, ends ${Math.round(run.worst * WIN_M)} m apart (${Math.round(run.worst * 100)}%)  near ${near.name}  ${mid[1].toFixed(5)},${mid[0].toFixed(5)}  ${link(mid)}`,
    );
    run = null;
  };
  for (let a = 0; a + WIN_M <= c.length_m; a += WIN_STEP_M) {
    const ratio = chord(c, a, a + WIN_M) / WIN_M;
    if (ratio < WIN_RATIO) {
      if (run && a <= run.to) {
        run.to = a + WIN_M;
        if (ratio < run.worst) {
          run.worst = ratio;
          run.worstM = a;
        }
      } else {
        flush();
        run = { from: a, to: a + WIN_M, worst: ratio, worstM: a };
      }
    }
  }
  flush();
  if (n === 0) console.log("  nothing suspect");
}

for (const id of ["powerline", "og", "pahrump"]) {
  if (only && only !== id) continue;
  check(secrets ? `${id}-secrets` : id);
}
