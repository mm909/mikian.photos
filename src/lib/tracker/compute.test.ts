/**
 * The compute core (TRACKER_SPEC.md §9, §12): progress interpolation at
 * handoff times, leg math across gaps, backfill determinism, the fallback
 * chain, the ETA function, gaps, solo checkpoint-split legs, public delay,
 * voided handoffs, the clock rules, duplicate taps, the finish clamp, a
 * finished entry's dot, the per-device newest fix (`latestFix`), PAIRS
 * (two slots on one entry, owner 2026-10-15) and route elevation.
 * Everything is synthetic: a straight 20 km route, constant-pace fixes,
 * scripted handoffs.
 */

import { describe, expect, it } from "vitest";
import {
  carriesAt,
  computeGaps,
  computeSnapshot,
  cumulativeGain,
  estimateEta,
  etaPaceParts,
  gainAtRouteM,
  gainBetween,
  holdersAt,
  onCourseAt,
  onCourseTimeline,
  progressAt,
  seriesFromSamples,
  timeAtProgress,
  type ComputeHandoff,
  type ComputeInput,
  type Fix,
} from "./compute";
import { buildRouteIndex, densify } from "./routeIndex";
import { FRESH_FIX_S } from "./types";
import { at, atIso, fixOnRoute, LAT0, LON0, M_PER_DEG_LAT, mkCheckpoints, mkEntry, mkHandoff, mkInput, northRoute, profileRoute, stand, T0, walk } from "./computeFixtures";
import type { Snapshot, SnapshotEntry } from "./types";

const near = (v: number, target: number, tol = 3) => expect(Math.abs(v - target)).toBeLessThanOrEqual(tol);
const nearIso = (iso: string | null, minutes: number, tolS = 2) => {
  expect(iso).not.toBeNull();
  near((Date.parse(iso as string) - at(minutes).getTime()) / 1000, 0, tolS);
};
const entryA = (s: Snapshot): SnapshotEntry => s.entries.find((e) => e.id === "e:A") as SnapshotEntry;

/**
 * The reference relay: A1 runs 0→5 km at 5:00/km (handoff at the start),
 * A2 takes over at 25 min and runs to 9 km at 6:00/km, as of 49 min.
 */
function standardRelay(asOfMin = 49): ComputeInput {
  const route = northRoute(20_000);
  return mkInput({
    route,
    entries: [mkEntry("A", 3)],
    positions: {
      "d:A1": walk(route, { fromM: 0, toM: 5000, fromMin: 0, paceSPerKm: 300 }),
      "d:A2": walk(route, { fromM: 5000, toM: 9000, fromMin: 25, paceSPerKm: 360, battery: 61 }),
    },
    handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 25)],
    asOfMin,
  });
}

describe("progress series math", () => {
  const s = seriesFromSamples([0, 60_000, 120_000, 180_000], [0, 200, 200, 500]);

  it("progressAt interpolates linearly, 0 before the first sample, flat after the last", () => {
    expect(progressAt(s, -1)).toBe(0);
    expect(progressAt(s, 0)).toBe(0);
    expect(progressAt(s, 30_000)).toBe(100);
    expect(progressAt(s, 60_000)).toBe(200);
    expect(progressAt(s, 90_000)).toBe(200);
    expect(progressAt(s, 150_000)).toBe(350);
    expect(progressAt(s, 999_999)).toBe(500);
  });

  it("timeAtProgress finds the FIRST crossing, or null when not reached", () => {
    expect(timeAtProgress(s, 0)).toBe(0);
    expect(timeAtProgress(s, 100)).toBe(30_000);
    expect(timeAtProgress(s, 200)).toBe(60_000);
    expect(timeAtProgress(s, 350)).toBe(150_000);
    expect(timeAtProgress(s, 500)).toBe(180_000);
    expect(timeAtProgress(s, 501)).toBeNull();
  });
});

describe("who is on course", () => {
  it("relay: nobody before the first handoff, then the latest non-voided handoff", () => {
    const entry = mkEntry("A", 3);
    const segs = onCourseTimeline(
      "relay",
      entry,
      [mkHandoff("e:A", "p:A2", 20), mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A3", 10, true), mkHandoff("e:B", "p:B1", 5)],
      at(0),
      at(60),
    );
    expect(segs.map((x) => x.participantId)).toEqual(["p:A1", "p:A2"]);
    expect(onCourseAt(segs, at(-1).getTime())).toBeNull();
    expect(onCourseAt(segs, at(0).getTime())?.participantId).toBe("p:A1");
    expect(onCourseAt(segs, at(19.99).getTime())?.participantId).toBe("p:A1");
    expect(onCourseAt(segs, at(20).getTime())?.participantId).toBe("p:A2");
    expect(onCourseAt(segs, at(500).getTime())?.participantId).toBe("p:A2");
  });

  it("relay: handoffs after as-of do not exist yet", () => {
    const segs = onCourseTimeline("relay", mkEntry("A", 2), [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 30)], at(0), at(20));
    expect(segs).toHaveLength(1);
    expect(segs[0].toMs).toBeNull();
  });

  it("a second tap for the runner already on course is the same handoff (two crew phones, a replayed tap)", () => {
    const segs = onCourseTimeline(
      "relay",
      mkEntry("A", 3),
      [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A1", 0.2), mkHandoff("e:A", "p:A2", 25), mkHandoff("e:A", "p:A2", 25.5)],
      at(0),
      at(60),
    );
    expect(segs.map((s) => [s.participantId, s.fromMs, s.toMs])).toEqual([
      ["p:A1", T0, at(25).getTime()],
      ["p:A2", at(25).getTime(), null],
    ]);
    // The whole snapshot is unchanged by the replay: no sliver leg, no inflated counts.
    const base = standardRelay();
    expect(computeSnapshot({ ...base, handoffs: [...base.handoffs, mkHandoff("e:A", "p:A2", 25.5)] })).toEqual(computeSnapshot(base));
  });

  it("two taps within 2 s are one exchange: the later runner at the earlier time", () => {
    const h = [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 25), mkHandoff("e:A", "p:A3", 25 + 1.5 / 60)];
    const segs = onCourseTimeline("relay", mkEntry("A", 3), h, at(0), at(60));
    expect(segs.map((s) => [s.participantId, s.fromMs, s.handoffId])).toEqual([
      ["p:A1", T0, h[0].id],
      ["p:A3", at(25).getTime(), h[1].id],
    ]);
    // 2.5 s apart is two exchanges: a genuinely fast exchange keeps its sliver.
    expect(onCourseTimeline("relay", mkEntry("A", 3), [h[0], h[1], mkHandoff("e:A", "p:A3", 25 + 2.5 / 60)], at(0), at(60))).toHaveLength(3);
    // Correcting a mistaken tap back to the runner already on course: nothing happened, that leg stays open.
    expect(onCourseTimeline("relay", mkEntry("A", 3), [h[0], h[1], mkHandoff("e:A", "p:A1", 25 + 1 / 60)], at(0), at(60))).toEqual([
      { participantId: "p:A1", slot: 1, fromMs: T0, toMs: null, handoffId: h[0].id },
    ]);
  });

  it("solo: the one participant from the event start, handoffs ignored", () => {
    const segs = onCourseTimeline("solo", mkEntry("S", 1), [mkHandoff("e:S", "p:S1", 5)], at(0), at(60));
    expect(segs).toEqual([{ participantId: "p:S1", slot: 1, fromMs: T0, toMs: null, handoffId: null }]);
  });
});

