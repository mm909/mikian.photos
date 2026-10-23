"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COURSE_URL, GOOGLE_MAP_URL, MI, feet, miles, type CourseFile, type CourseTurn, type Focus } from "./course";
import {
  formatAgo,
  formatClock,
  formatPace,
  formatSpan,
  paceModel,
  paceInput,
  parsePace,
  rowEtas,
  startIsoFromTime,
  startTimeInput,
  vanRowAfter,
  type EtaSettings,
  type PaceModel,
  type VanPin,
} from "./eta";

/**
 * The route page's body (owner, 2026-10-16: "embed this route into the
 * site"): the map, the facts strip, the elevation profile, the turn-by-turn
 * list, then the Google Maps door at the foot (owner, that night: "Move the
 * open in google maps button to the bottom of the page after the turn by
 * turn"). Nothing else — the bathroom
 * stops, their chip and count, the "after the finish" line and the credit
 * line are gone (owner, 2026-10-16, on his phone: "Remove the bathroom
 * stops, and bathroom count", "Remove after the finish copy and the 'from
 * No Shortcuts' official…'"). Loads public/lasd26/route/course.json once,
 * on the client; the map is a dynamic import with ssr off (MapLibre needs a
 * window). A tap on any row hands the map a `focus` and scrolls it back
 * into view, so on a phone the list is a remote control for the map above
 * it.
 *
 * 2026-10-21 (owner: "I also want etas added to the route page … include an
 * expected finish time at the bottom … include the etas on the turn by turn
 * area"; "a 'van location' button"): every call carries a clock time at
 * its right, the finish under the list, and — for the team — the van. The
 * ETAs come from eta.ts: a PLANNED schedule at the default pace until the
 * van's first check-in, then the pace the van's position implies against the
 * clock since the start (owner: "the pace should be inferred from the van's
 * location and current duration of the race"). The PACE row over the list
 * says which, and a member can change the three knobs there (the start, the
 * drive's minutes, the planned pace). The view polls /api/lasd26/eta every
 * half minute while the tab is in front, so a check-in on one phone moves
 * the list on every other, and the clock ticks the PASSED calls grey.
 */

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="rt-loading mono">Loading map…</div>,
});

const POLL_MS = 30_000;

export type RouteViewProps = {
  /** Signed in and on the team: the VAN button, the pin and the settings' EDIT. */
  onTeam: boolean;
  /** LOCATE v2: the map stays on you until you move it, then a RECENTER button (page.tsx says who gets it). */
  recenter: boolean;
  initialEta: EtaSettings;
  initialPin: VanPin | null;
};

type EtaWire = { ok: boolean; settings?: EtaSettings; pin?: VanPin | null; onTeam?: boolean; error?: string };

/* The poll keeps the SAME state object when nothing moved, so the map's
 * van marker (keyed on the pin) and the memoised model stay put between
 * polls instead of being torn down every half minute. */
const samePin = (a: VanPin | null, b: VanPin | null) => (a === b ? true : !!a && !!b && a.at === b.at && a.lat === b.lat && a.lon === b.lon && a.byName === b.byName);
const sameEta = (a: EtaSettings, b: EtaSettings) => a.driveMin === b.driveMin && a.startAt === b.startAt && a.planPaceSec === b.planPaceSec;

