"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { teamPath, tspApi } from "@/lib/tsp/paths";
import { clockText, etaMs, inText, miText, paceText, progressOf, type Leg } from "@/lib/tsp/legs";
import type { OtherVan, PositionView } from "@/lib/tsp/positions";
import { MI, climbBetween, courseUrl, feet, miles, snapToCourse, type CourseFile, type Focus } from "../course";
import type { Fix, Person } from "../TspMap";

/**
 * THE ROUTE PAGE of a team (owner, 2026-11-16: "the major page that I care
 * about is the route"). Top to bottom:
 *
 *   SHARE — what this phone tells the team: OFF, RUNNING (you carry the
 *     baton; the team's dot on the course), VAN, CREW. Remembered per phone,
 *     so the next time the page opens it is already sharing (owner: "sharing
 *     my location with my team whenever I open up the app"). A browser only
 *     reports a position while the page is open and the screen is on — the
 *     note under the pills says so.
 *   NOW — where the team is (the RUNNING phone, else the van furthest along),
 *     the pace the times run on, who is running by the plan and who is next.
 *   THE MAP — TspMap: the line, the turns, the mile markers, everyone
 *     sharing, the picked runner's legs in ink.
 *   WHO — pick a runner to see their legs on the map; tap a person to fly
 *     to them.
 *   The facts, the profile, and the TURN BY TURN with the towns as headings
 *     and a clock time on every row once the team has a start or a position.
 *
 * One poll (GET /positions, every 20 s while the tab is in front) brings the
 * dots, the plan and the team's clock settings.
 */

const TspMap = dynamic(() => import("../TspMap"), { ssr: false, loading: () => <div className="rt-loading mono">Loading the map…</div> });

type ShareKind = "off" | "runner" | "van" | "crew";
type MemberLite = { id: string; name: string; role: "runner" | "crew" };
type TeamClock = { startAt: string | null; planPaceSec: number; shareVan: boolean };
export type RouteInitial = { positions: PositionView[]; others: OtherVan[]; legs: Leg[]; team: TeamClock };

const STALE_MS = 5 * 60 * 1000;
const SEND_EVERY_MS = 20_000;