describe("the reference relay snapshot", () => {
  const snap = computeSnapshot(standardRelay());
  const A = entryA(snap);

  it("event block", () => {
    expect(snap.event).toMatchObject({ slug: "test", kind: "relay", units: "imperial", status: "live", length_m: 20_000, public_delay_s: 0 });
    expect(snap.as_of).toBe(atIso(49));
    expect(snap.generated_at).toBe(atIso(49));
    expect(snap.gaps).toEqual([]);
  });

  it("progress, remaining, percent, elapsed, average pace", () => {
    near(A.progress_m, 9000);
    near(A.remaining_m, 11_000);
    expect(A.percent).toBeCloseTo(45.0, 1);
    expect(A.elapsed_s).toBe(49 * 60);
    expect(A.avg_pace_s_per_km).toBe(Math.round((49 * 60) / 9));
    expect(A.finished).toBe(false);
    expect(A.finished_at).toBeNull();
  });

  it("legs, newest first, the open one live", () => {
    expect(A.legs.map((l) => l.no)).toEqual([2, 1]);
    const [live, done] = A.legs;
    expect(live).toMatchObject({ participant_id: "p:A2", live: true, end: null, start: atIso(25) });
    near(live.distance_m, 4000);
    expect(live.time_s).toBe(24 * 60);
    near(live.pace_s_per_km as number, 360, 1);
    expect(done).toMatchObject({ participant_id: "p:A1", live: false, start: atIso(0), end: atIso(25) });
    near(done.distance_m, 5000);
    expect(done.time_s).toBe(25 * 60);
    near(done.pace_s_per_km as number, 300, 1);
    expect("checkpoint_id" in done).toBe(false);
  });

  it("per participant", () => {
    const [a1, a2, a3] = A.participants;
    expect(a1).toMatchObject({ id: "p:A1", legs: 1, time_s: 1500, on_course: false, device_last_seen: atIso(25), device_battery_pct: 80 });
    near(a1.distance_m, 5000);
    near(a1.avg_pace_s_per_km as number, 300, 1);
    expect(a2).toMatchObject({ id: "p:A2", legs: 1, time_s: 1440, on_course: true, device_last_seen: atIso(49), device_battery_pct: 61 });
    near(a2.distance_m, 4000);
    expect(a3).toMatchObject({ id: "p:A3", legs: 0, distance_m: 0, time_s: 0, avg_pace_s_per_km: null, on_course: false, device_last_seen: null, device_battery_pct: null });
  });

  it("on course, next up: one slot, labelled \"1\"", () => {
    expect(A.slots).toBe(1);
    expect(A.slot_names).toEqual(["1"]);
    expect(A.on_course).toHaveLength(1);
    expect(A.on_course[0]).toMatchObject({ participant_id: "p:A2", initials: "A2", slot: 1, slot_name: "1", leg_no: 2, leg_started: atIso(25), leg_time_s: 1440 });
    near(A.on_course[0].leg_distance_m, 4000);
    expect(A.next_up).toHaveLength(1);
    expect(A.next_up[0]).toMatchObject({ participant_id: "p:A3" });
  });

  it("a flat route climbs nothing; legs carry their slot", () => {
    expect(A.elevation_gain_m).toBe(0);
    expect(A.elevation_remaining_m).toBe(0);
    expect(A.legs.map((l) => [l.slot, l.elevation_gain_m])).toEqual([
      [1, 0],
      [1, 0],
    ]);
    expect(A.participants.map((p) => p.elevation_gain_m)).toEqual([0, 0, 0]);
  });

  it("the dot is the fresh runner, on route", () => {
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A2", stale: false, off_route: false, age_s: 0, fix_time: atIso(49), battery_pct: 61 });
    near(A.position?.route_m as number, 9000);
  });

  it("checkpoints: passed ones have times, upcoming ones ETAs", () => {
    const [start, mid, far, finish] = A.checkpoints;
    expect(start).toMatchObject({ kind: "start", route_m: 0, passed_at: atIso(0), eta: null });
    nearIso(mid.passed_at, 25);
    expect(mid.eta).toBeNull();
    expect(far.passed_at).toBeNull();
    expect(finish.passed_at).toBeNull();
    // Far is 3 km ahead at ~327 s/km → about 16 min out.
    nearIso(far.eta, 49 + (3000 * (2940 / 9)) / 1000 / 60, 5);
    expect(Date.parse(far.eta_earliest as string)).toBeLessThan(Date.parse(far.eta as string));
    expect(Date.parse(far.eta_latest as string)).toBeGreaterThan(Date.parse(far.eta as string));
    expect(Date.parse(finish.eta as string)).toBeGreaterThan(Date.parse(far.eta as string));
    expect(finish.eta).toBe(A.eta.finish);
  });

  it("ETA and bests", () => {
    // Under 10 mi: recent pace = since the first sample = whole-event pace = 2940 s / 9 km.
    expect(A.eta.pace_s_per_km).toBe(Math.round(2940 / 9));
    nearIso(A.eta.finish, 49 + (11_000 * (2940 / 9)) / 1000 / 60, 5);
    const halfWidth = (Date.parse(A.eta.latest as string) - Date.parse(A.eta.earliest as string)) / 2000;
    expect(halfWidth).toBeCloseTo(600, 0); // max(10 min, 5 % of ~60 min)
    expect(A.bests.fastest_leg).toMatchObject({ leg_no: 1, participant_id: "p:A1" });
    near(A.bests.fastest_leg?.pace_s_per_km as number, 300, 1);
    expect(A.bests.longest_leg).toMatchObject({ leg_no: 1, participant_id: "p:A1" });
    near(A.bests.longest_leg?.distance_m as number, 5000);
  });

  it("rounds: whole metres and seconds, one-decimal percent, ISO instants", () => {
    expect(Number.isInteger(A.progress_m)).toBe(true);
    expect(Number.isInteger(A.legs[0].pace_s_per_km)).toBe(true);
    expect(String(A.percent)).toMatch(/^\d+(\.\d)?$/);
    expect(A.legs[1].end).toMatch(/Z$/);
  });
});

describe("progress interpolation at handoff times", () => {
  it("a tap between two fixes splits the leg at the interpolated progress", () => {
    const route = northRoute(20_000);
    // A1: 200 m/min, a fix every minute → 2000 m at 10:00, 2200 m at 11:00.
    // The tap lands at 10:30; A2's phone first reports at 11:00 from 2200 m.
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2)],
        positions: {
          "d:A1": walk(route, { fromM: 0, toM: 4000, fromMin: 0, paceSPerKm: 300, everyS: 60 }),
          "d:A2": walk(route, { fromM: 2200, toM: 2400, fromMin: 11, paceSPerKm: 300, everyS: 60 }),
        },
        handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 10.5)],
        asOfMin: 12,
      }),
    );
    const A = entryA(snap);
    const leg1 = A.legs.find((l) => l.no === 1)!;
    const leg2 = A.legs.find((l) => l.no === 2)!;
    near(leg1.distance_m, 2100);
    expect(leg1.time_s).toBe(630);
    near(leg2.distance_m, 300);
    expect(leg2.time_s).toBe(90);
    expect(leg2.live).toBe(true);
    // A1's fixes after the tap belong to a runner no longer on course: they moved nothing.
    near(A.progress_m, 2400);
  });
});

describe("gaps in fixes and backfill", () => {
  const route = northRoute(20_000);
  // Reality: A1 runs to 2 km by 10:00, stands still until 15:00, hands off at
  // 15:00; A2 runs 2→4 km from 15:00 to 25:00. Both phones are in a dead
  // zone from 10:00 to 20:00 and upload that window later.
  const a1 = [...walk(route, { fromM: 0, toM: 2000, fromMin: 0, paceSPerKm: 300 }), ...stand(route, { m: 2000, fromMin: 10.5, toMin: 15 })];
  const a2 = walk(route, { fromM: 2000, toM: 4000, fromMin: 15, paceSPerKm: 300 });
  const inDeadZone = (f: Fix) => f.fixTime.getTime() >= at(10).getTime() + 1 && f.fixTime.getTime() < at(20).getTime();
  const build = (positions: Record<string, Fix[]>) =>
    computeSnapshot(mkInput({ route, entries: [mkEntry("A", 2)], positions, handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 15)], asOfMin: 25 }));

  it("with the window missing, the leg split is interpolated across the gap", () => {
    const partial = build({ "d:A1": a1.filter((f) => !inDeadZone(f)), "d:A2": a2.filter((f) => !inDeadZone(f)) });
    const A = entryA(partial);
    near(A.progress_m, 4000);
    // Interpolating (10:00, 2000) → (20:00, 3000) puts the 15:00 tap at 2500 m.
    near(A.legs.find((l) => l.no === 1)!.distance_m, 2500);
    near(A.legs.find((l) => l.no === 2)!.distance_m, 1500);
  });

  it("when the burst arrives the totals correct themselves and the result is arrival-order independent", () => {
    const full = build({ "d:A1": a1, "d:A2": a2 });
    const A = entryA(full);
    near(A.progress_m, 4000);
    near(A.legs.find((l) => l.no === 1)!.distance_m, 2000); // the stop is now visible
    near(A.legs.find((l) => l.no === 2)!.distance_m, 2000);
    expect(A.participants[0].time_s).toBe(900);
    expect(A.participants[1].time_s).toBe(600);

    // Backfill: the dead-zone fixes delivered AFTER the newer ones (and in reverse) compute identically.
    const lateFirst = (list: Fix[]) => [...list.filter((f) => !inDeadZone(f)), ...list.filter(inDeadZone).reverse()];
    const backfilled = build({ "d:A1": lateFirst(a1), "d:A2": lateFirst(a2) });
    expect(backfilled).toEqual(full);
  });
});

