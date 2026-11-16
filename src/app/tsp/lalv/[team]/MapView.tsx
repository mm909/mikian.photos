"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { teamPath, tspApi } from "@/lib/tsp/paths";
import { clockText, handoffs as handoffsOf, miText, paceText } from "@/lib/tsp/legs";
import { MI, feet, gpxOf, miles, pointAt, snapToCourse, type Focus } from "../course";
import type { Fix, MapDraft, MapHandoff, MapLeg, Person } from "../TspMap";
import { NOBODY_COLOR, STALE_MS, agoText, colorsOf, first, useClock, useCourse, useLive, type LiveData, type MemberLite } from "./live";

/**
 * A TEAM'S FRONT PAGE IS THE MAP AND NOTHING ELSE (owner, 2026-11-16: "I want
 * a dedicated page for just the route (physical map), other settings/options
 * should be stored in a info button/box or options menu on the map. Other
 * things like turn by turn, etas etc can be on a diff page").
 *
 * The map fills the screen under the bar. On it: the line with every leg in
 * its runner's colour (owner: "see the route assigned to each runner"), the
 * HAND-OFF tags where one shift gives the course to the next, the mile
 * numerals, the turn dots, everyone who is sharing.
 *
 * OPTIONS (the one button, top left) holds the rest:
 *   THIS PHONE IS — Off / Running / Van / Crew, remembered per phone, so the
 *     page shares again as soon as it opens.
 *   RUNNERS — tap one to see only their legs.
 *   SHOW — mile markers, turn dots, hand-offs, runner colours, people.
 *   THE ROUTE — the figures, the GPX file, and for a captain FIX THE ROUTE.
 *
 * FIX THE ROUTE (owner: "allow me to clean up/edit a map"): tap the line
 * where the bad part starts, tap where it ends, tap the road it should take
 * instead (as many points as it needs, or none), PREVIEW, SAVE. The server
 * re-routes that stretch on foot — or draws it straight through the taps,
 * for desert the map has no path for — and the team gets its own copy of the
 * course (/api/tsp/[team]/course; lib/tsp/courseFix.ts). The legs keep their
 * place: everything after the fix shifts by what the fix added or saved.
 */

const TspMap = dynamic(() => import("../TspMap"), { ssr: false, loading: () => <div className="rt-loading mono">Loading the map…</div> });

type ShareKind = "off" | "runner" | "van" | "crew";
type Shown = { miles: boolean; turns: boolean; people: boolean; handoffs: boolean; colors: boolean };
const SHOWN: Shown = { miles: true, turns: true, people: true, handoffs: true, colors: true };
const SEND_EVERY_MS = 20_000;

type FixState = {
  a: number | null;
  b: number | null;
  vias: [number, number][];
  mode: "road" | "straight";
  preview: { stretch: [number, number][]; oldM: number; newM: number } | null;
  busy: boolean;
  note: string;
};
const NEW_FIX: FixState = { a: null, b: null, vias: [], mode: "road", preview: null, busy: false, note: "" };

let focusSeq = 0;

