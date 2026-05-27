# Overnight work — MVP v0.1 → real Lighthouse data

Branch: `mvpv0.1-real-data` · branched off `main` at the lock commit.
Four commits, all clean, build passes, walked end-to-end in the browser.

## What landed

### 1. Real Lighthouse GPX courses (5K / 10K / Half)

Copied your OSRM-generated GPX from `lighthouse_half_2026/` into `public/gpx/`:

| Tab | File | Distance |
|---|---|---|
| 5K | `public/gpx/5k.gpx` | 5.0 km |
| 10K | `public/gpx/10k.gpx` | 10.0 km |
| Half | `public/gpx/half.gpx` | 21.1 km |

`public/gpx/full.gpx` deleted (Lighthouse has no full marathon).

Also fixed a real bug in `parseGpx`: it was using `querySelectorAll("trkpt")`, which returns nothing on a namespaced `<gpx xmlns="...">` document — the synth fallback was firing silently. Now uses `getElementsByTagName`. Switched the loader from `cache: "force-cache"` to `cache: "default"` so a redeploy with new GPX isn't masked by stale browser cache.

### 2. Real Lighthouse Half racer roster

New `src/lib/lighthouseRoster.ts` — 113 real finishers from `lighthouse_half_2026/results.csv`. Each carries bib, name, gender, age, city/state, chip time, and chip minutes. `findRacerByBib(value)` is the lookup.

`src/lib/data.ts`:
- `racers[]` is now derived from `LIGHTHOUSE_RACERS` (all `distance: "half"`)
- `photos[]` is now an **empty array** — no real photos yet, so the catalog is empty and bib search returns 0 matches
- `DEMO_PHOTOS` is the old procedural array, kept as an optional fallback if you want to preview the buy UI against fake gradients
- `FACE_SEED_BIB` is now `288` (Daniel Velasquez, the actual race winner — 1:23:48)
- Synthetic-GPS bbox moved from Boston to the Long Beach shoreline

### 3. Real bib search + three-flavor empty state

`runSearch({ kind: "bib" })` does an exact-bib lookup against the roster.

`ResultsScreen` now shows:
- **Match bar**: `BIB #288 · DANIEL VELASQUEZ · FINISHED 1:23:48` (mono caps eyebrow above the headline) when a real Lighthouse bib was entered
- **`0 photos found`** headline (italic accent on "found")
- **Empty-state cream panel**, three flavors:
  1. Matched racer, no photos → *"Hi, Daniel — we're still sorting your photos."* (launch-day messaging)
  2. Bib not in roster → *"No runner with bib #999. Double-check your number — bib numbers from this event run 251 to 400."*
  3. Generic browse → *"Photos are on the way."*

Bundle bar hides itself when there's nothing to sell. Face-suggest / bib-suggest banners also no longer fire when the photo catalog is empty (no fake stacked thumbnails).

### 4. Finish-time distribution chart on the landing

New `src/components/runner/FinishTimeChart.tsx`. Plain SVG, no charting deps.

- 5-minute histogram bins (cream bars with hairline borders)
- Smoothed density line over the top in accent terracotta
- Vertical markers: dashed terracotta for winner, dashed ink for median
- X-axis ticks every 15–30 min depending on the span
- Header shows `FINISH TIMES — 113 RUNNERS` and `MEDIAN 2:16` (mono caps)
- Footer callout: `● WINNER DANIEL VELASQUEZ · 1:23:48`

Mounted on the landing right column under `CourseCard`.

## Commits on this branch

```
ebe429d Add finish-time distribution chart to landing
7c6ec48 Real bib search + empty-state results
38005e4 Wire real Lighthouse Half racer roster
8ffc6e3 Wire real Lighthouse 5K / 10K / Half GPX into public/gpx/
1b8de79 (main) Lock the buy flow behind PAYMENTS_OPEN + bypass key
```

Tree is clean. `npm run build` passes. Site still has `PAYMENTS_OPEN=false` lock from main, so checkout stays gated as before.

## How to test

```bash
git switch mvpv0.1-real-data
npm run dev
```

Then in a browser:
- `/` → real Lighthouse course on the map, real distance/elev numbers per tab, finish-time chart with winner callout
- `/` → Search by Bib `288` → results shows "Hi, Daniel — we're still sorting your photos." with the matched racer summary above
- `/` → Search by Bib `999` → "No runner with bib #999"
- `/checkout` → still locked (`PAYMENTS_OPEN` defaults to `false`)

## What's still fake / TODO

- **Gain is 0 m** on every tab — the OSRM GPX has no `<ele>` data. If you want elevation, either swap to a Strava-recorded version, or layer in Mapbox/Google elevation API for the points.
- **5K / 10K racers are empty** — the results CSV only has half-marathon finishers. If you have the 5K and 10K rosters, drop them in and tag entries with `distance: "5k" | "10k"` in `lighthouseRoster.ts`.
- **No photos exist** — the bundle CTA is hidden everywhere because `photos: Photo[] = []`. Once you have real photographer uploads, drop them into that array (or wire an API endpoint) and everything starts rendering. The lock prevents accidental sales in the meantime.
- **Photographer upload page / dashboard** — not built. Launch-gate is cleared, so this is unblocked when you want it.

## To merge

```bash
git switch main
git merge mvpv0.1-real-data
git push origin main
```

Vercel will redeploy automatically.

## To pause

```bash
git switch main   # mvpv0.1-real-data stays on the side until you're ready
```

Nothing on `main` changed — production is unaffected until you merge.