describe("what does not advance progress", () => {
  const route = northRoute(20_000);

  it("vehicle fixes never do, but the van is the dot when the runner is silent", () => {
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2)],
        positions: {
          "d:A1": [fixOnRoute(route, 0, at(0))],
          "d:van-A": walk(route, { fromM: 0, toM: 8000, fromMin: 0, paceSPerKm: 60 }), // drives ahead in 8 min
        },
        handoffs: [mkHandoff("e:A", "p:A1", 0)],
        asOfMin: 9,
      }),
    );
    const A = entryA(snap);
    near(A.progress_m, 0);
    expect(A.position).toMatchObject({ source: "vehicle", participant_id: null, stale: false, age_s: 60 });
    near(A.position?.route_m as number, 8000);
  });

  it("a fix > 300 m off route is kept for the map only", () => {
    const positions = {
      "d:A1": [
        ...walk(route, { fromM: 0, toM: 2000, fromMin: 0, paceSPerKm: 300 }),
        fixOnRoute(route, 3000, at(11), { eastM: 500 }), // a detour, or a GPS glitch
        fixOnRoute(route, 2500, at(12)),
      ],
    };
    const handoffs = [mkHandoff("e:A", "p:A1", 0)];
    const atGlitch = entryA(computeSnapshot(mkInput({ route, entries: [mkEntry("A", 1)], positions, handoffs, asOfMin: 11 })));
    near(atGlitch.progress_m, 2000);
    expect(atGlitch.position).toMatchObject({ source: "runner", off_route: true, route_m: null, stale: false });
    const after = entryA(computeSnapshot(mkInput({ route, entries: [mkEntry("A", 1)], positions, handoffs, asOfMin: 12 })));
    near(after.progress_m, 2500);
    expect(after.position).toMatchObject({ off_route: false });
    near(after.position?.route_m as number, 2500);
  });

  it("fixes before the first handoff leave progress at 0 (nobody is on course)", () => {
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2)],
        positions: { "d:A1": walk(route, { fromM: 0, toM: 4000, fromMin: 0, paceSPerKm: 300 }) },
        asOfMin: 20,
      }),
    );
    const A = entryA(snap);
    expect(A.progress_m).toBe(0);
    expect(A.legs).toEqual([]);
    expect(A.on_course).toEqual([]);
    expect(A.next_up[0]).toMatchObject({ participant_id: "p:A1" });
    expect(A.participants[0]).toMatchObject({ legs: 0, distance_m: 0, device_last_seen: atIso(20) });
    expect(A.position).toBeNull(); // no van fixes either; the runner is not on course so his phone is not the dot
    expect(A.eta).toEqual({ finish: null, earliest: null, latest: null, pace_s_per_km: null });
    expect(A.checkpoints[0].passed_at).toBeNull();
  });

  it("voided handoffs are ignored, and the voided runner's fixes move nothing", () => {
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2)],
        positions: {
          "d:A1": walk(route, { fromM: 0, toM: 4000, fromMin: 0, paceSPerKm: 300 }),
          "d:A2": walk(route, { fromM: 5000, toM: 6000, fromMin: 10, paceSPerKm: 300 }),
        },
        handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 10, true)],
        asOfMin: 20,
      }),
    );
    const A = entryA(snap);
    near(A.progress_m, 4000);
    expect(A.legs).toHaveLength(1);
    expect(A.on_course[0]?.participant_id).toBe("p:A1");
    expect(A.participants[1].legs).toBe(0);
  });

  it("solo: fixes before the event start (driving to the start along the course) do not count", () => {
    const snap = computeSnapshot(
      mkInput({
        kind: "solo",
        route,
        entries: [mkEntry("S", 1, { vehicle: false })],
        positions: { "d:S1": [fixOnRoute(route, 3000, at(-3)), ...walk(route, { fromM: 0, toM: 1000, fromMin: 0, paceSPerKm: 300 })] },
        asOfMin: 5,
      }),
    );
    near(snap.entries[0].progress_m, 1000);
  });
});

describe("the fallback chain for the dot", () => {
  const route = northRoute(20_000);
  const runnerTo10 = walk(route, { fromM: 0, toM: 2000, fromMin: 0, paceSPerKm: 300 });
  const build = (positions: Record<string, Fix[]>, asOfMin: number, baton = false) =>
    entryA(computeSnapshot(mkInput({ route, entries: [mkEntry("A", 2, { baton })], positions, handoffs: [mkHandoff("e:A", "p:A1", 0)], asOfMin })));

  it("fresh runner → runner", () => {
    const A = build({ "d:A1": runnerTo10, "d:van-A": [fixOnRoute(route, 4000, at(10))] }, 11);
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A1", stale: false, age_s: 60 });
  });

  it("stale runner + fresh vehicle → vehicle, labelled, not stale", () => {
    const A = build({ "d:A1": runnerTo10, "d:van-A": [fixOnRoute(route, 4000, at(19))] }, 20);
    expect(A.position).toMatchObject({ source: "vehicle", participant_id: null, stale: false, age_s: 60 });
    near(A.position?.route_m as number, 4000);
    near(A.progress_m, 2000); // the van did not move the team
  });

  it("stale runner + fresh baton → baton before vehicle", () => {
    const A = build({ "d:A1": runnerTo10, "d:baton-A": [fixOnRoute(route, 2300, at(19.5))], "d:van-A": [fixOnRoute(route, 4000, at(19))] }, 20, true);
    expect(A.position).toMatchObject({ source: "baton", stale: false, age_s: 30 });
    near(A.progress_m, 2300); // the baton DOES advance progress
  });

  it("all stale → the newest across the chain, marked stale", () => {
    const A = build({ "d:A1": runnerTo10, "d:van-A": [fixOnRoute(route, 4000, at(12))] }, 20);
    expect(A.position).toMatchObject({ source: "vehicle", stale: true, age_s: 480 });
    const B = build({ "d:A1": runnerTo10, "d:van-A": [fixOnRoute(route, 4000, at(8))] }, 20);
    expect(B.position).toMatchObject({ source: "runner", participant_id: "p:A1", stale: true, age_s: 600 });
  });

  it("exactly FRESH_FIX_S old is still fresh; nothing at all → null", () => {
    const A = build({ "d:A1": [fixOnRoute(route, 100, at(20 - FRESH_FIX_S / 60))] }, 20);
    expect(A.position).toMatchObject({ stale: false, age_s: FRESH_FIX_S });
    expect(build({}, 20).position).toBeNull();
  });

  it("a vehicle known only by its newest fix (no history loaded) is still the dot when the runner is stale", () => {
    // snapshot.ts never loads a van's history, only its newest fix: the chain must read latestFix.
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [mkEntry("A", 2)],
          positions: { "d:A1": runnerTo10 },
          latestFix: { "d:van-A": fixOnRoute(route, 4000, at(19), { battery: 55 }) },
          handoffs: [mkHandoff("e:A", "p:A1", 0)],
          asOfMin: 20,
        }),
      ),
    );
    expect(A.position).toMatchObject({ source: "vehicle", participant_id: null, stale: false, age_s: 60, battery_pct: 55 });
    near(A.position?.route_m as number, 4000);
    near(A.progress_m, 2000); // still nothing a van can move
  });

  it("latestFix feeds device_last_seen and the runner's own age; one stamped after as-of does not exist yet", () => {
    // A1's loaded history stops at 10 min; his phone's newest fix is at 15 min. A2 is idle in the
    // van: no on-course window, so no history, and his newest fix is stamped after as-of.
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [mkEntry("A", 2)],
          positions: { "d:A1": runnerTo10 },
          latestFix: { "d:A1": fixOnRoute(route, 2000, at(15), { battery: 33 }), "d:A2": fixOnRoute(route, 0, at(30), { battery: 90 }) },
          handoffs: [mkHandoff("e:A", "p:A1", 0)],
          asOfMin: 20,
        }),
      ),
    );
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A1", stale: true, age_s: 300, fix_time: atIso(15), battery_pct: 33 });
    expect(A.participants[0]).toMatchObject({ device_last_seen: atIso(15), device_battery_pct: 33 });
    expect(A.participants[1]).toMatchObject({ device_last_seen: null, device_battery_pct: null });
    near(A.progress_m, 2000); // a newest fix is for the dot and the checks, never progress
  });

  it("a newest fix without a battery reading falls back to the loaded history for the battery", () => {
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [mkEntry("A", 1)],
          positions: { "d:A1": runnerTo10 },
          latestFix: { "d:A1": fixOnRoute(route, 2000, at(15), { battery: null }) },
          handoffs: [mkHandoff("e:A", "p:A1", 0)],
          asOfMin: 20,
        }),
      ),
    );
    expect(A.participants[0]).toMatchObject({ device_last_seen: atIso(15), device_battery_pct: 80 });
    expect(A.position).toMatchObject({ fix_time: atIso(15), battery_pct: null });
  });
});

