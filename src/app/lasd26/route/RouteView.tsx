"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { COURSE_URL, GOOGLE_MAP_URL, MI, feet, miles, type CourseFile, type CourseTurn, type Focus } from "./course";

/**
 * The route page's body (owner, 2026-10-16: "embed this route into the
 * site"): the map, the Google Maps door under it, the facts strip, the
 * elevation profile and the turn-by-turn list. Nothing else — the bathroom
 * stops, their chip and count, the "after the finish" line and the credit
 * line are gone (owner, 2026-10-16, on his phone: "Remove the bathroom
 * stops, and bathroom count", "Remove after the finish copy and the 'from
 * No Shortcuts' official…'"). Loads public/lasd26/route/course.json once,
 * on the client; the map is a dynamic import with ssr off (MapLibre needs a
 * window). A tap on any row hands the map a `focus` and scrolls it back
 * into view, so on a phone the list is a remote control for the map above
 * it.
 */

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="rt-loading mono">Loading map…</div>,
});

export function RouteView() {
  const [course, setCourse] = useState<CourseFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
          <RouteMap course={course} focus={focus} />
        ) : err ? (
          <div className="rt-loading mono">Course unavailable · {err}</div>
        ) : (
          <div className="rt-loading mono">Loading the course…</div>
        )}
      </div>

      <div className="wrap">
        <div className="rt-chips">
          <a className="rt-chip" href={GOOGLE_MAP_URL} target="_blank" rel="noopener noreferrer">
            Open in Google Maps ↗
          </a>
        </div>
      </div>

      {course && <Facts course={course} />}

      <div className="wrap">
        {course && <Profile course={course} />}
        {course && <Turns course={course} focus={focus} onGo={go} />}
      </div>
    </>
  );
}

/** The drive's length for the page: the road when the script routed it, the straight line when not. */
function vanMiles(course: CourseFile): string | null {
  const d = course.drives[0];
  if (!d) return null;
  return miles(d.road_m ?? d.straight_m);
}

/* ─── The facts strip (the landing's .facts, four cells) ─────────────────── */

function Facts({ course }: { course: CourseFile }) {
  const van = vanMiles(course);
  const routed = course.drives[0]?.coords != null;
  return (
    <div className="facts">
      <div className="in">
        <div className="cell">
          <div className="k">Run</div>
          <div className="v">
            {miles(course.length_m)} mi<small>the van&apos;s miles don&apos;t count</small>
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
          <div className="k">Van</div>
          <div className="v">
            {van ? `${van} mi` : "—"}
            <small>{routed ? "I-5 through Camp Pendleton" : "Camp Pendleton, as the crow flies"}</small>
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
  const van = vanMiles(course);
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
                  {t.kind === "drive" && drive && van && (
                    <small>
                      {drive.note} {van} mi {drive.coords ? "by road" : "as the crow flies"}.
                    </small>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
