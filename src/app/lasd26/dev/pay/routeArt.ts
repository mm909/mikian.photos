import type { CourseFile } from "../../route/course";

/**
 * THE ROUTE AS A DRAWING for the first screen of /lasd26/dev/pay (owner,
 * 2026-10-29: "it should show the route being drawn in the background").
 * The course (public/lasd26/route/course.json) projected into an SVG
 * viewBox the way the stickers frame it (src/app/lasd26/stickers/paint.ts
 * frameCourse): plate carrée with the longitude squeezed by cos(mid-lat),
 * fitted to a height. The run legs are split at the drive through Camp
 * Pendleton, each one path, so each can be drawn in turn with a
 * stroke-dashoffset animation (pathLength="1" on the client); the drive is
 * one dashed path. Pure, so the server computes it once per request and
 * the client only animates. Every third point is kept — the line reads the
 * same at this size and the markup stays small.
 */

export type RouteArt = {
  w: number;
  h: number;
  /** One "M…L…" path per run leg, start to finish. */
  run: string[];
  /** The drive(s), dashed. */
  drive: string;
};

type Course = Pick<CourseFile, "bbox" | "coords" | "drives">;

export function routeArt(course: Course, h = 1000, inset = 40, keepEvery = 3): RouteArt {
  const [minLon, minLat, maxLon, maxLat] = course.bbox;
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const s = (h - inset * 2) / spanY;
  const w = Math.round(spanX * s + inset * 2);
  const X = (lon: number) => (inset + (lon - minLon) * kx * s).toFixed(1);
  const Y = (lat: number) => (inset + (maxLat - lat) * s).toFixed(1);

  const path = (pts: [number, number][]): string => {
    let d = "";
    for (let i = 0; i < pts.length; i++) {
      if (i % keepEvery !== 0 && i !== pts.length - 1) continue;
      const [lon, lat] = pts[i];
      d += `${d ? "L" : "M"}${X(lon)} ${Y(lat)}`;
    }
    return d;
  };

  // The run legs, the line split at every drive (paint.ts legsOf).
  const legs: [number, number][][] = [];
  let start = 0;
  for (const d of [...course.drives].sort((a, b) => a.at - b.at)) {
    legs.push(course.coords.slice(start, d.at + 1));
    start = d.at + 1;
  }
  legs.push(course.coords.slice(start));

  return {
    w,
    h,
    run: legs.filter((l) => l.length > 1).map(path),
    drive: course.drives.map((d) => path(d.coords && d.coords.length > 1 ? d.coords : [d.from, d.to])).join(""),
  };
}
