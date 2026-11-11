import type { ReactNode } from "react";
import Link from "next/link";
import { ORDER, SERIES, type EventSlug } from "./series";
import type { Course, Stop } from "./types";

/* The pieces both food relay pages lay out the same way: the stop list
 * (a rail for five Costcos, a grid for two dozen Taco Bells) and the
 * question list. Copy lives in the pages; these only hold the shape. */

export const mapsUrl = (brand: string, s: Stop) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${brand} ${s.address}, ${s.city}, NV`)}`;

/** Clock time `minutes` after a start given as minutes past midnight. */
export function clock(startMin: number, minutes: number): string {
  const t = Math.round(startMin + minutes);
  const h24 = Math.floor(t / 60) % 24;
  const m = t % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** 135 minutes reads 2:15. */
export function hm(minutes: number): string {
  const t = Math.round(minutes);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** A pace in minutes per mile reads 9:30. */
export function pace(minPerMi: number): string {
  const s = Math.round(minPerMi * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function StopRail({ course, brand }: { course: Course; brand: string }) {
  const last = course.stops.length;
  return (
    <ol className="fr-rail">
      {course.stops.map((s, i) => {
        const next = course.stops[i + 1];
        const end = s.n === 1 || s.n === last;
        return (
          <li key={s.n} className={end ? "end" : undefined}>
            <div className="fr-rail-n">{s.n}</div>
            <div>
              <div className="fr-rail-name">
                {s.name}
                {s.n === 1 && <span className="fr-rail-tag">Start</span>}
                {s.n === last && <span className="fr-rail-tag">Finish</span>}
              </div>
              <div className="fr-rail-addr">
                <a href={mapsUrl(brand, s)} target="_blank" rel="noopener noreferrer">
                  {s.address}, {s.city}
                </a>
              </div>
            </div>
            <div className="fr-rail-mi">
              <b>{s.mi.toFixed(1)}</b>mi
            </div>
            {next && (
              <div className="fr-rail-leg">
                <i />
                <span>
                  {next.legMi.toFixed(1)} miles to {next.name}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StopGrid({ course, brand, one = false }: { course: Course; brand: string; one?: boolean }) {
  const last = course.stops.length;
  return (
    <ol className={one ? "fr-bellgrid one" : "fr-bellgrid"}>
      {course.stops.map((s) => (
        <li key={s.n} className={s.n === 1 || (!course.loop && s.n === last) ? "end" : undefined}>
          <span className="n">{s.n}</span>
          <span>
            <span className="name">{s.name}</span>
            <a className="addr" href={mapsUrl(brand, s)} target="_blank" rel="noopener noreferrer">
              {s.address}
              {s.city !== "Las Vegas" ? `, ${s.city}` : ""}
            </a>
            <span className="meta">
              {s.n === 1 ? (course.loop ? "Start + finish" : "Start") : `Mile ${s.mi.toFixed(1)} · +${s.legMi.toFixed(1)}`}
              {!course.loop && s.n === last && " · Finish"}
              {s.opens && (
                <>
                  {" · "}
                  <b>{s.opens === "24" ? "24 hours" : `Opens ${s.opens} AM`}</b>
                </>
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="fr-faq">
      {items.map((it) => (
        <details className="fr-q" key={it.q}>
          <summary>
            {it.q}
            <span className="pm" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="a">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

/* The other events in the series, at the foot of each page: the only
 * links any of the four carries (they are unlisted). */
export function Siblings({ current }: { current: EventSlug }) {
  return (
    <div className="fr-sibs">
      {ORDER.filter((slug) => slug !== current).map((slug) => {
        const e = SERIES[slug];
        const month = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "long" }).format(new Date(e.start));
        return (
          <div className="fr-sib" key={slug}>
            <div>
              <div className="k">Also on the calendar · {month}</div>
              <div className="t">{e.name}</div>
              <div className="s">{e.blurb}</div>
            </div>
            <Link className="fr-btn" href={`/${slug}`}>
              See that one
            </Link>
          </div>
        );
      })}
    </div>
  );
}

/** The start, read in Las Vegas time whatever clock the server keeps. */
export function startParts(iso: string) {
  const d = new Date(iso);
  const tz = "America/Los_Angeles";
  const dateLong = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(d);
  const dateShort = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .split(":")
    .map(Number);
  const minutes = h * 60 + m;
  return { dateLong, dateShort, time: clock(minutes, 0), minutes };
}
