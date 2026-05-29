"""Regenerate src/lib/lighthouseRoster.ts from the Race Roster results dumps.

Reads the three per-race result files (half / 10K / 5K) and emits the combined
LIGHTHOUSE_RACERS array, tagging each finisher with its distance. Bib numbers
do not collide across the three races, so bib stays a safe unique key.

Re-fetch the raw files with (limit large enough to defeat the 50-row paging):
  for sid in 283500 283501 283502; do
    curl -s "https://results.raceroster.com/v2/api/result-events/116585/sub-events/$sid/results?filter_search=&start=0&limit=1000" \
      -o "results_raw_$sid.json"
  done
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "src" / "lib" / "lighthouseRoster.ts"

# subEventId -> (DistanceKey, sane chip-time window in minutes)
RACES = [
    (283500, "half", (60, 300)),
    (283501, "10k", (25, 150)),
    (283502, "5k", (12, 90)),
]


def to_minutes(t):
    if not t:
        return None
    parts = [float(p) for p in t.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, s = parts
    return h * 60 + m + s / 60


def gender_of(r):
    # The API moved the human label into genderSexId ("Male"/"Female"/"Unknown");
    # the old `gender` field now comes back null.
    g = (r.get("genderSexId") or r.get("gender") or "").strip()
    return g if g in ("Male", "Female") else "Unknown"


def num(v):
    """Render a float without trailing noise, matching the hand-written file."""
    return f"{round(v, 4):g}"


def ts_str(s):
    return json.dumps(s or "")


def build():
    entries = []
    for sid, distance, (lo, hi) in RACES:
        raw = json.loads((HERE / f"results_raw_{sid}.json").read_text(encoding="utf-8"))
        kept = []
        for r in raw["data"]:
            name = (r.get("name") or "").strip()
            final = (r.get("finalTime") or "").strip()
            chip = r.get("chipTime") or ""
            cm = to_minutes(chip)
            # Drop placeholders and anyone without a real recorded finish.
            if not final or name.lower() == "see timer":
                continue
            if cm is None or cm < lo or cm > hi:
                continue
            try:
                bib = int(r.get("bib"))
            except (TypeError, ValueError):
                continue
            kept.append({
                "bib": bib,
                "name": name,
                "gender": gender_of(r),
                "age": r.get("age"),
                "city": r.get("fromCity") or "",
                "state": r.get("fromProvState") or "",
                "chipTime": chip,
                "chipMinutes": cm,
                "distance": distance,
            })
        kept.sort(key=lambda x: x["chipMinutes"])
        print(f"{distance:>4}: {len(kept)} kept of {len(raw['data'])}")
        entries.extend(kept)

    lines = []
    lines.append("// Real 2026 Lighthouse Half Marathon roster — pulled from Race Roster on 2026-05-28.")
    lines.append("// Covers all three races (half / 10K / 5K); each entry carries its `distance`.")
    lines.append("// Bib numbers do not collide across the three races, so bib is a unique key.")
    lines.append("// Regenerate with lighthouse_half_2026/build_roster.py.")
    lines.append("")
    lines.append('import type { DistanceKey } from "./gpx";')
    lines.append("")
    lines.append("export type LighthouseRacer = {")
    lines.append("  bib: number;")
    lines.append("  name: string;")
    lines.append('  gender: "Male" | "Female" | "Unknown";')
    lines.append("  age: number;")
    lines.append("  city: string;")
    lines.append("  state: string;")
    lines.append('  chipTime: string; // "h:mm:ss" (half) or "mm:ss" (5K/10K)')
    lines.append("  chipMinutes: number; // numeric for charts")
    lines.append("  distance: DistanceKey;")
    lines.append("};")
    lines.append("")
    lines.append("export const LIGHTHOUSE_RACERS: LighthouseRacer[] = [")
    for e in entries:
        age = e["age"] if isinstance(e["age"], int) else 0
        lines.append(
            "  { "
            f'bib: {e["bib"]}, '
            f'name: {ts_str(e["name"])}, '
            f'gender: {ts_str(e["gender"])}, '
            f'age: {age}, '
            f'city: {ts_str(e["city"])}, '
            f'state: {ts_str(e["state"])}, '
            f'chipTime: {ts_str(e["chipTime"])}, '
            f'chipMinutes: {num(e["chipMinutes"])}, '
            f'distance: {ts_str(e["distance"])} '
            "},"
        )
    lines.append("];")
    lines.append("")
    lines.append("/** Lookup a racer by bib number. Returns undefined if no match. */")
    lines.append("export function racerByBib(bib: number | string): LighthouseRacer | undefined {")
    lines.append('  const n = typeof bib === "string" ? parseInt(bib, 10) : bib;')
    lines.append("  if (!Number.isFinite(n)) return undefined;")
    lines.append("  return LIGHTHOUSE_RACERS.find((r) => r.bib === n);")
    lines.append("}")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} with {len(entries)} entries")


if __name__ == "__main__":
    build()
