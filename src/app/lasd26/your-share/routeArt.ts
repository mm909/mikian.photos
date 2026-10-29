import type { CourseFile } from "../route/course";

/**
 * THE ROUTE AS A DRAWING for the first screen of /lasd26/your-share (owner,
 * 2026-10-29: "it should show the route being drawn in the background";
 * later: "Make the route be drawn full from start to finish instead of in
 * sections"). The course (public/lasd26/route/course.json) projected into
 * an SVG viewBox the way the stickers frame it (src/app/lasd26/stickers/
 * paint.ts frameCourse): plate carrée with the longitude squeezed by
 * cos(mid-lat), fitted to a height. ONE path, Santa Monica to San Diego:
 * the run, the drive through Camp Pendleton by road, the run again — so a
 * single stroke-dashoffset animation (pathLength="1" on the client) draws
 * it end to end. Pure, so the server computes it once per request and the
 * client only animates. Every third point is kept — the line reads the
 * same at this size and the markup stays small.
 */

export type RouteArt = {
  w: number;
  h: number;
  /** One "M…L…" path, start to finish. */
  path: string;
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

  // The whole way in order: each run leg, then the drive that follows it.
  const pts: [number, number][] = [];
  let start = 0;
  for (const d of [...course.drives].sort((a, b) => a.at - b.at)) {
    pts.push(...course.coords.slice(start, d.at + 1));
    pts.push(...(d.coords && d.coords.length > 1 ? d.coords : [d.from, d.to]));
    start = d.at + 1;
  }
  pts.push(...course.coords.slice(start));

  let path = "";
  for (let i = 0; i < pts.length; i++) {
    if (i % keepEvery !== 0 && i !== pts.length - 1) continue;
    const [lon, lat] = pts[i];
    path += `${path ? "L" : "M"}${X(lon)} ${Y(lat)}`;
  }
  return { w, h, path };
}