function agoText(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ${min % 60} min ago`;
}

let focusSeq = 0;

export function RouteView({
  look = "",
  nowMs,
  slug,
  route,
  secrets,
  meId,
  members,
  initial,
  initialLeg,
  initialRunner,
}: {
  /** A trial look: "" (today's), "a" map first, "b" dark dashboard, "c" clean and light. */
  look?: string;
  /** The server's clock when it rendered, so the first paint on the phone says the same "3 min ago". */
  nowMs: number;
  slug: string;
  route: string;
  secrets: boolean;
  /** This viewer's member id; null for the platform owner looking in (he reads, he does not share). */
  meId: string | null;
  members: MemberLite[];
  initial: RouteInitial;
  initialLeg: [number, number] | null;
  initialRunner: string | null;
}) {
  const [course, setCourse] = useState<CourseFile | null>(null);
  const [courseErr, setCourseErr] = useState(false);
  const [data, setData] = useState<RouteInitial>(initial);
  const [now, setNow] = useState(nowMs);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [runner, setRunner] = useState<string>(initialRunner ?? "");
  const [share, setShareState] = useState<ShareKind>("off");
  const [locating, setLocating] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const shareRef = useRef<ShareKind>("off");
  const lastFix = useRef<Fix | null>(null);
  const lastSent = useRef(0);

  /* The course file. */
  useEffect(() => {
    let dead = false;
    fetch(courseUrl(route, secrets))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: CourseFile) => {
        if (!dead) setCourse(c);
      })
      .catch(() => {
        if (!dead) setCourseErr(true);
      });
    return () => {
      dead = true;
    };
  }, [route, secrets]);

  /* The poll. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(tspApi(slug, "/positions"), { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean } & RouteInitial;
      if (res.ok && j.ok) setData({ positions: j.positions, others: j.others, legs: j.legs, team: j.team });
    } catch {
      /* the next tick tries again */
    }
    setNow(Date.now());
  }, [slug]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  /* ─── SHARE ────────────────────────────────────────────────────────────── */

  const post = useCallback(
    async (kind: ShareKind, fix: Fix | null) => {
      try {
        const res = await fetch(tspApi(slug, "/positions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, lat: fix?.lat, lon: fix?.lon, accuracyM: fix?.accuracyM }) });
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

  /* What this phone was doing last time. */
  useEffect(() => {
    if (!meId) return;
    try {
      const v = window.localStorage.getItem(`tsp-share:${slug}`);
      if (v === "runner" || v === "van" || v === "crew") {
        shareRef.current = v;
        setShareState(v);
      }
    } catch {
      /* off */
    }
  }, [slug, meId]);

  const onFix = useCallback(
    (fix: Fix) => {
      lastFix.current = fix;
      const kind = shareRef.current;
      if (kind === "off") return;
      if (Date.now() - lastSent.current >= SEND_EVERY_MS) {
        lastSent.current = Date.now();
        void post(kind, fix);
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

  /* ─── What the page works out ──────────────────────────────────────────── */

  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.name] as const)), [members]);

  const snapped = useMemo(() => {
    if (!course) return [];
    return data.positions.map((p) => ({ p, snap: snapToCourse(course, p.lat, p.lon), stale: now - Date.parse(p.at) > STALE_MS }));
  }, [course, data.positions, now]);

  /** The team's place on the course: the RUNNING phone if it is on the course, else the van furthest along. */
  const lead = useMemo(() => {
    const on = snapped.filter((s) => s.snap.offM < 1.5 * MI);
    const r = on.find((s) => s.p.kind === "runner");
    if (r) return r;
    const vans = on.filter((s) => s.p.kind === "van").sort((a, b) => b.snap.m - a.snap.m);
    return vans[0] ?? null;
  }, [snapped]);

  const startMs = data.team.startAt ? Date.parse(data.team.startAt) : null;
  const progress = useMemo(
    () => progressOf({ startMs, planPaceSec: data.team.planPaceSec, atCm: lead ? Math.round((lead.snap.m / MI) * 100) : null, atMs: lead ? Date.parse(lead.p.at) : null }),
    [startMs, data.team.planPaceSec, lead],
  );
  const eta = useCallback((m: number) => etaMs(progress, startMs, Math.round((m / MI) * 100)), [progress, startMs]);

  const legNow = progress.atCm !== null ? data.legs.find((l) => l.startCm <= (progress.atCm as number) && (progress.atCm as number) < l.endCm) ?? null : null;
  const legNext = progress.atCm !== null ? data.legs.find((l) => l.startCm > (progress.atCm as number)) ?? null : data.legs[0] ?? null;

  const people: Person[] = useMemo(() => {
    const mine: Person[] = snapped
      // This phone's own dot is the LOCATE dot; no tag on top of it.
      .filter((s) => s.p.memberId !== meId || !locating)
      .map((s) => ({
        id: s.p.memberId,
        label: s.p.kind === "runner" ? `RUNNER · ${s.p.name.split(/\s+/)[0].toUpperCase()}` : s.p.kind === "van" ? `VAN · ${s.p.name.split(/\s+/)[0].toUpperCase()}` : s.p.name.split(/\s+/)[0].toUpperCase(),
        kind: s.p.kind === "off" ? "crew" : s.p.kind,
        lon: s.p.lon,
        lat: s.p.lat,
        stale: s.stale,
        sub: `${s.snap.offM < 1.5 * MI ? `mi ${miles(s.snap.m)}` : `${miles(s.snap.offM)} mi off the course`} · ${agoText(s.p.at, now)}`,
      }));
    const theirs: Person[] = data.others.map((o, i) => ({ id: `o${i}`, label: `${o.teamName.toUpperCase()} VAN`, kind: "other", lon: o.lon, lat: o.lat, stale: now - Date.parse(o.at) > STALE_MS, sub: `${course ? `mi ${miles(snapToCourse(course, o.lat, o.lon).m)} · ` : ""}${agoText(o.at, now)}` }));
    return [...mine, ...theirs];
  }, [snapped, data.others, meId, locating, now, course]);

  /** The picked runner's legs — or the one leg the address asked for — in ink on the map. */
  const highlight: [number, number][] = useMemo(() => {
    if (initialLeg && !runner) return [[(initialLeg[0] / 100) * MI, (initialLeg[1] / 100) * MI]];
    if (!runner) return [];
    return data.legs.filter((l) => l.memberId === runner).map((l) => [(l.startCm / 100) * MI, (l.endCm / 100) * MI]);
  }, [runner, data.legs, initialLeg]);

  /* The address asked for a leg: fit the map to it once the course is in. */
  const didFocus = useRef(false);
  useEffect(() => {
    if (!course || !initialLeg || didFocus.current) return;
    didFocus.current = true;
    const t = window.setTimeout(() => setFocus({ id: ++focusSeq, kind: "range", fromM: (initialLeg[0] / 100) * MI, toM: (initialLeg[1] / 100) * MI }), 600);
    return () => window.clearTimeout(t);
  }, [course, initialLeg]);

  const flyTo = (lon: number, lat: number, label: string, m: number) => {
    setFocus({ id: ++focusSeq, kind: "point", lon, lat, label, mile: m / MI });
    document.getElementById("tsp-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* The list: the towns as headings, the turns between them. */
  const rows = useMemo(() => {
    if (!course) return [];
    const out: { key: string; kind: "place" | "turn" | "cp"; m: number; lon: number; lat: number; text: string; sub: string | null }[] = [];
    for (const p of course.places) out.push({ key: `p${p.m}`, kind: "place", m: p.m, lon: p.lon, lat: p.lat, text: p.name, sub: [p.note, p.services].filter(Boolean).join(" · ") || null });
    for (const t of course.turns) out.push({ key: `t${t.m}`, kind: "turn", m: t.m, lon: t.lon, lat: t.lat, text: t.name, sub: null });
    course.checkpoints.forEach((c, i) => out.push({ key: `c${i}`, kind: "cp", m: c.m, lon: c.lon, lat: c.lat, text: `Checkpoint ${i + 1}: ${c.name}`, sub: c.note }));
    return out.sort((a, b) => a.m - b.m || (a.kind === "place" ? -1 : 1));
  }, [course]);

  const runners = members.filter((m) => m.role === "runner");
  const profile = useMemo(() => {
    if (!course || course.profile.length < 2) return null;
    const W = 720;
    const H = 110;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, e] of course.profile) {
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
    const x = (m: number) => (m / course.length_m) * W;
    const y = (e: number) => H - 4 - ((e - lo) / Math.max(1, hi - lo)) * (H - 12);
    const step = Math.max(1, Math.floor(course.profile.length / 700));
    const pts = course.profile.filter((_, i) => i % step === 0 || i === course.profile.length - 1);
    const d = pts.map(([m, e], i) => `${i ? "L" : "M"}${x(m).toFixed(1)},${y(e).toFixed(1)}`).join("");
    return { W, H, d, area: `${d}L${W},${H}L0,${H}Z`, lo, hi, x };
  }, [course]);

  const finishEta = course ? eta(course.length_m) : null;

  const shareBlock = meId ? (
            <div className="tsp-share">
              <span className="tsp-k">This phone is</span>
              <div className="tsp-pills" role="radiogroup" aria-label="Share my location as">
                {(
                  [
                    ["off", "Off", "not sharing"],
                    ["runner", "Running", "I have the baton"],
                    ["van", "Van", "riding along"],
                    ["crew", "Crew", "somewhere else"],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label className="tsp-pill" key={key}>
                    <input type="radio" name="tsp-share" checked={share === key} onChange={() => setShare(key)} />
                    <span>
                      {label}
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="tm-note">
                {share === "off" ? "Your team cannot see you." : locating ? "Sharing while this page is open and the screen is on." : "Waiting for this phone's location…"}
                {data.team.shareVan && share === "van" ? " Other teams can see this van." : ""}
                {shareNote && <strong> {shareNote}</strong>}
              </p>
            </div>
  ) : null;
  const nowBlock = (
          <div className="tsp-now">
            <div>
              <div className="k">The team</div>
              <div className="v">{lead ? `Mile ${miles(lead.snap.m)}` : startMs && startMs > now ? `Starts ${clockText(startMs, now)}` : "No one sharing yet"}</div>
              <small>{lead ? `${lead.p.kind === "runner" ? "runner" : "van"} · ${lead.p.name} · ${agoText(lead.p.at, now)}` : "the dot appears when someone shares as RUNNING or VAN"}</small>
            </div>
            <div>
              <div className="k">Pace</div>
              <div className="v">{paceText(progress.paceSec)}/mi</div>
              <small>{progress.source === "moving" ? "from the start and where we are" : "planned, until we have a start and a position"}</small>
            </div>
            <div>
              <div className="k">{legNow ? "Running now" : "Next up"}</div>
              <div className="v">{legNow ? nameOf.get(legNow.memberId ?? "") ?? "Nobody down" : legNext ? nameOf.get(legNext.memberId ?? "") ?? "Nobody down" : "No plan yet"}</div>
              <small>
                {legNow
                  ? `mi ${miText(legNow.startCm)}–${miText(legNow.endCm)}${legNext ? ` · then ${nameOf.get(legNext.memberId ?? "") ?? "nobody"} at mi ${miText(legNext.startCm)}` : ""}`
                  : legNext
                    ? `mi ${miText(legNext.startCm)}–${miText(legNext.endCm)}`
                    : "set it on the LEGS page"}
              </small>
            </div>
          </div>
  );
  const looks = (
    <nav className="tsp-looks mono" aria-label="Trial looks">
      <span>LOOK</span>
      {(
        [
          ["", "Now"],
          ["a", "A · Map first"],
          ["b", "B · Dashboard"],
          ["c", "C · Clean"],
        ] as const
      ).map(([k, label]) => (
        <a key={k} href={k ? `${teamPath(slug, "")}?look=${k}` : teamPath(slug, "")} aria-current={look === k ? "page" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );

  return (
    <>
      {look !== "a" && (
        <section className="rt-top">
          <div className="wrap">
            {shareBlock}
            {nowBlock}
          </div>
        </section>
      )}

      <div className="rt-map" id="tsp-map">
        {course ? (
          <TspMap course={course} focus={focus} highlight={highlight} people={people} onFix={onFix} autoLocate={share !== "off"} onLocating={setLocating} dark={look === "b"} />
        ) : (
          <div className="rt-loading mono">{courseErr ? "The course file did not load — refresh to try again." : "Loading the course…"}</div>
        )}
        {look === "a" && course && (
          <>
            <div className="tsp-over top">{nowBlock}</div>
            <div className="tsp-over bottom">{shareBlock}</div>
          </>
        )}
      </div>

      <div className="wrap">{looks}</div>

      <section className="rt-sec">
        <div className="wrap">
          <div className="tsp-who">
            <label className="tsp-k" htmlFor="tsp-runner">
              Show the legs of
            </label>
            <select id="tsp-runner" className="tsp-in" value={runner} onChange={(e) => setRunner(e.target.value)}>
              <option value="">— nobody —</option>
              {runners.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === meId ? " (me)" : ""}
                </option>
              ))}
            </select>
            <a className="rt-chip" href={teamPath(slug, runner ? `/legs?runner=${runner}` : "/legs")}>
              Legs &amp; who runs what →
            </a>
          </div>
          {snapped.length + data.others.length > 0 && (
            <ul className="rt-list tsp-people">
              {people.map((p) => (
                <li className={`rt-row${p.stale ? " passed" : ""}`} key={p.id}>
                  <button type="button" onClick={() => flyTo(p.lon, p.lat, p.label, course ? snapToCourse(course, p.lat, p.lon).m : 0)}>
                    <span className="mi">{p.kind === "other" ? "VAN" : p.kind.toUpperCase()}</span>
                    <span className="tx">
                      {p.label}
                      <small>{p.sub}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {course && (
        <section className="rt-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>The course</h2>
              <span className="mono">
                {miles(course.length_m)} MI · {feet(course.climb_m)} FT UP · {course.turns.length} TURNS
              </span>
            </div>
            <div className="tsp-facts mono">
              <span>
                <b>{miles(course.length_m)}</b> miles
              </span>
              <span>
                <b>{feet(course.climb_m)}</b> ft up
              </span>
              <span>
                <b>{feet(course.descent_m)}</b> ft down
              </span>
              <span>
                <b>{miles(course.dirt_m)}</b> mi dirt
              </span>
              {finishEta !== null && (
                <span>
                  finish <b>{clockText(finishEta, now)}</b>
                </span>
              )}
            </div>
            {profile && (
              <div className="rt-profile">
                <svg viewBox={`0 0 ${profile.W} ${profile.H}`} role="img" aria-label="Elevation along the course">
                  <path d={profile.area} fill="var(--safety)" opacity=".45" />
                  <path d={profile.d} fill="none" stroke="var(--ink)" strokeWidth="1.6" />
                  {highlight.map(([a, b], i) => (
                    <rect key={i} x={profile.x(a)} y={0} width={Math.max(1.5, profile.x(b) - profile.x(a))} height={profile.H} fill="var(--ink)" opacity=".28" />
                  ))}
                  {lead && <line x1={profile.x(lead.snap.m)} x2={profile.x(lead.snap.m)} y1={0} y2={profile.H} stroke="var(--safety-ink)" strokeWidth="2.5" />}
                </svg>
                <div className="k">
                  <span>
                    START · {feet(profile.lo)}–{feet(profile.hi)} FT
                  </span>
                  <span>FINISH</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {course && (
        <section className="rt-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Turn by turn</h2>
              <span className="mono">TAP A ROW FOR THE MAP</span>
            </div>
            <ol className="rt-list">
              {rows.map((r) => {
                const t = eta(r.m);
                const passed = progress.atCm !== null && r.m < ((progress.atCm as number) / 100) * MI;
                return (
                  <li className={`rt-row${r.kind === "place" ? " start" : ""}${r.kind === "cp" ? " restart" : ""}${passed ? " passed" : ""}`} key={r.key}>
                    <button type="button" onClick={() => flyTo(r.lon, r.lat, r.text, r.m)}>
                      <span className="mi">{miles(r.m)}</span>
                      <span className="tx">
                        {r.text}
                        {r.sub && <small>{r.sub}</small>}
                      </span>
                      {t !== null && !passed && <span className="eta">{clockText(t, now)}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
            {finishEta !== null && (
              <div className="rt-finish">
                <div className="k">Expected finish</div>
                <div className="n">{clockText(finishEta, now)}</div>
                <div className="s">
                  {inText(finishEta, now)} · at {paceText(progress.paceSec)}/mi ({progress.source === "moving" ? "the pace so far" : "the planned pace"}) · {feet(climbBetween(course, lead?.snap.m ?? 0, course.length_m).up)} ft of climbing left
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