describe("a finished entry's dot", () => {
  const route = northRoute(20_000);
  // A1 0→10 km, A2 10→20 km, both at 5:00/km: finished (19 950 m) at 99.75 min, A2's last fix at 100 min.
  const positions = {
    "d:A1": walk(route, { fromM: 0, toM: 10_000, fromMin: 0, paceSPerKm: 300 }),
    "d:A2": walk(route, { fromM: 10_000, toM: 20_000, fromMin: 50, paceSPerKm: 300 }),
  };
  const handoffs = [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 50)];
  const build = (extra: Record<string, Fix[]>, asOfMin: number, baton = false) =>
    entryA(computeSnapshot(mkInput({ route, entries: [mkEntry("A", 2, { baton })], positions: { ...positions, ...extra }, handoffs, asOfMin })));

  it("is the finisher's, fresh, even beside a fresh van", () => {
    const A = build({ "d:van-A": [fixOnRoute(route, 12_000, at(101))] }, 101);
    expect(A.finished).toBe(true);
    expect(A.on_course).toEqual([]);
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A2", stale: false, age_s: 60, fix_time: atIso(100) });
  });

  it("never follows the van home: a stale finisher beats a fresh vehicle, and is marked stale", () => {
    const A = build({ "d:van-A": [fixOnRoute(route, 15_000, at(105)), fixOnRoute(route, 12_000, at(110))] }, 110);
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A2", stale: true, age_s: 600, fix_time: atIso(100) });
    near(A.position?.route_m as number, 20_000);
  });

  it("the baton is still the second source", () => {
    const A = build({ "d:baton-A": [fixOnRoute(route, 19_980, at(109))], "d:van-A": [fixOnRoute(route, 12_000, at(110))] }, 110, true);
    expect(A.position).toMatchObject({ source: "baton", participant_id: null, stale: false, age_s: 60 });
  });
});

describe("ETA", () => {
  const route = northRoute(30_000);
  const trueFinishMin = 150; // 30 km at 5:00/km
  const fixes = walk(route, { fromM: 0, toM: 30_000, fromMin: 0, paceSPerKm: 300 });
  const build = (asOfMin: number) =>
    computeSnapshot(mkInput({ kind: "solo", route, entries: [mkEntry("S", 1, { vehicle: false })], positions: { "d:S1": fixes }, asOfMin, checkpoints: mkCheckpoints(30_000) }));

  it("no estimate below 1 km of progress", () => {
    const e = build(4).entries[0]; // 800 m
    expect(e.eta).toEqual({ finish: null, earliest: null, latest: null, pace_s_per_km: null });
    expect(e.checkpoints[3].eta).toBeNull();
  });

  it("converges on the true finish and the true checkpoint crossing at every stage", () => {
    for (const asOfMin of [10, 30, 60, 100, 140]) {
      const e = build(asOfMin).entries[0];
      const finish = Date.parse(e.eta.finish as string);
      const halfWidthS = (Date.parse(e.eta.latest as string) - Date.parse(e.eta.earliest as string)) / 2000;
      expect(Math.abs(finish - at(trueFinishMin).getTime()) / 1000).toBeLessThanOrEqual(halfWidthS);
      expect(Math.abs(finish - at(trueFinishMin).getTime()) / 1000).toBeLessThan(10); // constant pace: essentially exact
      expect(e.eta.pace_s_per_km).toBe(300);
      const far = e.checkpoints[2]; // 25 km → true crossing at 125 min
      if (asOfMin < 125) {
        nearIso(far.eta, 125, 10);
        expect(far.passed_at).toBeNull();
      } else {
        nearIso(far.passed_at, 125, 2);
        expect(far.eta).toBeNull();
      }
    }
  });

  it("the window is ± max(10 min, 5 % of the remaining time)", () => {
    const early = build(10).entries[0]; // 140 min remaining → 7 min < 10 min floor
    const earlyHalf = (Date.parse(early.eta.latest as string) - Date.parse(early.eta.earliest as string)) / 2000;
    expect(earlyHalf).toBeCloseTo(600, -1);
    const s = seriesFromSamples([T0, T0 + 3_600_000], [0, 12_000]);
    const est = estimateEta({ progressSeries: s, progressM: 12_000, remainingM: 200_000, asOf: new Date(T0 + 3_600_000), startTime: new Date(T0) });
    // 200 km at 300 s/km = 60 000 s remaining → 5 % = 3000 s half-width.
    expect((est.latest!.getTime() - est.earliest!.getTime()) / 2000).toBeCloseTo(3000, 0);
    expect(est.pace_s_per_km).toBeCloseTo(300, 6);
  });

  it("blends 70 % recent (last 10 mi) with 30 % whole-event pace", () => {
    // 20 km in 100 min overall (300 s/km), but the last 10 mi were run at 360 s/km.
    const slowStartMin = (20_000 - 16_093.4) / 1000 * (300 / 60); // the first 3.9 km at 5:00/km
    const t: number[] = [T0, T0 + slowStartMin * 60_000, T0 + slowStartMin * 60_000 + 16.0934 * 360 * 1000];
    const m: number[] = [0, 20_000 - 16_093.4, 20_000];
    const s = seriesFromSamples(t, m);
    const asOf = new Date(t[2]);
    const parts = etaPaceParts(s, 20_000, asOf, new Date(T0));
    expect(parts.recent).toBeCloseTo(360, 3);
    expect(parts.whole).toBeCloseTo((t[2] - T0) / 1000 / 20, 3);
    expect(parts.blended).toBeCloseTo(0.7 * 360 + 0.3 * (parts.whole as number), 3);
  });
});

describe("gaps between entries", () => {
  it("distance and 'how long ago the leader was there', leader first", () => {
    const route = northRoute(20_000);
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2), mkEntry("B", 2)],
        positions: {
          "d:A1": walk(route, { fromM: 0, toM: 9000, fromMin: 0, paceSPerKm: 300 }), // reaches 6 km at 30 min
          "d:B1": walk(route, { fromM: 0, toM: 6000, fromMin: 0, paceSPerKm: 450 }),
        },
        handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:B", "p:B1", 0)],
        asOfMin: 45,
      }),
    );
    expect(snap.gaps).toHaveLength(1);
    expect(snap.gaps[0]).toMatchObject({ ahead: "e:A", behind: "e:B" });
    near(snap.gaps[0].distance_m, 3000);
    near(snap.gaps[0].time_s as number, 900, 2);
    expect(snap.entries.map((e) => e.id)).toEqual(["e:A", "e:B"]); // entries stay in sort order, not progress order
  });

  it("time is measured at the trailer's last fix, null when the leader's series cannot say; three entries make two gaps", () => {
    const s = seriesFromSamples([T0, T0 + 60_000], [0, 1000]);
    const gaps = computeGaps(
      [
        { id: "x", progressM: 1000, series: s },
        // y was last seen at 500 m at T0+60 s; x passed 500 m at T0+30 s → 30 s behind,
        // however long ago y was last seen (not asOf − when, which would say 90 s).
        { id: "y", progressM: 500, series: seriesFromSamples([T0 + 60_000], [500]) },
        // z has never reported: measured against asOf (y passed 0 m at T0+60 s).
        { id: "z", progressM: 0, series: seriesFromSamples([], []) },
      ],
      T0 + 120_000,
    );
    expect(gaps).toEqual([
      { ahead: "x", behind: "y", distance_m: 500, time_s: 30 },
      { ahead: "y", behind: "z", distance_m: 500, time_s: 60 },
    ]);
    expect(computeGaps([{ id: "y", progressM: 0, series: seriesFromSamples([], []) }, { id: "x", progressM: 10, series: seriesFromSamples([], []) }], T0)[0]).toEqual({
      ahead: "x",
      behind: "y",
      distance_m: 10,
      time_s: null,
    });
  });
});

describe("solo: checkpoint-split legs", () => {
  it("one leg per checkpoint crossing, the remainder live, checkpoint_id set", () => {
    const route = northRoute(20_000);
    const snap = computeSnapshot(
      mkInput({
        kind: "solo",
        route,
        entries: [mkEntry("S", 1, { vehicle: false })],
        positions: { "d:S1": walk(route, { fromM: 0, toM: 15_000, fromMin: 0, paceSPerKm: 300 }) },
        asOfMin: 75,
      }),
    );
    const S = snap.entries[0];
    expect(S.legs.map((l) => l.no)).toEqual([3, 2, 1]);
    const [live, leg2, leg1] = S.legs;
    expect(leg1).toMatchObject({ participant_id: "p:S1", start: atIso(0), checkpoint_id: "cp:2", live: false });
    nearIso(leg1.end, 25);
    near(leg1.distance_m, 5000);
    expect(leg2).toMatchObject({ checkpoint_id: "cp:3", live: false });
    nearIso(leg2.start, 25);
    nearIso(leg2.end, 60);
    near(leg2.distance_m, 7000);
    expect(live).toMatchObject({ live: true, end: null, checkpoint_id: null });
    near(live.distance_m, 3000);
    expect(S.participants[0]).toMatchObject({ legs: 3, time_s: 4500, on_course: true });
    near(S.participants[0].distance_m, 15_000);
    expect(S.on_course).toHaveLength(1);
    expect(S.on_course[0]).toMatchObject({ participant_id: "p:S1", slot: 1, leg_no: 3 });
    expect(S.next_up).toEqual([null]);
    expect(S.legs.every((l) => l.slot === 1)).toBe(true);
    expect(S.bests.longest_leg).toMatchObject({ leg_no: 2 });
  });
});

