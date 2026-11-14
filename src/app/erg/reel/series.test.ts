import { describe, expect, it } from "vitest";
import { buildSeries, frameAt, rowTimeAt, sampleDoc } from "./series";

describe("reel series", () => {
  const series = buildSeries(sampleDoc());

  it("starts at zero and ends on the monitor's totals", () => {
    expect(frameAt(series, 0).m).toBe(0);
    const end = frameAt(series, series.totalS);
    expect(end.m).toBe(5000);
    expect(series.totalM).toBe(5000);
  });

  it("never runs the metres backwards", () => {
    let last = -1;
    for (let t = 0; t <= series.totalS; t += 0.37) {
      const m = frameAt(series, t).m;
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
    }
  });

  it("averages the pace as time over distance", () => {
    const f = frameAt(series, 600);
    expect(f.avgPace).toBeCloseTo((600 / f.m) * 500, 5);
  });

  it("walks a stroke's drive from 0 to 1", () => {
    const s = series.strokes[10];
    expect(frameAt(series, s.t - s.driveS / 2).drive).toBeCloseTo(0.5, 1);
    expect(frameAt(series, s.t + 0.1).drive).toBe(1);
    expect(frameAt(series, s.t + 0.1).stroke).toBe(10);
  });

  it("lays the picked stretch over the clip", () => {
    expect(rowTimeAt(0, 10, 100, 300)).toBe(100);
    expect(rowTimeAt(5, 10, 100, 300)).toBe(200);
    expect(rowTimeAt(99, 10, 100, 300)).toBe(300);
  });
});