export function MapView({
  nowMs,
  slug,
  teamName,
  courseUrl: initialCourseUrl,
  edited: initialEdited,
  captain,
  meId,
  members,
  initial,
  initialLeg,
  initialRunner,
  initialAt,
}: {
  /** The server's clock when it rendered, so the first paint on the phone says the same "3 min ago". */
  nowMs: number;
  slug: string;
  teamName: string;
  courseUrl: string;
  /** The team is on its own fixed copy of the course. */
  edited: boolean;
  captain: boolean;
  /** This viewer's member id; null for the platform owner looking in (he reads, he does not share). */
  meId: string | null;
  members: MemberLite[];
  initial: LiveData;
  initialLeg: [number, number] | null;
  initialRunner: string | null;
  /** Metres along the course to open on (a row tapped on the TURNS page). */
  initialAt: number | null;
}) {
  const [courseUrl, setCourseUrl] = useState(initialCourseUrl);
  const [edited, setEdited] = useState(initialEdited);
  const { course, failed } = useCourse(courseUrl);
  const { data, now, refresh } = useLive(slug, initial, nowMs);
  const { snapped, lead, progress, etaCm } = useClock(course, data, members, now);

  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [runner, setRunner] = useState<string>(initialRunner ?? "");
  const [shown, setShownState] = useState<Shown>(SHOWN);
  const [fix, setFix] = useState<FixState | null>(null);

  /* ─── SHARE ────────────────────────────────────────────────────────────── */

  const [share, setShareState] = useState<ShareKind>("off");
  const [locating, setLocating] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const shareRef = useRef<ShareKind>("off");
  const lastFix = useRef<Fix | null>(null);
  const lastSent = useRef(0);

  const post = useCallback(
    async (kind: ShareKind, at: Fix | null) => {
      try {
        const res = await fetch(tspApi(slug, "/positions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, lat: at?.lat, lon: at?.lon, accuracyM: at?.accuracyM }) });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        setShareNote(res.ok && j.ok ? "" : j.error || "Could not share — still trying.");
        if (res.ok) lastSent.current = Date.now();
      } catch {
        setShareNote("No signal — the dot will catch up.");
      }
    },
    [slug],
  );

  const setShare = useCallback(
    (kind: ShareKind) => {
      shareRef.current = kind;
      setShareState(kind);
      try {
        window.localStorage.setItem(`tsp-share:${slug}`, kind);
      } catch {
        /* a private window forgets; the pills still work */
      }
      if (kind === "off") void post("off", null).then(refresh);
      else if (lastFix.current) void post(kind, lastFix.current).then(refresh);
    },
    [slug, post, refresh],
  );

  /* What this phone was doing, and what it had switched on, last time. */
  useEffect(() => {
    try {
      const o = JSON.parse(window.localStorage.getItem(`tsp-map:${slug}`) ?? "null") as Partial<Shown> | null;
      if (o) setShownState({ ...SHOWN, ...Object.fromEntries(Object.entries(o).filter(([k, v]) => k in SHOWN && typeof v === "boolean")) });
      const v = window.localStorage.getItem(`tsp-share:${slug}`);
      if (meId && (v === "runner" || v === "van" || v === "crew")) {
        shareRef.current = v;
        setShareState(v);
      }
    } catch {
      /* the defaults */
    }
  }, [slug, meId]);

  const setShown = (key: keyof Shown, on: boolean) =>
    setShownState((cur) => {
      const next = { ...cur, [key]: on };
      try {
        window.localStorage.setItem(`tsp-map:${slug}`, JSON.stringify(next));
      } catch {
        /* fine */
      }
      return next;
    });

  const onFix = useCallback(
    (at: Fix) => {
      lastFix.current = at;
      const kind = shareRef.current;
      if (kind === "off") return;
      if (Date.now() - lastSent.current >= SEND_EVERY_MS) {
        lastSent.current = Date.now();
        void post(kind, at);
      }
    },
    [post],
  );

  /* Someone else took the baton: this phone stops calling itself the runner. */
  useEffect(() => {
    if (!meId || shareRef.current !== "runner") return;
    const mine = data.positions.find((p) => p.memberId === meId);
    const other = data.positions.find((p) => p.kind === "runner" && p.memberId !== meId);
    if (mine && mine.kind === "crew" && other) {
      shareRef.current = "crew";
      setShareState("crew");
      setShareNote(`${other.name} has the baton now.`);
      try {
        window.localStorage.setItem(`tsp-share:${slug}`, "crew");
      } catch {
        /* fine */
      }
    }
  }, [data.positions, meId, slug]);

  /* ─── What the map draws ───────────────────────────────────────────────── */

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m] as const)), [members]);
  const colors = useMemo(() => colorsOf(members), [members]);
  const runners = useMemo(() => members.filter((m) => m.role === "runner" || data.legs.some((l) => l.memberId === m.id)), [members, data.legs]);

  const people: Person[] = useMemo(() => {
    const mine: Person[] = snapped
      // This phone's own dot is the LOCATE dot; no tag on top of it.
      .filter((s) => s.p.memberId !== meId || !locating)
      .map((s) => ({
        id: s.p.memberId,
        label: s.p.kind === "runner" ? `RUNNER · ${first(s.p.name).toUpperCase()}` : s.p.kind === "van" ? `VAN · ${first(s.p.name).toUpperCase()}` : first(s.p.name).toUpperCase(),
        kind: s.p.kind === "off" ? "crew" : s.p.kind,
        lon: s.p.lon,
        lat: s.p.lat,
        stale: s.stale,
        sub: `${s.snap.offM < 1.5 * MI ? `mi ${miles(s.snap.m)}` : `${miles(s.snap.offM)} mi off the course`} · ${agoText(s.p.at, now)}`,
      }));
    const theirs: Person[] = data.others.map((o, i) => ({ id: `o${i}`, label: `${o.teamName.toUpperCase()} VAN`, kind: "other", lon: o.lon, lat: o.lat, stale: now - Date.parse(o.at) > STALE_MS, sub: `${course ? `mi ${miles(snapToCourse(course, o.lat, o.lon).m)} · ` : ""}${agoText(o.at, now)}` }));
    return [...mine, ...theirs];
  }, [snapped, data.others, meId, locating, now, course]);

  const whenText = useCallback(
    (cm: number) => {
      const t = etaCm(cm);
      return t === null ? "" : ` · about ${clockText(t, now)}`;
    },
    [etaCm, now],
  );

  /** Every leg in its runner's colour; with a runner picked, only theirs. */
  const mapLegs: MapLeg[] = useMemo(() => {
    if (!shown.colors && !runner) return [];
    return data.legs
      .filter((l) => !runner || l.memberId === runner)
      .map((l) => {
        const m = l.memberId ? byId.get(l.memberId) : undefined;
        return {
          fromM: (l.startCm / 100) * MI,
          toM: (l.endCm / 100) * MI,
          color: m ? colors.get(m.id) ?? NOBODY_COLOR : NOBODY_COLOR,
          title: (m?.name ?? "Nobody yet").toUpperCase(),
          sub: `mi ${miText(l.startCm)}–${miText(l.endCm)} · ${miText(l.endCm - l.startCm)} mi${m?.squad ? ` · shift ${m.squad}` : ""}${whenText(l.startCm)}`,
        };
      });
  }, [data.legs, runner, shown.colors, byId, colors, whenText]);

  const handoffs = useMemo(() => handoffsOf(data.legs, (id) => (id ? byId.get(id)?.squad ?? 0 : 0)), [data.legs, byId]);
  const mapHandoffs: MapHandoff[] = useMemo(() => {
    if (!shown.handoffs) return [];
    return handoffs.map((h, i) => ({
      m: (h.cm / 100) * MI,
      tag: `H${i + 1}`,
      title: `Hand-off ${i + 1}: shift ${h.fromSquad} to shift ${h.toSquad}`,
      sub: `${first(byId.get(h.fromId ?? "")?.name ?? "?")} hands to ${first(byId.get(h.toId ?? "")?.name ?? "?")}${whenText(h.cm)}`,
    }));
  }, [handoffs, shown.handoffs, byId, whenText]);

  /** The one leg the address asked for, in ink. */
  const highlight: [number, number][] = useMemo(() => (initialLeg && !runner ? [[(initialLeg[0] / 100) * MI, (initialLeg[1] / 100) * MI]] : []), [initialLeg, runner]);

  /* The address asked for a leg or a point: show it once the course is in. */
  const didFocus = useRef(false);
  useEffect(() => {
    if (!course || didFocus.current || (!initialLeg && initialAt === null)) return;
    didFocus.current = true;
    const t = window.setTimeout(() => {
      if (initialLeg) return setFocus({ id: ++focusSeq, kind: "range", fromM: (initialLeg[0] / 100) * MI, toM: (initialLeg[1] / 100) * MI });
      const m = Math.max(0, Math.min(course.length_m, initialAt ?? 0));
      const [lon, lat] = pointAt(course, m);
      const turn = course.turns.find((x) => Math.abs(x.m - m) < 30);
      const ho = handoffs.findIndex((h) => Math.abs((h.cm / 100) * MI - m) < 30);
      setFocus({ id: ++focusSeq, kind: "point", lon, lat, label: ho >= 0 ? `Hand-off ${ho + 1}` : turn?.name ?? "Here", mile: m / MI });
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, initialLeg, initialAt]);

  const pickRunner = (id: string) => {
    setRunner(id);
    const mine = data.legs.filter((l) => l.memberId === id);
    if (id && mine.length > 0) setFocus({ id: ++focusSeq, kind: "range", fromM: (mine[0].startCm / 100) * MI, toM: (mine[mine.length - 1].endCm / 100) * MI });
  };

  const perRunner = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of data.legs) if (l.memberId) m.set(l.memberId, (m.get(l.memberId) ?? 0) + (l.endCm - l.startCm));
    return m;
  }, [data.legs]);

  function downloadGpx() {
    if (!course) return;
    const blob = new Blob([gpxOf(course, `${teamName} — TSP LA to Las Vegas`, handoffs.map((h, i) => ({ name: `Hand-off ${i + 1}`, m: (h.cm / 100) * MI })))], { type: "application/gpx+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-tsp-course.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ─── FIX THE ROUTE ────────────────────────────────────────────────────── */

  const onPick = useCallback(
    (lon: number, lat: number) => {
      if (!course) return;
      setFix((f) => {
        if (!f || f.busy) return f;
        if (f.a === null || f.b === null) {
          const s = snapToCourse(course, lat, lon);
          if (s.offM > 800) return { ...f, note: "Tap ON the blue line." };
          if (f.a === null) return { ...f, a: s.m, note: "" };
          if (Math.abs(s.m - f.a) < 30) return { ...f, note: "Tap further along the line." };
          return { ...f, a: Math.min(f.a, s.m), b: Math.max(f.a, s.m), note: "" };
        }
        if (f.vias.length >= 12) return { ...f, note: "Twelve points is the most one fix takes — save this one and start another." };
        return { ...f, vias: [...f.vias, [lon, lat]], preview: null, note: "" };
      });
    },
    [course],
  );

  async function sendFix(save: boolean) {
    if (!fix || fix.a === null || fix.b === null || fix.busy) return;
    setFix({ ...fix, busy: true, note: "" });
    try {
      const res = await fetch(tspApi(slug, "/course"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromM: fix.a, toM: fix.b, vias: fix.vias, mode: fix.mode, save }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; stretch?: [number, number][]; oldM?: number; newM?: number; url?: string };
      if (!res.ok || !j.ok || !j.stretch) throw new Error(j.error || "That did not work — try again.");
      if (save) {
        setFix(null);
        setEdited(true);
        if (j.url) setCourseUrl(j.url);
        void refresh();
        return;
      }
      setFix((f) => (f ? { ...f, busy: false, preview: { stretch: j.stretch as [number, number][], oldM: j.oldM ?? 0, newM: j.newM ?? 0 } } : f));
    } catch (e) {
      setFix((f) => (f ? { ...f, busy: false, note: e instanceof Error ? e.message : "That did not work — try again." } : f));
    }
  }

  async function backToStock() {
    if (!window.confirm("Throw away this team's fixes and go back to the stock route? The legs keep their mile numbers.")) return;
    const res = await fetch(tspApi(slug, "/course"), { method: "DELETE" });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string };
    if (res.ok && j.ok && j.url) {
      setEdited(false);
      setCourseUrl(j.url);
    }
  }

  const draft: MapDraft | null = useMemo(() => {
    if (!fix || !course) return null;
    const points: MapDraft["points"] = [];
    const at = (m: number) => {
      const s = Math.max(0, Math.min(course.length_m, m));
      const i = Math.max(1, course.cum_m.findIndex((c) => c >= s));
      const span = course.cum_m[i] - course.cum_m[i - 1];
      const t = span > 0 ? (s - course.cum_m[i - 1]) / span : 0;
      return { lon: course.coords[i - 1][0] + (course.coords[i][0] - course.coords[i - 1][0]) * t, lat: course.coords[i - 1][1] + (course.coords[i][1] - course.coords[i - 1][1]) * t };
    };
    if (fix.a !== null) points.push({ ...at(fix.a), label: "A" });
    if (fix.b !== null) points.push({ ...at(fix.b), label: "B" });
    fix.vias.forEach(([lon, lat], i) => points.push({ lon, lat, label: String(i + 1) }));
    return { old: fix.a !== null && fix.b !== null ? [fix.a, fix.b] : null, points, line: fix.preview?.stretch ?? null };
  }, [fix, course]);

  const mapShown = useMemo(() => ({ miles: shown.miles, turns: shown.turns, people: shown.people }), [shown.miles, shown.turns, shown.people]);
  const fixStep = !fix ? 0 : fix.a === null ? 1 : fix.b === null ? 2 : 3;

  return (
    <div className="rt-map tsp-full" id="tsp-map">
      {course ? (
        <TspMap course={course} focus={focus} highlight={highlight} people={people} onFix={onFix} autoLocate={share !== "off"} onLocating={setLocating} legs={mapLegs} handoffs={fix ? [] : mapHandoffs} show={mapShown} onPick={fix ? onPick : null} draft={draft} />
      ) : (
        <div className="rt-loading mono">{failed ? "The course file did not load — refresh to try again." : "Loading the course…"}</div>
      )}

      {!fix && (
        <button type="button" className="rt-btn tsp-optbtn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="tsp-sheet">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span>{open ? "CLOSE" : "OPTIONS"}</span>
          {!open && share !== "off" && <i className="dot" aria-label="Sharing this phone's location" />}
        </button>
      )}

      {open && !fix && (
        <aside className="tsp-sheet" id="tsp-sheet" aria-label="Map options">
          {meId && (
            <div className="grp">
              <span className="tsp-k">This phone is</span>
              <div className="tsp-pills four" role="radiogroup" aria-label="Share my location as">
                {(
                  [
                    ["off", "Off"],
                    ["runner", "Running"],
                    ["van", "Van"],
                    ["crew", "Crew"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="tsp-pill" key={key}>
                    <input type="radio" name="tsp-share" checked={share === key} onChange={() => setShare(key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <p className="tm-note">
                {share === "off" ? "Your team cannot see you." : locating ? "Sharing while this page is open and the screen is on." : "Waiting for this phone's location…"}
                {share === "runner" ? " Running means you carry the baton: you are the team's dot." : ""}
                {data.team.shareVan && share === "van" ? " Other teams can see this van." : ""}
                {shareNote && <strong> {shareNote}</strong>}
              </p>
            </div>
          )}

          <div className="grp">
            <span className="tsp-k">The team</span>
            <p className="tsp-line">
              {lead ? (
                <>
                  <b>Mile {miles(lead.snap.m)}</b> · {lead.p.kind === "runner" ? "runner" : "van"} {first(lead.p.name)} · {agoText(lead.p.at, now)}
                </>
              ) : (
                "Nobody is sharing as RUNNING or VAN yet."
              )}
            </p>
            <div className="tsp-links">
              <a className="rt-chip" href={teamPath(slug, "/turns")}>
                Turn by turn &amp; ETAs →
              </a>
              <a className="rt-chip" href={teamPath(slug, "/legs")}>
                The plan →
              </a>
            </div>
          </div>

          <div className="grp">
            <span className="tsp-k">Runners — tap one for just their legs</span>
            <div className="tsp-legend">
              <button type="button" className={`who${runner === "" ? " on" : ""}`} onClick={() => setRunner("")}>
                <i style={{ background: "var(--ink)" }} />
                Everyone
              </button>
              {runners.map((m) => (
                <button type="button" key={m.id} className={`who${runner === m.id ? " on" : ""}`} onClick={() => pickRunner(m.id)}>
                  <i style={{ background: colors.get(m.id) ?? NOBODY_COLOR }} />
                  {first(m.name)}
                  <small>
                    {((perRunner.get(m.id) ?? 0) / 100).toFixed(1)} mi{m.paceSec ? ` · ${paceText(m.paceSec)}` : ""}
                    {m.squad ? ` · S${m.squad}` : ""}
                  </small>
                </button>
              ))}
            </div>
            {data.legs.length === 0 && <p className="tm-note">No plan yet — lay one on the PLAN page and the line takes the runners&apos; colours.</p>}
          </div>

          <div className="grp">
            <span className="tsp-k">Show on the map</span>
            <div className="tsp-checks">
              {(
                [
                  ["colors", "Runner colours"],
                  ["handoffs", `Hand-offs${handoffs.length ? ` (${handoffs.length})` : ""}`],
                  ["miles", "Mile markers"],
                  ["turns", "Turn dots"],
                  ["people", "People and vans"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={shown[key]} onChange={(e) => setShown(key, e.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {course && (
            <div className="grp">
              <span className="tsp-k">The route{edited ? " — with this team's fixes" : ""}</span>
              <p className="tsp-line">
                <b>{miles(course.length_m)} mi</b> · {feet(course.climb_m)} ft up · {miles(course.dirt_m)} mi dirt · {course.turns.length} turns
              </p>
              <div className="tsp-links">
                <button type="button" className="rt-chip" onClick={downloadGpx}>
                  Download GPX
                </button>
                {captain && (
                  <button
                    type="button"
                    className="rt-chip"
                    onClick={() => {
                      setOpen(false);
                      setFix(NEW_FIX);
                    }}
                  >
                    Fix the route
                  </button>
                )}
                {captain && edited && (
                  <button type="button" className="rt-chip" onClick={() => void backToStock()}>
                    Back to the stock route
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {fix && (
        <div className="tsp-fix" role="group" aria-label="Fix the route">
          <div className="say">
            <b>FIX THE ROUTE · {fixStep} OF 3</b>
            {fixStep === 1 && "Tap the line where the bad part STARTS."}
            {fixStep === 2 && "Now tap the line where it ENDS."}
            {fixStep === 3 &&
              (fix.preview
                ? `New line in orange: ${(fix.preview.newM / MI).toFixed(2)} mi, was ${(fix.preview.oldM / MI).toFixed(2)} mi. Save it, or tap more points.`
                : fix.mode === "road"
                  ? "Tap the road it should take instead (or nothing, for the most direct way). Then PREVIEW."
                  : "Tap the points to draw it through, in order. Then PREVIEW.")}
            {fix.note && <em> {fix.note}</em>}
          </div>
          <div className="btns">
            {fixStep === 3 && (
              <>
                <button type="button" className={`rt-mini${fix.mode === "road" ? " fill" : ""}`} onClick={() => setFix({ ...fix, mode: "road", preview: null })}>
                  Follow roads
                </button>
                <button type="button" className={`rt-mini${fix.mode === "straight" ? " fill" : ""}`} onClick={() => setFix({ ...fix, mode: "straight", preview: null })}>
                  Straight lines
                </button>
                <button type="button" className="rt-mini" disabled={fix.busy} onClick={() => void sendFix(false)}>
                  {fix.busy && !fix.preview ? "Routing…" : "Preview"}
                </button>
                {fix.preview && (
                  <button type="button" className="rt-mini fill" disabled={fix.busy} onClick={() => void sendFix(true)}>
                    {fix.busy ? "Saving…" : "Save"}
                  </button>
                )}
              </>
            )}
            {fixStep > 1 && (
              <button
                type="button"
                className="rt-mini"
                disabled={fix.busy}
                onClick={() => setFix(fix.vias.length > 0 ? { ...fix, vias: fix.vias.slice(0, -1), preview: null, note: "" } : fix.b !== null ? { ...fix, b: null, preview: null, note: "" } : { ...fix, a: null, note: "" })}
              >
                Undo
              </button>
            )}
            <button type="button" className="rt-mini" onClick={() => setFix(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