describe("public delay", () => {
  it("the snapshot is built as of generated_at minus the delay: newer fixes and handoffs do not exist", () => {
    const route = northRoute(20_000);
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2)],
        positions: { "d:A1": walk(route, { fromM: 0, toM: 6000, fromMin: 0, paceSPerKm: 300 }) },
        handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 25)],
        asOfMin: 20,
        generatedAtMin: 30,
        publicDelayS: 600,
      }),
    );
    expect(snap.as_of).toBe(atIso(20));
    expect(snap.generated_at).toBe(atIso(30));
    expect(snap.event.public_delay_s).toBe(600);
    const A = entryA(snap);
    near(A.progress_m, 4000);
    expect(A.on_course[0]?.participant_id).toBe("p:A1");
    expect(A.legs).toHaveLength(1);
    expect(A.position).toMatchObject({ fix_time: atIso(20), age_s: 0, stale: false });
    expect(A.elapsed_s).toBe(1200);
  });
});

describe("finishing and status", () => {
  const route = northRoute(20_000);

  it("a finished entry freezes: finished_at, ETA = the fact, nobody on course, no live leg", () => {
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 2)],
        positions: { "d:A1": walk(route, { fromM: 0, toM: 20_000, fromMin: 0, paceSPerKm: 300 }) },
        handoffs: [mkHandoff("e:A", "p:A1", 0)],
        asOfMin: 105,
      }),
    );
    const A = entryA(snap);
    expect(A.finished).toBe(true);
    // Finished when progress first reached length − 50 m: 19 950 m at 5:00/km = 5985 s.
    nearIso(A.finished_at, 5985 / 60, 2);
    expect(A.eta.finish).toBe(A.finished_at);
    expect(A.eta.earliest).toBe(A.finished_at);
    expect(A.eta.latest).toBe(A.finished_at);
    expect(A.remaining_m).toBe(0);
    expect(A.percent).toBe(100);
    expect(A.on_course).toEqual([]);
    expect(A.next_up).toEqual([null]);
    expect(A.elevation_remaining_m).toBe(0);
    expect(A.legs[0]).toMatchObject({ live: false, end: A.finished_at });
    expect(A.participants[0].on_course).toBe(false);
    near(A.elapsed_s, 5985, 2); // the clock stopped at the finish
    expect(A.checkpoints[3].passed_at).toBe(A.finished_at);
    expect(A.checkpoints[3].eta).toBeNull();
    expect(snap.event.status).toBe("finished");
  });

  it("status: upcoming before the start, live during, archived when the event says so", () => {
    const base = standardRelay();
    expect(computeSnapshot({ ...base, asOf: at(-5), generatedAt: at(-5) }).event.status).toBe("upcoming");
    expect(entryA(computeSnapshot({ ...base, asOf: at(-5), generatedAt: at(-5) })).elapsed_s).toBe(0);
    expect(computeSnapshot(base).event.status).toBe("live");
    expect(computeSnapshot({ ...base, event: { ...base.event, status: "archived" } }).event.status).toBe("archived");
  });

  it("the event is finished only when EVERY entry is", () => {
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 1), mkEntry("B", 1)],
        positions: {
          "d:A1": walk(route, { fromM: 0, toM: 20_000, fromMin: 0, paceSPerKm: 300 }),
          "d:B1": walk(route, { fromM: 0, toM: 10_000, fromMin: 0, paceSPerKm: 300 }),
        },
        handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:B", "p:B1", 0)],
        asOfMin: 105,
      }),
    );
    expect(snap.event.status).toBe("live");
    expect(snap.entries.map((e) => e.finished)).toEqual([true, false]);
    expect(snap.gaps[0]).toMatchObject({ ahead: "e:A", behind: "e:B" });
  });

  it("a tap recorded after the finish neither extends the finishing leg nor adds a leg", () => {
    // A1 0→10 km, A2 10→20 km at 5:00/km: finished at 99.75 min. The crew taps A3 at 102 min out
    // of habit, then A1 at 104: both land after the finish and open nothing.
    const positions = {
      "d:A1": walk(route, { fromM: 0, toM: 10_000, fromMin: 0, paceSPerKm: 300 }),
      "d:A2": walk(route, { fromM: 10_000, toM: 20_000, fromMin: 50, paceSPerKm: 300 }),
    };
    const build = (handoffs: ComputeHandoff[]) => entryA(computeSnapshot(mkInput({ route, entries: [mkEntry("A", 3)], positions, handoffs, asOfMin: 105 })));
    const A = build([mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 50), mkHandoff("e:A", "p:A3", 102), mkHandoff("e:A", "p:A1", 104)]);
    expect(A.finished).toBe(true);
    nearIso(A.finished_at, 99.75, 2);
    expect(A.legs.map((l) => l.no)).toEqual([2, 1]);
    expect(A.legs[0]).toMatchObject({ participant_id: "p:A2", live: false, end: A.finished_at });
    near(A.legs[0].time_s, 49.75 * 60, 2); // to the finish, not to the 102 min tap
    near(A.legs[0].distance_m, 9950);
    expect(A.participants[1]).toMatchObject({ legs: 1 });
    near(A.participants[1].time_s, 49.75 * 60, 2);
    expect(A.participants[2]).toMatchObject({ legs: 0, distance_m: 0, time_s: 0 });
    expect(A.participants[0]).toMatchObject({ legs: 1 });
    expect(A.on_course).toEqual([]);
    expect(A.next_up).toEqual([null]);
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A2" }); // the finisher, not the 104 min tap
    // Without the stray taps the entry computes identically.
    expect(A).toEqual(build([mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 50)]));
  });
});

describe("bests", () => {
  it("fastest needs a COMPLETED leg of at least 1 km; longest is any completed leg", () => {
    const route = northRoute(20_000);
    const snap = computeSnapshot(
      mkInput({
        route,
        entries: [mkEntry("A", 3)],
        positions: {
          "d:A1": walk(route, { fromM: 0, toM: 800, fromMin: 0, paceSPerKm: 240 }), // fast but short: 3.2 min
          "d:A2": walk(route, { fromM: 800, toM: 5800, fromMin: 3.2, paceSPerKm: 360 }), // 30 min
          "d:A3": walk(route, { fromM: 5800, toM: 9800, fromMin: 33.2, paceSPerKm: 200 }), // live, faster still
        },
        handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 3.2), mkHandoff("e:A", "p:A3", 33.2)],
        asOfMin: 46.5,
      }),
    );
    const A = entryA(snap);
    expect(A.bests.fastest_leg).toMatchObject({ leg_no: 2, participant_id: "p:A2" });
    expect(A.bests.longest_leg).toMatchObject({ leg_no: 2 });
    near(A.bests.longest_leg?.distance_m as number, 5000);
    expect(A.legs.find((l) => l.no === 3)?.live).toBe(true);
  });

  it("nothing completed → both null", () => {
    expect(entryA(computeSnapshot(standardRelay(10))).bests).toEqual({ fastest_leg: null, longest_leg: null });
  });
});

/* ─── Pairs (owner, 2026-10-15: "we are running two by two … we just have the roster") ── */

