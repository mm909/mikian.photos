"use client";

import { useMemo } from "react";
import { teamPath } from "@/lib/tsp/paths";
import { clockText, handoffs as handoffsOf, inText, miText, paceText } from "@/lib/tsp/legs";
import { MI, climbBetween, feet, miles } from "../../course";
import { agoText, first, useClock, useCourse, useLive, type LiveData, type MemberLite } from "../live";

/**
 * TURN BY TURN AND THE CLOCK (owner, 2026-11-16: "turn by turn, etas etc can
 * be on a diff page"). Top to bottom: where the team is, the pace, who is
 * running and who is next; the course's figures and its profile; then every
 * town, turn, checkpoint and shift hand-off in course order with the time
 * the team gets there — each leg at its runner's target pace. A row is a
 * door to the map on that point.
 */

export function TurnsView({ nowMs, slug, courseUrl, members, initial }: { nowMs: number; slug: string; courseUrl: string; members: MemberLite[]; initial: LiveData }) {
  const { course, failed } = useCourse(courseUrl);
  const { data, now } = useLive(slug, initial, nowMs);
  const { lead, startMs, progress, eta } = useClock(course, data, members, now);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m] as const)), [members]);
  const nameOf = (id: string | null) => (id ? byId.get(id)?.name : undefined) ?? "Nobody down";

  const at = progress.atCm;
  const legNow = at !== null ? data.legs.find((l) => l.startCm <= at && at < l.endCm) ?? null : null;
  const legNext = at !== null ? data.legs.find((l) => l.startCm > at) ?? null : data.legs[0] ?? null;

  const rows = useMemo(() => {
    if (!course) return [];
    const out: { key: string; kind: "place" | "turn" | "cp" | "ho"; m: number; text: string; sub: string | null }[] = [];
    for (const p of course.places) out.push({ key: `p${p.m}`, kind: "place", m: p.m, text: p.name, sub: [p.note, p.services].filter(Boolean).join(" · ") || null });
    for (const t of course.turns) out.push({ key: `t${t.m}`, kind: "turn", m: t.m, text: t.name, sub: null });
    course.checkpoints.forEach((c, i) => out.push({ key: `c${i}`, kind: "cp", m: c.m, text: `Checkpoint ${i + 1}: ${c.name}`, sub: c.note }));
    handoffsOf(data.legs, (id) => (id ? byId.get(id)?.squad ?? 0 : 0)).forEach((h, i) =>
      out.push({ key: `h${h.cm}`, kind: "ho", m: (h.cm / 100) * MI, text: `Hand-off ${i + 1}: shift ${h.fromSquad} to shift ${h.toSquad}`, sub: `${first(nameOf(h.fromId))} hands to ${first(nameOf(h.toId))}` }),
    );
    return out.sort((a, b) => a.m - b.m || (a.kind === "place" ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, data.legs, byId]);

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

  return (
    <>
      <section className="rt-top">
        <div className="wrap">
          <div className="tsp-now">
            <div>
              <div className="k">The team</div>
              <div className="v">{lead ? `Mile ${miles(lead.snap.m)}` : startMs && startMs > now ? `Starts ${clockText(startMs, now)}` : "No one sharing yet"}</div>
              <small>{lead ? `${lead.p.kind === "runner" ? "runner" : "van"} · ${lead.p.name} · ${agoText(lead.p.at, now)}` : "the dot appears when someone shares as RUNNING or VAN"}</small>
            </div>
            <div>
              <div className="k">Pace</div>
              <div className="v">{paceText(progress.paceSec)}/mi</div>
              <small>{progress.source === "moving" ? "so far, from the start and where we are" : "the team's planned pace; legs use each runner's own"}</small>
            </div>
            <div>
              <div className="k">{legNow ? "Running now" : "Next up"}</div>
              <div className="v">{legNow ? nameOf(legNow.memberId) : legNext ? nameOf(legNext.memberId) : "No plan yet"}</div>
              <small>
                {legNow
                  ? `mi ${miText(legNow.startCm)}–${miText(legNow.endCm)}${legNext ? ` · then ${nameOf(legNext.memberId)} at mi ${miText(legNext.startCm)}` : ""}`
                  : legNext
                    ? `mi ${miText(legNext.startCm)}–${miText(legNext.endCm)}`
                    : "set it on the PLAN page"}
              </small>
            </div>
          </div>
        </div>
      </section>

      {!course && (
        <section className="rt-sec">
          <div className="wrap">
            <p className="tm-note">{failed ? "The course file did not load — refresh to try again." : "Loading the course…"}</p>
          </div>
        </section>
      )}

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
                const passed = at !== null && r.m < (at / 100) * MI;
                return (
                  <li className={`rt-row${r.kind === "place" ? " start" : ""}${r.kind === "cp" || r.kind === "ho" ? " restart" : ""}${passed ? " passed" : ""}`} key={r.key}>
                    <a href={`${teamPath(slug, "")}?at=${Math.round(r.m)}`}>
                      <span className="mi">{miles(r.m)}</span>
                      <span className="tx">
                        {r.text}
                        {r.sub && <small>{r.sub}</small>}
                      </span>
                      {t !== null && !passed && <span className="eta">{clockText(t, now)}</span>}
                    </a>
                  </li>
                );
              })}
            </ol>
            {finishEta !== null && (
              <div className="rt-finish">
                <div className="k">Expected finish</div>
                <div className="n">{clockText(finishEta, now)}</div>
                <div className="s">
                  {inText(finishEta, now)} · {progress.source === "moving" ? "the target paces, adjusted for how the race has gone so far" : "every leg at its runner's target pace"} · {feet(climbBetween(course, lead?.snap.m ?? 0, course.length_m).up)} ft of climbing left
                </div>
              </div>
            )}
            {finishEta === null && <p className="tm-note">Set a start time on the team page and every row gets a clock time.</p>}
          </div>
        </section>
      )}
    </>
  );
}
