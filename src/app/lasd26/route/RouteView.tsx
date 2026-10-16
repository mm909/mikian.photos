"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { COURSE_URL, GOOGLE_MAP_URL, MI, feet, miles, type CourseBath, type CourseFile, type CourseTurn, type Focus } from "./course";

/**
 * The route page's body (owner, 2026-10-16: "embed this route into the
 * site"): the map, the chips under it, the facts strip, the elevation
 * profile, the turn-by-turn list and — when its chip is on — the bathroom
 * stops. Loads public/lasd26/route/course.json once, on the client; the
 * map is a dynamic import with ssr off (MapLibre needs a window). A tap on
 * any row hands the map a `focus` and scrolls it back into view, so on a
 * phone the list is a remote control for the map above it.
 */

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="rt-loading mono">Loading map…</div>,
});

export function RouteView() {
  const [course, setCourse] = useState<CourseFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [baths, setBaths] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let on = true;
    fetch(COURSE_URL)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as CourseFile;
      })
      .then((c) => {
        if (on) setCourse(c);
      })
      .catch((e: unknown) => {
        if (on) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      on = false;
    };
  }, []);

  const go = (f: Omit<Focus, "id">) => {
    setFocus({ ...f, id: Date.now() });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="rt-map" ref={mapRef}>
        {course ? (
          <RouteMap course={course} showBaths={baths} focus={focus} />
        ) : err ? (
          <div className="rt-loading mono">Course unavailable · {err}</div>
        ) : (
          <div className="rt-loading mono">Loading the course…</div>
        )}
      </div>

      <div className="wrap">
        <div className="rt-chips">
          <button type="button" className="rt-chip" aria-pressed={baths} onClick={() => setBaths((v) => !v)}>
            <span className="dot" aria-hidden="true" />
            Bathroom stops{course ? ` · ${course.bathrooms.length}` : ""}
          </button>
          <a className="rt-chip" href={GOOGLE_MAP_URL} target="_blank" rel="noopener noreferrer">
            Open in Google Maps ↗
          </a>
        </div>
      </div>

      {course && <Facts course={course} />}

      <div className="wrap">
        {course && <Profile course={course} />}
        {course && <Turns course={course} focus={focus} onGo={go} />}
        {course && baths && <Baths course={course} focus={focus} onGo={go} />}
        {course && (
          <p className="rt-src">
            From No Shortcuts&apos; official directions map · {course.halfmiles} half-mile checkpoints · built {course.generated_at.slice(0, 10)}
          </p>
        )}
      </div>
    </>
  );
}

/* ─── The facts strip (the landing's .facts, four cells) ─────────────────── */

function Facts({ course }: { course: CourseFile }) {
  const drive = course.drives[0];
  return (
    <div className="facts">
      <div className="in">
        <div className="cell">
          <div className="k">Run</div>
          <div className="v">
            {miles(course.length_m)} mi
            {drive && <small>+ {miles(drive.straight_m)} mi in the van</small>}
          </div>
        </div>
        <div className="cell">
          <div className="k">Climb</div>
          <div className="v">
            +{feet(course.climb_m)} ft<small>−{feet(course.descent_m)} ft down</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Calls</div>
          <div className="v">
            {course.turns.length}
            <small>turn by turn below</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Bathrooms</div>
          <div className="v">
            {course.bathrooms.length}
            <small>every 12 miles</small>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── The elevation profile (a small SVG from the segments' figures) ─────── */

function Profile({ course }: { course: CourseFile }) {
  const W = 720;
  const H = 120;
  const pts = course.profile;
  if (pts.length < 2 || course.length_m <= 0) return null;
  const eles = pts.map((p) => p[1]);
  const lo = Math.min(...eles);
  const hi = Math.max(...eles);
  const span = Math.max(1, hi - lo);
  const x = (m: number) => (m / course.length_m) * W;
  const y = (e: number) => H - 8 - ((e - lo) / span) * (H - 24);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div className="rt-profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elevation profile: from ${feet(lo)} to ${feet(hi)} feet over ${miles(course.length_m)} miles`}>
        <path d={area} fill="#D0F858" />
        <path d={line} fill="none" stroke="#111110" strokeWidth="2" strokeLinejoin="round" />
        {course.drives.map((d) => (
          <line key={d.at} x1={x(d.mile * MI)} x2={x(d.mile * MI)} y1={0} y2={H} stroke="#111110" strokeWidth="1.5" strokeDasharray="4 4" />
        ))}
      </svg>
      <div className="k">
        <span>0 mi · {feet(lo)} ft</span>
        <span>high {feet(hi)} ft</span>
        <span>{miles(course.length_m)} mi</span>
      </div>
    </div>
  );
}

/* ─── Turn by turn ───────────────────────────────────────────────────────── */

function Turns({ course, focus, onGo }: { course: CourseFile; focus: Focus | null; onGo: (f: Omit<Focus, "id">) => void }) {
  const drive = course.drives[0];
  return (
    <section className="rt-sec">
      <div className="sec-head">
        <h2>Turn by turn</h2>
        <span className="mono">{course.turns.length} CALLS · RUN MILES</span>
      </div>
      <ol className="rt-list">
        {course.turns.map((t: CourseTurn, i) => {
          const key = `t${i}`;
          return (
            <li key={key} className={`rt-row ${t.kind}${focus?.key === key ? " is-on" : ""}`}>
              <button type="button" onClick={() => onGo({ lon: t.lon, lat: t.lat, name: t.name, mile: t.mile, key })}>
                <span className="mi">{t.mile.toFixed(1)}</span>
                <span className="tx">
                  {t.name}
                  {t.note && <small>{t.note}</small>}
                  {t.kind === "drive" && drive && (
                    <small>
                      {drive.note} {miles(drive.straight_m)} mi straight — the tracker&apos;s miles run ahead of these from here.
                    </small>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {course.after.length > 0 && <p className="rt-after">AFTER THE FINISH: {course.after.map((a) => a.name).join(" · ")}</p>}
    </section>
  );
}

/* ─── Bathroom stops, grouped by the organizer's 12-mile windows ─────────── */

function Baths({ course, focus, onGo }: { course: CourseFile; focus: Focus | null; onGo: (f: Omit<Focus, "id">) => void }) {
  const groups = new Map<number, { b: CourseBath; i: number }[]>();
  course.bathrooms.forEach((b, i) => {
    const list = groups.get(b.target_mi) ?? [];
    list.push({ b, i });
    groups.set(b.target_mi, list);
  });
  const targets = Array.from(groups.keys()).sort((a, b) => a - b);
  return (
    <section className="rt-sec">
      <div className="sec-head">
        <h2>Bathroom stops</h2>
        <span className="mono">EVERY 12 MI · THE ORGANIZER&apos;S LIST</span>
      </div>
      {targets.map((target) => (
        <div key={target}>
          <div className="rt-bhead">Mile {target} window</div>
          <ul className="rt-list">
            {groups.get(target)!.map(({ b, i }) => {
              const key = `b${i}`;
              return (
                <li key={key} className={`rt-row${focus?.key === key ? " is-on" : ""}`}>
                  <button type="button" onClick={() => onGo({ lon: b.lon, lat: b.lat, name: b.name, mile: b.mile, key })}>
                    <span className="mi">{b.mile.toFixed(1)}</span>
                    <span className="tx">
                      {b.name}
                      {b.kind === "window" && <span className="rt-tag">window</span>}
                      {(b.address || b.eta) && (
                        <small>
                          {b.address}
                          {b.address && b.eta ? " · " : ""}
                          {b.eta ? `ETA ${b.eta}` : ""}
                        </small>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