describe("pairs: two slots on one entry", () => {
  const route = northRoute(20_000);
  const pair = () => mkEntry("A", 6, { slots: 2, slotNames: ["A", "B"] });
  /**
   * The reference pair: R1 takes A and R2 takes B at the start and run side
   * by side 0→5 km at 5:00/km; at 25 min R3 takes A and R4 takes B (taps a
   * second apart, as a crew really does) and run to 9 km at 6:00/km, as of
   * 49 min. Same progress curve as the one-slot reference relay.
   */
  const pairRelay = (asOfMin = 49, extra: Partial<ComputeInput> = {}): ComputeInput => ({
    ...mkInput({
      route,
      entries: [pair()],
      positions: {
        "d:A1": walk(route, { fromM: 0, toM: 5000, fromMin: 0, paceSPerKm: 300 }),
        "d:A2": walk(route, { fromM: 0, toM: 5000, fromMin: 0, paceSPerKm: 300, battery: 70 }),
        "d:A3": walk(route, { fromM: 5000, toM: 9000, fromMin: 25, paceSPerKm: 360 }),
        "d:A4": walk(route, { fromM: 5000, toM: 9000, fromMin: 25, paceSPerKm: 360, battery: 61 }),
      },
      handoffs: [
        mkHandoff("e:A", "p:A1", 0, false, 1),
        mkHandoff("e:A", "p:A2", 0, false, 2),
        mkHandoff("e:A", "p:A3", 25, false, 1),
        mkHandoff("e:A", "p:A4", 25 + 1 / 60, false, 2),
      ],
      asOfMin,
    }),
    ...extra,
  });

  it("the timeline is per slot: a tap for slot B replaces the holder of slot B only, and the 2 s rule is per slot", () => {
    const entry = pair();
    const taps = pairRelay().handoffs;
    const segs = onCourseTimeline("relay", entry, taps, at(0), at(60));
    expect(segs.map((s) => [s.participantId, s.slot, s.fromMs, s.toMs])).toEqual([
      ["p:A1", 1, T0, at(25).getTime()],
      ["p:A2", 2, T0, at(25 + 1 / 60).getTime()],
      ["p:A3", 1, at(25).getTime(), null],
      ["p:A4", 2, at(25 + 1 / 60).getTime(), null], // one second after A's tap: NOT merged into one exchange
    ]);
    expect(onCourseAt(segs, at(10).getTime(), 1)?.participantId).toBe("p:A1");
    expect(onCourseAt(segs, at(10).getTime(), 2)?.participantId).toBe("p:A2");
    expect(onCourseAt(segs, at(25).getTime(), 1)?.participantId).toBe("p:A3");
    expect(onCourseAt(segs, at(25).getTime(), 2)?.participantId).toBe("p:A2"); // B's tap lands a second later
    expect(holdersAt(segs, at(30).getTime(), 2).map((s) => s?.participantId)).toEqual(["p:A3", "p:A4"]);
    expect(holdersAt(segs, at(-1).getTime(), 2)).toEqual([null, null]);
    // The per-slot rules still hold inside a slot: a replay in B and a corrected B tap touch nothing in A.
    const replayed = onCourseTimeline("relay", entry, [...taps, mkHandoff("e:A", "p:A4", 26, false, 2)], at(0), at(60));
    expect(replayed).toEqual(segs);
    const corrected = onCourseTimeline("relay", entry, [...taps, mkHandoff("e:A", "p:A5", 25 + 2 / 60, false, 2)], at(0), at(60));
    expect(corrected.map((s) => [s.participantId, s.slot])).toEqual([
      ["p:A1", 1],
      ["p:A2", 2],
      ["p:A3", 1],
      ["p:A5", 2], // the later runner at the earlier time, in B only
    ]);
    expect(carriesAt(segs, at(10).getTime(), "p:A2")).toBe(true);
    expect(carriesAt(segs, at(10).getTime(), "p:A3")).toBe(false);
    expect(carriesAt(segs, at(10).getTime(), null)).toBe(true); // a baton: anyone is on course
    expect(carriesAt(segs, at(-1).getTime(), null)).toBe(false);
  });

  it("a slot-B tap does not evict slot A", () => {
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [pair()],
          positions: {
            "d:A1": walk(route, { fromM: 0, toM: 4000, fromMin: 0, paceSPerKm: 300 }),
            "d:A2": walk(route, { fromM: 0, toM: 2000, fromMin: 0, paceSPerKm: 300 }),
            "d:A4": walk(route, { fromM: 2000, toM: 4000, fromMin: 10, paceSPerKm: 300 }),
          },
          handoffs: [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A2", 0, false, 2), mkHandoff("e:A", "p:A4", 10, false, 2)],
          asOfMin: 20,
        }),
      ),
    );
    expect(A.on_course.map((o) => [o.participant_id, o.slot, o.slot_name, o.leg_no])).toEqual([
      ["p:A1", 1, "A", 1], // still running leg 1
      ["p:A4", 2, "B", 3],
    ]);
    expect(A.legs.map((l) => [l.no, l.participant_id, l.slot, l.live])).toEqual([
      [3, "p:A4", 2, true],
      [2, "p:A2", 2, false],
      [1, "p:A1", 1, true],
    ]);
    near(A.legs[1].distance_m, 2000);
    expect(A.legs[1].end).toBe(atIso(10));
    near(A.on_course[0].leg_distance_m, 4000);
    expect(A.on_course[0].leg_time_s).toBe(1200);
  });

  it("one runner, one slot: tapped into A and later into B, the runner leaves A — A is empty, the A leg closes at the B tap", () => {
    const entry = pair();
    const taps = [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A2", 0, false, 2), mkHandoff("e:A", "p:A1", 10, false, 2)];
    const segs = onCourseTimeline("relay", entry, taps, at(0), at(60));
    expect(segs.map((s) => [s.participantId, s.slot, s.fromMs, s.toMs])).toEqual([
      ["p:A1", 1, T0, at(10).getTime()],
      ["p:A2", 2, T0, at(10).getTime()],
      ["p:A1", 2, at(10).getTime(), null],
    ]);
    expect(holdersAt(segs, at(15).getTime(), 2).map((s) => s?.participantId ?? null)).toEqual([null, "p:A1"]);
    expect(onCourseAt(segs, at(9.99).getTime(), 1)?.participantId).toBe("p:A1");
    expect(onCourseAt(segs, at(10).getTime(), 1)).toBeNull();
    // A tap into the emptied slot opens a fresh leg there; the released one is not re-extended.
    const refilled = onCourseTimeline("relay", entry, [...taps, mkHandoff("e:A", "p:A3", 12, false, 1)], at(0), at(60));
    expect(refilled.map((s) => [s.participantId, s.slot, s.fromMs, s.toMs])).toEqual([
      ["p:A1", 1, T0, at(10).getTime()],
      ["p:A2", 2, T0, at(10).getTime()],
      ["p:A1", 2, at(10).getTime(), null],
      ["p:A3", 1, at(12).getTime(), null],
    ]);
    // The snapshot counts the runner once: one live leg (in B), and their
    // time is the clock — not the B leg on top of an A leg still running.
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [entry],
          positions: { "d:A1": walk(route, { fromM: 0, toM: 4000, fromMin: 0, paceSPerKm: 300 }) },
          handoffs: taps,
          asOfMin: 20,
        }),
      ),
    );
    expect(A.on_course.map((o) => [o.participant_id, o.slot, o.leg_no])).toEqual([["p:A1", 2, 3]]);
    expect(A.legs.map((l) => [l.no, l.participant_id, l.slot, l.live, l.end])).toEqual([
      [3, "p:A1", 2, true, null],
      [2, "p:A2", 2, false, atIso(10)],
      [1, "p:A1", 1, false, atIso(10)],
    ]);
    expect(A.participants[0]).toMatchObject({ legs: 2, time_s: 1200, on_course: true }); // 0→10 in A, 10→20 in B: 20 min, not 30
    near(A.participants[0].distance_m, 4000);
    expect(A.participants[1]).toMatchObject({ legs: 1, time_s: 600, on_course: false });
    near(A.progress_m, 4000);
    expect(A.next_up.map((n) => n?.participant_id)).toEqual(["p:A2", "p:A3"]);
  });

  it("two crew phones tapping the same runner into A and B a second apart: one holding, in the later tap's slot, the other slot untouched", () => {
    const entry = pair();
    const start = [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A2", 0, false, 2)];
    const aThenB = [...start, mkHandoff("e:A", "p:A3", 25, false, 1), mkHandoff("e:A", "p:A3", 25 + 1 / 60, false, 2)];
    const segsAB = onCourseTimeline("relay", entry, aThenB, at(0), at(60));
    expect(segsAB.map((s) => [s.participantId, s.slot, s.fromMs, s.toMs])).toEqual([
      ["p:A1", 1, T0, null], // the A tap never happened there: R1 is still running
      ["p:A2", 2, T0, at(25 + 1 / 60).getTime()],
      ["p:A3", 2, at(25 + 1 / 60).getTime(), null],
    ]);
    expect(holdersAt(segsAB, at(30).getTime(), 2).map((s) => s?.participantId)).toEqual(["p:A1", "p:A3"]);
    const bThenA = [...start, mkHandoff("e:A", "p:A3", 25, false, 2), mkHandoff("e:A", "p:A3", 25 + 1 / 60, false, 1)];
    const segsBA = onCourseTimeline("relay", entry, bThenA, at(0), at(60));
    expect(segsBA).toHaveLength(3);
    expect(holdersAt(segsBA, at(30).getTime(), 2).map((s) => s?.participantId)).toEqual(["p:A3", "p:A2"]);
    // No sliver leg: the snapshot is the one a single B tap gives — the runner has one leg, counted once.
    const build = (handoffs: ComputeHandoff[]) =>
      entryA(
        computeSnapshot(
          mkInput({ route, entries: [entry], positions: { "d:A1": walk(route, { fromM: 0, toM: 6000, fromMin: 0, paceSPerKm: 300 }) }, handoffs, asOfMin: 30 }),
        ),
      );
    const A = build(aThenB);
    expect(A).toEqual(build([...start, mkHandoff("e:A", "p:A3", 25 + 1 / 60, false, 2)]));
    expect(A.participants[2]).toMatchObject({ legs: 1, on_course: true });
    expect(A.on_course.map((o) => [o.participant_id, o.slot])).toEqual([
      ["p:A1", 1],
      ["p:A3", 2],
    ]);
    // Three seconds apart is a move, not a mis-slot: the A leg closes at the B tap and A is empty.
    const moved = onCourseTimeline(
      "relay",
      entry,
      [...start, mkHandoff("e:A", "p:A3", 25, false, 1), mkHandoff("e:A", "p:A3", 25 + 3 / 60, false, 2)],
      at(0),
      at(60),
    );
    expect(moved.map((s) => [s.participantId, s.slot, s.fromMs, s.toMs])).toEqual([
      ["p:A1", 1, T0, at(25).getTime()],
      ["p:A2", 2, T0, at(25 + 3 / 60).getTime()],
      ["p:A3", 1, at(25).getTime(), at(25 + 3 / 60).getTime()],
      ["p:A3", 2, at(25 + 3 / 60).getTime(), null],
    ]);
    expect(holdersAt(moved, at(30).getTime(), 2).map((s) => s?.participantId ?? null)).toEqual([null, "p:A3"]);
  });

  it("legs are numbered in time order across slots, one live per occupied slot; on_course is in slot order", () => {
    const A = entryA(computeSnapshot(pairRelay()));
    expect(A.slots).toBe(2);
    expect(A.slot_names).toEqual(["A", "B"]);
    expect(A.legs.map((l) => [l.no, l.participant_id, l.slot, l.live])).toEqual([
      [4, "p:A4", 2, true],
      [3, "p:A3", 1, true],
      [2, "p:A2", 2, false],
      [1, "p:A1", 1, false],
    ]);
    const [l4, l3, l2, l1] = A.legs;
    near(l1.distance_m, 5000);
    expect(l1.time_s).toBe(1500);
    near(l2.distance_m, 5000, 4); // the pair shares progress: R2's leg is the pair's distance (a second longer)
    expect(l2.time_s).toBe(1501);
    near(l3.distance_m, 4000);
    near(l4.distance_m, 4000, 4);
    expect(A.on_course.map((o) => [o.participant_id, o.slot, o.slot_name, o.leg_no])).toEqual([
      ["p:A3", 1, "A", 3],
      ["p:A4", 2, "B", 4],
    ]);
    // The entry's numbers are the one-slot relay's: shared progress, one clock.
    near(A.progress_m, 9000);
    expect(A.elapsed_s).toBe(49 * 60);
    expect(A.avg_pace_s_per_km).toBe(Math.round((49 * 60) / 9));
    expect(A.eta.pace_s_per_km).toBe(Math.round(2940 / 9));
  });

  it("on_course order is slot order whatever the tap order", () => {
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [pair()],
          positions: { "d:A1": walk(route, { fromM: 0, toM: 1000, fromMin: 0, paceSPerKm: 300 }) },
          handoffs: [mkHandoff("e:A", "p:A2", 0, false, 2), mkHandoff("e:A", "p:A1", 0.1, false, 1)],
          asOfMin: 5,
        }),
      ),
    );
    expect(A.on_course.map((o) => [o.participant_id, o.slot])).toEqual([
      ["p:A1", 1],
      ["p:A2", 2],
    ]);
    expect(A.legs.map((l) => [l.no, l.participant_id])).toEqual([
      [2, "p:A1"],
      [1, "p:A2"], // tapped first, so leg 1
    ]);
  });

  it("progress advances from either runner's phone; the pair shares the distance", () => {
    // R1's phone is dead; only R2 (slot B) reports. The pair still moves and R1's leg is the pair's.
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [pair()],
          positions: { "d:A2": walk(route, { fromM: 0, toM: 3000, fromMin: 0, paceSPerKm: 300 }) },
          handoffs: [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A2", 0, false, 2)],
          asOfMin: 15,
        }),
      ),
    );
    near(A.progress_m, 3000);
    near(A.participants[0].distance_m, 3000);
    near(A.participants[1].distance_m, 3000);
    expect(A.participants[0]).toMatchObject({ legs: 1, time_s: 900, on_course: true, device_last_seen: null });
    expect(A.participants[1]).toMatchObject({ legs: 1, time_s: 900, on_course: true, device_last_seen: atIso(15) });
    // The dot: slot A's phone is silent, so slot B's is the runner dot.
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A2", stale: false });
    // A runner not on course in any slot moves nothing, even with a fresh phone.
    const B = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [pair()],
          positions: { "d:A5": walk(route, { fromM: 0, toM: 3000, fromMin: 0, paceSPerKm: 300 }) },
          handoffs: [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A2", 0, false, 2)],
          asOfMin: 15,
        }),
      ),
    );
    expect(B.progress_m).toBe(0);
  });

  it("the dot prefers slot A's phone while it is fresh, then slot B's, then the van", () => {
    const base = pairRelay();
    const A = entryA(computeSnapshot(base));
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A3", stale: false });
    // Slot A's phone went quiet 10 min ago; B's is fresh.
    const positions = new Map(base.positions);
    positions.set(
      "d:A3",
      walk(route, { fromM: 5000, toM: 7000, fromMin: 25, paceSPerKm: 360 }).filter((f) => f.fixTime.getTime() <= at(39).getTime()),
    );
    const quietA = entryA(computeSnapshot({ ...base, positions }));
    expect(quietA.position).toMatchObject({ source: "runner", participant_id: "p:A4", stale: false, battery_pct: 61 });
    near(quietA.progress_m, 9000); // B's phone carried progress on
    // Both phones quiet since 39 min: a fresh van fix is the dot, labelled, not stale — and moves nothing.
    const quietBoth = new Map(positions);
    quietBoth.set("d:A4", (base.positions.get("d:A4") ?? []).filter((f) => f.fixTime.getTime() <= at(39).getTime()));
    const withVan = new Map(quietBoth);
    withVan.set("d:van-A", [fixOnRoute(route, 12_000, at(48))]); // driven ahead to the next exchange
    const van = entryA(computeSnapshot({ ...base, positions: withVan }));
    expect(van.position).toMatchObject({ source: "vehicle", participant_id: null, stale: false, age_s: 60, fix_time: atIso(48) });
    near(van.position?.route_m as number, 12_000);
    near(van.progress_m, 7333, 5); // the pair's last fix: 14 min at 6:00/km past 5 km
    // No van fix either: the newest runner fix across the chain, marked stale.
    const silent = entryA(computeSnapshot({ ...base, positions: quietBoth }));
    expect(silent.position).toMatchObject({ source: "runner", participant_id: "p:A4", stale: true, age_s: 600, fix_time: atIso(39) });
    near(silent.progress_m, 7333, 5);
  });

  it("stats aggregate per participant across slots; bests see every slot's legs", () => {
    const A = entryA(computeSnapshot(pairRelay()));
    const [a1, a2, a3, a4, a5, a6] = A.participants;
    expect(a1).toMatchObject({ legs: 1, time_s: 1500, on_course: false });
    near(a1.distance_m, 5000);
    expect(a2).toMatchObject({ legs: 1, time_s: 1501, on_course: false, device_battery_pct: 70 });
    near(a2.distance_m, 5000, 4);
    expect(a3).toMatchObject({ legs: 1, time_s: 1440, on_course: true });
    near(a3.distance_m, 4000);
    expect(a4).toMatchObject({ legs: 1, on_course: true, device_battery_pct: 61 });
    near(a4.distance_m, 4000, 4);
    expect(a5).toMatchObject({ legs: 0, distance_m: 0, on_course: false });
    expect(a6).toMatchObject({ legs: 0, distance_m: 0, on_course: false });
    // B's first leg closed a second after A's, with the pair ~3 m further on: the longest by a hair, not the fastest.
    expect(A.bests.longest_leg).toMatchObject({ leg_no: 2, participant_id: "p:A2" });
    expect(A.bests.fastest_leg).toMatchObject({ leg_no: 1, participant_id: "p:A1" });
    // A runner who held both slots over the day has both legs counted once each.
    const twice = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [pair()],
          positions: {
            "d:A1": [...walk(route, { fromM: 0, toM: 2000, fromMin: 0, paceSPerKm: 300 }), ...walk(route, { fromM: 4000, toM: 6000, fromMin: 20, paceSPerKm: 300 })],
            "d:A2": walk(route, { fromM: 0, toM: 4000, fromMin: 0, paceSPerKm: 300 }),
            "d:A3": walk(route, { fromM: 2000, toM: 6000, fromMin: 10, paceSPerKm: 300 }),
          },
          handoffs: [
            mkHandoff("e:A", "p:A1", 0, false, 1),
            mkHandoff("e:A", "p:A2", 0, false, 2),
            mkHandoff("e:A", "p:A3", 10, false, 1),
            mkHandoff("e:A", "p:A1", 20, false, 2), // R1 again, in B this time
          ],
          asOfMin: 30,
        }),
      ),
    );
    expect(twice.participants[0]).toMatchObject({ legs: 2, time_s: 1200, on_course: true });
    near(twice.participants[0].distance_m, 4000);
    expect(twice.on_course.map((o) => [o.participant_id, o.slot])).toEqual([
      ["p:A3", 1],
      ["p:A1", 2],
    ]);
  });

  it("next_up is the next roster runner not on course, per slot and two different people; an empty slot names the runner it starts with", () => {
    const A = entryA(computeSnapshot(pairRelay()));
    expect(A.next_up.map((n) => n?.participant_id)).toEqual(["p:A5", "p:A6"]);
    // Before any tap: the first pair.
    const fresh = entryA(computeSnapshot(mkInput({ route, entries: [pair()], positions: {}, asOfMin: 1 })));
    expect(fresh.on_course).toEqual([]);
    expect(fresh.next_up.map((n) => n?.participant_id)).toEqual(["p:A1", "p:A2"]);
    // Only slot A has been tapped: A's next is the runner after its holder, B's is still its first runner.
    const half = entryA(computeSnapshot(mkInput({ route, entries: [pair()], positions: {}, handoffs: [mkHandoff("e:A", "p:A3", 0, false, 1)], asOfMin: 1 })));
    expect(half.next_up.map((n) => n?.participant_id)).toEqual(["p:A4", "p:A2"]);
    // Holders out of phase, [R1, R3]: A's next is R2 and B's is R4 — not R3 and R1, who are running
    // (review 2026-10-15, finding #3: walking the roster two at a time named them and skipped R2 and R4).
    const phase = entryA(
      computeSnapshot(
        mkInput({ route, entries: [pair()], positions: {}, handoffs: [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A3", 0, false, 2)], asOfMin: 1 }),
      ),
    );
    expect(phase.on_course.map((o) => o.participant_id)).toEqual(["p:A1", "p:A3"]);
    expect(phase.next_up.map((n) => n?.participant_id)).toEqual(["p:A2", "p:A4"]);
    // Wrapping: with four runners the pair after R3+R4 is R1+R2.
    const four = mkEntry("A", 4, { slots: 2, slotNames: ["A", "B"] });
    const wrap = entryA(computeSnapshot({ ...pairRelay(), entries: [four] }));
    expect(wrap.next_up.map((n) => n?.participant_id)).toEqual(["p:A1", "p:A2"]);
    // Two runners in two slots: nobody is next.
    const two = mkEntry("A", 2, { slots: 2 });
    const none = entryA(computeSnapshot({ ...pairRelay(10), entries: [two] }));
    expect(none.next_up).toEqual([null, null]);
    expect(none.slot_names).toEqual(["1", "2"]); // no labels in the file → numbers
  });

  it("a pair finishes together: both finishing legs close at finished_at, the dot is slot A's runner", () => {
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [pair()],
          positions: {
            "d:A1": walk(route, { fromM: 0, toM: 20_000, fromMin: 0, paceSPerKm: 300 }),
            "d:A2": walk(route, { fromM: 0, toM: 20_000, fromMin: 0, paceSPerKm: 300 }),
          },
          handoffs: [mkHandoff("e:A", "p:A1", 0, false, 1), mkHandoff("e:A", "p:A2", 0, false, 2), mkHandoff("e:A", "p:A3", 102, false, 1)],
          asOfMin: 105,
        }),
      ),
    );
    expect(A.finished).toBe(true);
    nearIso(A.finished_at, 5985 / 60, 2);
    expect(A.on_course).toEqual([]);
    expect(A.next_up).toEqual([null, null]);
    expect(A.legs.map((l) => [l.participant_id, l.slot, l.live, l.end])).toEqual([
      ["p:A2", 2, false, A.finished_at],
      ["p:A1", 1, false, A.finished_at],
    ]);
    expect(A.position).toMatchObject({ source: "runner", participant_id: "p:A1" });
    expect(A.participants[2]).toMatchObject({ legs: 0 }); // the 102 min tap opened nothing
  });

  it("a one-slot entry is today's relay: a tap stored for slot 2 folds into slot 1", () => {
    const base = standardRelay();
    const folded = { ...base, handoffs: base.handoffs.map((h) => ({ ...h, slot: 2 })) };
    expect(computeSnapshot(folded)).toEqual(computeSnapshot(base));
    const junk = { ...base, handoffs: base.handoffs.map((h) => ({ ...h, slot: Number.NaN })) };
    expect(computeSnapshot(junk)).toEqual(computeSnapshot(base));
  });
});

