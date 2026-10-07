/**
 * Route index + snapping (TRACKER_SPEC.md §9, §12): GPX parsing, the ≤ 25 m
 * densify rule, and the snapping window that keeps overlapping passes apart.
 */

import { describe, expect, it } from "vitest";
import { buildRouteIndex, densify, haversineM, parseGpx, pointAtRouteM, routeIndexFromGpx, snapToRoute } from "./routeIndex";
import { SNAP_RULES } from "./types";
import { fixOnRoute, LAT0, LON0, M_PER_DEG_LAT, northRoute, outAndBackRoute } from "./computeFixtures";

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <wpt lat="34.5" lon="-118.9"><name>ignored waypoint</name></wpt>
  <trk><name>a</name>
    <trkseg>
      <trkpt lat="34.0" lon="-118.5"><ele>12.5</ele><time>2026-10-23T12:00:00Z</time></trkpt>
      <trkpt lat="34.001" lon="-118.5"/>
    </trkseg>
    <trkseg>
      <trkpt lon='-118.5' lat='34.002'><ele>20</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpx", () => {
  it("reads every trkpt in file order, with or without <ele>, and ignores waypoints", () => {
    const pts = parseGpx(GPX);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ lat: 34.0, lon: -118.5, ele: 12.5 });
    expect(pts[1]).toEqual({ lat: 34.001, lon: -118.5, ele: 0 });
    expect(pts[2]).toEqual({ lat: 34.002, lon: -118.5, ele: 20 });
  });

  it("falls back to <rtept> for a route-only file", () => {
    const pts = parseGpx(`<gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.001" lon="2"/></rte></gpx>`);
    expect(pts.map((p) => p.lat)).toEqual([1, 1.001]);
  });

  it("builds a usable index straight from GPX text", () => {
    const { stored, index } = routeIndexFromGpx(GPX);
    expect(stored.length).toBeGreaterThan(3);
    expect(index.lengthM).toBeCloseTo(0.002 * M_PER_DEG_LAT, -1);
    expect(index.bbox[0]).toBeCloseTo(34.0, 6);
    expect(index.bbox[2]).toBeCloseTo(34.002, 6);
  });
});

describe("densify", () => {
  it("keeps neighbours no more than 25 m apart with a monotonic cumulative distance", () => {
    const pts = densify([
      { lat: LAT0, lon: LON0, ele: 0 },
      { lat: LAT0 + 2000 / M_PER_DEG_LAT, lon: LON0, ele: 100 },
    ]);
    expect(pts.length).toBeGreaterThanOrEqual(Math.ceil(2000 / SNAP_RULES.densifyM) + 1);
    for (let i = 1; i < pts.length; i++) {
      const gap = haversineM(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      expect(gap).toBeLessThanOrEqual(SNAP_RULES.densifyM + 1e-6);
      expect(pts[i][2]).toBeGreaterThan(pts[i - 1][2]);
    }
    expect(pts[pts.length - 1][2]).toBeCloseTo(2000, 0);
    expect(pts[pts.length - 1][3]).toBeCloseTo(100, 6);
  });

  it("drops consecutive near-duplicate points", () => {
    const pts = densify([
      { lat: LAT0, lon: LON0, ele: 0 },
      { lat: LAT0 + 0.1 / M_PER_DEG_LAT, lon: LON0, ele: 0 },
      { lat: LAT0 + 10 / M_PER_DEG_LAT, lon: LON0, ele: 0 },
    ]);
    expect(pts).toHaveLength(2);
  });
});

describe("snapToRoute", () => {
  const straight = northRoute(20_000);

  it("gives a continuous route_m and the perpendicular off-route distance", () => {
    const f = fixOnRoute(straight, 7_333, 0, { eastM: 40 });
    const s = snapToRoute(straight, f.lat, f.lon, null);
    expect(s.routeM).toBeCloseTo(7_333, -1);
    expect(s.offRouteM).toBeCloseTo(40, 0);
    expect(s.inWindow).toBe(false);
  });

  it("pointAtRouteM and snapToRoute are inverses along the line", () => {
    for (const m of [0, 25, 1_234.5, 9_999, 20_000]) {
      const p = pointAtRouteM(straight, m);
      expect(snapToRoute(straight, p.lat, p.lon, null).routeM).toBeCloseTo(m, 0);
    }
  });

  it("out-and-back: the window around the entry's progress picks the right pass", () => {
    // Outbound 10 km north, 40 m jog east, 10 km back south: the two passes are 40 m apart.
    const oab = outAndBackRoute(10_000, 40);
    expect(oab.lengthM).toBeCloseTo(20_040, -1);
    // 3 km north, 15 m east of the outbound line (so 25 m from the return line).
    const f = fixOnRoute(oab, 3_000, 0, { eastM: 15 });
    const out = snapToRoute(oab, f.lat, f.lon, 2_900);
    expect(out.inWindow).toBe(true);
    expect(out.routeM).toBeCloseTo(3_000, -1);
    expect(out.offRouteM).toBeCloseTo(15, 0);
    // Same fix, but the entry is on the way back (progress ≈ 17 km): the return pass wins.
    const back = snapToRoute(oab, f.lat, f.lon, 16_900);
    expect(back.inWindow).toBe(true);
    expect(back.routeM).toBeCloseTo(17_040, -1);
    expect(back.offRouteM).toBeCloseTo(25, 0);
    // No window: nearest wins (the outbound line, 15 m away).
    expect(snapToRoute(oab, f.lat, f.lon, null).routeM).toBeCloseTo(3_000, -1);
  });

  it("a window miss (> 150 m from everything in it) falls back to the whole route", () => {
    const f = fixOnRoute(straight, 8_000, 0);
    const s = snapToRoute(straight, f.lat, f.lon, 1_000); // window [500 m, 6 km]: 2 km short of the fix
    expect(s.inWindow).toBe(false);
    expect(s.routeM).toBeCloseTo(8_000, -1);
    expect(s.offRouteM).toBeLessThan(1);
  });

  it("an empty route snaps nothing (infinitely off route)", () => {
    const empty = buildRouteIndex([]);
    const s = snapToRoute(empty, LAT0, LON0, null);
    expect(s.offRouteM).toBe(Infinity);
    expect(s.offRouteM <= SNAP_RULES.offRouteMaxM).toBe(false);
  });
});