export function RouteView({ onTeam, recenter, initialEta, initialPin }: RouteViewProps) {
  const [course, setCourse] = useState<CourseFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [eta, setEta] = useState<EtaSettings>(initialEta);
  const [pin, setPin] = useState<VanPin | null>(initialPin);
  const [now, setNow] = useState<Date>(() => new Date());
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

  /* The poll: the settings and (for the team) the pin, every half minute
   * while the tab is in front, and again the moment it comes back. */
  useEffect(() => {
    let on = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/lasd26/eta", { cache: "no-store" });
        const data = (await r.json()) as EtaWire;
        if (!on || !r.ok || !data.ok || !data.settings) return;
        const next = data.settings;
        setEta((prev) => (sameEta(prev, next) ? prev : next));
        if (data.onTeam) {
          const nextPin = data.pin ?? null;
          setPin((prev) => (samePin(prev, nextPin) ? prev : nextPin));
        }
      } catch {
        /* offline in the van: keep what we have */
      }
      if (on) setNow(new Date());
    };
    const id = window.setInterval(() => void tick(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      on = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const go = (f: Omit<Focus, "id">) => {
    setFocus({ ...f, id: Date.now() });
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* THE VAN: this phone's position becomes the pin (the map asks first). */
  const onPin = useCallback(async (fix: { lat: number; lon: number; accuracyM: number }): Promise<string | null> => {
    try {
      const r = await fetch("/api/lasd26/van", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fix) });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; pin?: VanPin; error?: string };
      if (!r.ok || !data.ok || !data.pin) return data.error || "Could not pin the van";
      setPin(data.pin);
      setNow(new Date());
      return null;
    } catch {
      return "No connection · try again";
    }
  }, []);
  const onClearPin = useCallback(async (): Promise<string | null> => {
    try {
      const r = await fetch("/api/lasd26/van", { method: "DELETE" });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) return data.error || "Could not clear the pin";
      setPin(null);
      return null;
    } catch {
      return "No connection · try again";
    }
  }, []);

  const model = useMemo(() => (course ? paceModel(course, eta, pin) : null), [course, eta, pin]);

  return (
    <>
      <div className="rt-map" ref={mapRef}>
        {course ? (
          <RouteMap course={course} focus={focus} canPin={onTeam} recenter={recenter} pin={pin} onPin={onPin} onClearPin={onClearPin} />
        ) : err ? (
          <div className="rt-loading mono">Course unavailable · {err}</div>
        ) : (
          <div className="rt-loading mono">Loading the course…</div>
        )}
      </div>

      {course && <Facts course={course} />}

      <div className="wrap">
        {course && <Profile course={course} />}
        {course && model && <Turns course={course} model={model} now={now} focus={focus} onGo={go} canEdit={onTeam} eta={eta} onEta={setEta} />}
        {/* The Google Maps door sits at the FOOT of the page, after the
         * calls (owner, 2026-10-16: "Move the open in google maps button
         * to the bottom of the page after the turn by turn"). */}
        <div className="rt-chips">
          <a className="rt-chip" href={GOOGLE_MAP_URL} target="_blank" rel="noopener noreferrer">
            Open in Google Maps ↗
          </a>
        </div>
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

function Turns({
  course,
  model,
  now,
  focus,
  onGo,
  canEdit,
  eta,
  onEta,
}: {
  course: CourseFile;
  model: PaceModel;
  now: Date;
  focus: Focus | null;
  onGo: (f: Omit<Focus, "id">) => void;
  canEdit: boolean;
  eta: EtaSettings;
  onEta: (s: EtaSettings) => void;
}) {
  const drive = course.drives[0];
  const van = vanMiles(course);
  const etas = useMemo(() => rowEtas(course, model, now), [course, model, now]);
  const vanAfter = useMemo(() => vanRowAfter(course, model), [course, model]);
  const finish = etas[etas.length - 1];
  const [editing, setEditing] = useState(false);

  const vanRow =
    vanAfter !== null && model.pin && model.snap ? (
      <li key="van" className="rt-row van">
        <button type="button" onClick={() => onGo({ lon: model.pin!.lon, lat: model.pin!.lat, name: "VAN", mile: model.anchorMile, key: "van" })}>
          <span className="mi">{model.anchorMile.toFixed(1)}</span>
          <span className="tx">
            THE VAN
            <small>
              {model.snap.onDrive ? "on I-5 through Camp Pendleton" : `mile ${model.anchorMile.toFixed(1)}`} · {model.pin.byName ? `set by ${model.pin.byName} ` : ""}
              {formatAgo(model.anchorAt, now)}
            </small>
          </span>
          <span className="eta">{formatClock(model.anchorAt, model.startAt)}</span>
        </button>
      </li>
    ) : null;

  return (
    <section className="rt-sec">
      <div className="sec-head">
        <h2>Turn by turn</h2>
        <span className="mono">{course.turns.length} CALLS · RUN MILES · ETA</span>
      </div>

      {/* THE PACE ROW: what the times run on, and the knobs (the team's). */}
      <div className="rt-pace mono" role="status">
        {model.source === "van" ? (
          <span>
            <b>From the van</b> · mi {model.anchorMile.toFixed(1)} at {formatClock(model.anchorAt, model.startAt)} · <b>{formatPace(model.paceSec)}</b>
          </span>
        ) : (
          <span>
            <b>Planned</b> · <b>{formatPace(model.paceSec)}</b> until the van&apos;s first check-in
          </span>
        )}
        <span>
          start {formatClock(model.startAt, model.startAt)} · drive {model.driveMin} min
        </span>
        {model.pinNote && <span className="note">{model.pinNote}</span>}
        {canEdit && !editing && (
          <button type="button" className="rt-mini" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      {editing && <EtaForm eta={eta} onSaved={(s) => { onEta(s); setEditing(false); }} onCancel={() => setEditing(false)} />}

      <ol className="rt-list">
        {course.turns.map((t: CourseTurn, i) => {
          const key = `t${i}`;
          const e = etas[i];
          return [
            <li key={key} className={`rt-row ${t.kind}${focus?.key === key ? " is-on" : ""}${e.passed ? " passed" : ""}`}>
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
                <span className="eta" aria-label={`ETA ${formatClock(e.at, model.startAt)}`}>
                  {formatClock(e.at, model.startAt)}
                </span>
              </button>
            </li>,
            i === vanAfter ? vanRow : null,
          ];
        })}
      </ol>

      {/* EXPECTED FINISH (owner, 2026-10-21: "We should include an expected
       * finish time at the bottom"). */}
      {finish && (
        <div className="rt-finish">
          <div className="k mono">Expected finish</div>
          <div className="n">{formatClock(finish.at, model.startAt)}</div>
          <div className="s mono">
            {formatSpan((finish.at.getTime() - model.startAt.getTime()) / 1000)} from the {formatClock(model.startAt, model.startAt)} start ·{" "}
            {model.source === "van" ? `${formatPace(model.paceSec)} from the van's check-in` : `at the planned ${formatPace(model.paceSec)}`}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── The three knobs (owner: "I can input the drive time") ─────────────── */

function EtaForm({ eta, onSaved, onCancel }: { eta: EtaSettings; onSaved: (s: EtaSettings) => void; onCancel: () => void }) {
  const [start, setStart] = useState(startTimeInput(eta));
  const [drive, setDrive] = useState(String(eta.driveMin));
  const [pace, setPace] = useState(paceInput(eta.planPaceSec));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startIso = startIsoFromTime(start);
  const driveN = Number.parseInt(drive, 10);
  const driveOk = Number.isInteger(driveN) && driveN >= 0 && driveN <= 180;
  const paceSec = parsePace(pace);
  const ok = startIso !== null && driveOk && paceSec !== null;

  async function save() {
    if (busy || !ok) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/lasd26/eta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: startIso, driveMin: driveN, planPaceSec: paceSec }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; settings?: EtaSettings; error?: string };
      if (r.ok && data.ok && data.settings) onSaved(data.settings);
      else setError(data.error || "Did not save — try again.");
    } catch {
      setError("Did not save — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="rt-eta-form">
      <label>
        <span className="k mono">Start (PT)</span>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={busy} />
      </label>
      <label>
        <span className="k mono">Van drive, min</span>
        <input type="number" inputMode="numeric" min={0} max={180} step={1} value={drive} onChange={(e) => setDrive(e.target.value)} disabled={busy} />
      </label>
      <label>
        <span className="k mono">Planned pace /mi</span>
        <input type="text" inputMode="numeric" placeholder="9:00" value={pace} onChange={(e) => setPace(e.target.value)} disabled={busy} />
      </label>
      <div className="acts">
        <button type="button" className="rt-mini fill" onClick={() => void save()} disabled={busy || !ok}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="rt-mini" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {!ok && <span className="err mono">{startIso === null ? "A start time." : !driveOk ? "Drive: whole minutes, 0–180." : "Pace as m:ss, 4:00–20:00."}</span>}
        {error && <span className="err mono">{error}</span>}
      </div>
    </div>
  );
}
