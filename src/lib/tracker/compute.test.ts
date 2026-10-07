/**
 * The compute core (TRACKER_SPEC.md §9, §12): progress interpolation at
 * handoff times, leg math across gaps, backfill determinism, the fallback
 * chain, the ETA function, gaps, solo checkpoint-split legs, public delay,
 * voided handoffs, the clock rules, duplicate taps, the finish clamp, a
 * finished entry's dot and the per-device newest fix (`latestFix`).
 * Everything is synthetic: a straight 20 km route, constant-pace fixes,
 * scripted handoffs.
 */

import { describe, expect, it } from "vitest";
import {
  computeGaps,
  computeSnapshot,
  estimateEta,
  etaPaceParts,
  onCourseAt,
  onCourseTimeline,
  progressAt,
  seriesFromSamples,
  timeAtProgress,
  type ComputeHandoff,
  type ComputeInput,
  type Fix,
} from "./compute";
import { FRESH_FIX_S } from "./types";
import { at, atIso, fixOnRoute, mkCheckpoints, mkEntry, mkHandoff, mkInput, northRoute, stand, T0, walk } from "./computeFixtures";
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
      { participantId: "p:A1", fromMs: T0, toMs: null, handoffId: h[0].id },
    ]);
  });

  it("solo: the one participant from the event start, handoffs ignored", () => {
    const segs = onCourseTimeline("solo", mkEntry("S", 1), [mkHandoff("e:S", "p:S1", 5)], at(0), at(60));
    expect(segs).toEqual([{ participantId: "p:S1", fromMs: T0, toMs: null, handoffId: null }]);
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

  it("on course, next up", () => {
    expect(A.on_course).toMatchObject({ participant_id: "p:A2", initials: "A2", leg_no: 2, leg_started: atIso(25), leg_time_s: 1440 });
    near(A.on_course?.leg_distance_m as number, 4000);
    expect(A.next_up).toMatchObject({ participant_id: "p:A3" });
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
    expect(A.on_course).toBeNull();
    expect(A.next_up).toMatchObject({ participant_id: "p:A1" });
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
    expect(A.on_course?.participant_id).toBe("p:A1");
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
    expect(A.on_course).toBeNull();
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
    expect(S.on_course).toMatchObject({ participant_id: "p:S1", leg_no: 3 });
    expect(S.next_up).toBeNull();
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
    expect(A.on_course?.participant_id).toBe("p:A1");
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
    expect(A.on_course).toBeNull();
    expect(A.next_up).toBeNull();
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
    expect(A.on_course).toBeNull();
    expect(A.next_up).toBeNull();
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