/* ─── Elevation (owner, 2026-10-15: elevation on the stickers and runner cards) ── */

describe("elevation", () => {
  // 0 → 100 m over the first 5 km, down to 50 m by 10 km, up to 120 m at 20 km: 170 m of gain in all.
  const route = profileRoute([
    [0, 0],
    [5000, 100],
    [10_000, 50],
    [20_000, 120],
  ]);

  it("the cumulative gain counts climbs only", () => {
    const gain = cumulativeGain(route);
    near(gain[gain.length - 1], 170, 1.5);
    near(gainAtRouteM(route, gain, 5000), 100, 1.5);
    near(gainAtRouteM(route, gain, 7500), 100, 1.5); // descending: nothing added
    near(gainAtRouteM(route, gain, 2500), 50, 1.5); // interpolated inside the climb
    expect(gainAtRouteM(route, gain, 0)).toBe(0);
    expect(gainAtRouteM(route, gain, -5)).toBe(0);
    near(gainAtRouteM(route, gain, 99_999), 170, 1.5); // past the end: the whole route
    near(gainBetween(route, gain, 9000, 20_000), 70, 1.5);
    expect(gainBetween(route, gain, 7000, 7000)).toBe(0);
    expect(gainBetween(route, gain, 9000, 1000)).toBe(0); // backwards: nothing
  });

  it("1 m of hysteresis ignores jitter but keeps a slow steady climb", () => {
    const raw = (ele: (i: number) => number) => Array.from({ length: 51 }, (_, i) => ({ lat: LAT0 + (i * 20) / M_PER_DEG_LAT, lon: LON0, ele: ele(i) }));
    const wobbly = buildRouteIndex(densify(raw((i) => (i % 2 ? 0.4 : 0))));
    expect(cumulativeGain(wobbly)[wobbly.eleM.length - 1]).toBe(0);
    const steady = buildRouteIndex(densify(raw((i) => i * 0.5))); // 25 m over 1 km, half a metre a point
    near(cumulativeGain(steady)[steady.eleM.length - 1], 25, 1.5);
    const staircase = buildRouteIndex(densify(raw((i) => Math.floor(i / 10) * 3))); // five 3 m steps
    near(cumulativeGain(staircase)[staircase.eleM.length - 1], 15, 0.01);
    expect(cumulativeGain(buildRouteIndex([]))).toHaveLength(0);
  });

  it("entry, leg and participant gain follow progress on the route", () => {
    // A1 0→5 km (the whole climb), A2 5→9 km (downhill), as of 49 min.
    const A = entryA(
      computeSnapshot(
        mkInput({
          route,
          entries: [mkEntry("A", 3)],
          positions: {
            "d:A1": walk(route, { fromM: 0, toM: 5000, fromMin: 0, paceSPerKm: 300 }),
            "d:A2": walk(route, { fromM: 5000, toM: 9000, fromMin: 25, paceSPerKm: 360 }),
          },
          handoffs: [mkHandoff("e:A", "p:A1", 0), mkHandoff("e:A", "p:A2", 25)],
          asOfMin: 49,
        }),
      ),
    );
    near(A.elevation_gain_m, 100, 2);
    near(A.elevation_remaining_m, 70, 2);
    near(A.legs.find((l) => l.no === 1)!.elevation_gain_m, 100, 2);
    expect(A.legs.find((l) => l.no === 2)!.elevation_gain_m).toBe(0);
    near(A.participants[0].elevation_gain_m, 100, 2);
    expect(A.participants[1].elevation_gain_m).toBe(0);
    expect(A.participants[2].elevation_gain_m).toBe(0);
    // Solo legs climb too, and a finished entry has nothing left to climb.
    const S = computeSnapshot(
      mkInput({
        kind: "solo",
        route,
        entries: [mkEntry("S", 1, { vehicle: false })],
        positions: { "d:S1": walk(route, { fromM: 0, toM: 20_000, fromMin: 0, paceSPerKm: 300 }) },
        asOfMin: 105,
      }),
    ).entries[0];
    expect(S.finished).toBe(true);
    near(S.elevation_gain_m, 170, 2);
    expect(S.elevation_remaining_m).toBe(0);
    near(S.participants[0].elevation_gain_m, 170, 2);
    near(S.legs.reduce((n, l) => n + l.elevation_gain_m, 0), 170, 3);
  });
});
