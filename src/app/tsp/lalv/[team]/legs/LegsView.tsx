"use client";

import { useCallback, useMemo, useState } from "react";
import { teamPath, tspApi } from "@/lib/tsp/paths";
import { checkLegs, clockText, durText, etaPlan, handoffs as handoffsOf, inText, miText, moveEdge, overlay, paceText, planClock, progressOf, rotation, shiftPlan, sortLegs, type Leg } from "@/lib/tsp/legs";
import type { PositionView } from "@/lib/tsp/positions";
import { MI, climbBetween, dirtBetween, feet, pointAt, snapToCourse } from "../../course";
import { NOBODY_COLOR, colorsOf, first, useCourse, type MemberLite } from "../live";

/**
 * LEGS — who runs what (owner, 2026-11-16; lib/tsp/legs.ts has his words).
 *
 * READING. Pick a runner (it opens on you) and the page is their race: how
 * many legs, the miles, the climb, when the next one starts; then each leg
 * as a card — miles, length, up and down, how much is dirt, the turns inside
 * it, roughly how long it takes and when it starts ("in 1 h 20 min · 3:40
 * AM"), and a door to the map zoomed to it. EVERYONE shows the whole plan in
 * course order.
 *
 * EDITING (anyone on the team — the plan changes in the van). Two tools:
 *   THE ROTATION fills a stretch in one go: from mile, to mile, the leg
 *     length, the runners in order. It lays over whatever was there.
 *   EVERY LEG then has − / + on both ends, a tenth or a half mile at a tap
 *     (his "drag the dot from 36 to halfway to 37"): the handoff moves and
 *     the neighbour that shared it moves with it; a runner select; split in
 *     two; remove.
 * Nothing is saved until SAVE THE PLAN; the whole plan goes up at once.
 *
 * It is the PLAN. The times hang off where the team really is (the phone
 * sharing as RUNNING, else the van furthest along), so an audible moves the
 * clock without anyone retyping it.
 *
 * SHIFTS AND HAND-OFFS (owner, 2026-11-16: "make a test team w/ 8 runners
 * and target paces and allow me to see the route assigned to each runner and
 * where we might put hand off points between shifts"). A runner's SHIFT and
 * TARGET PACE are set on the team page. The rotation takes a shift length:
 * the shifts then take turns in blocks of that many miles, each rotating its
 * own runners. Wherever the plan passes from one shift to the next is a
 * HAND-OFF, listed with its mile, the nearest town and turn, the time the
 * team gets there, a door to the map and one to Google Maps for the van.
 * Every time on the page runs each leg at its runner's target pace.
 */

type TeamClock = { startAt: string | null; planPaceSec: number };

const cmM = (cm: number) => (cm / 100) * MI;

export function LegsView({
  nowMs,
  slug,
  courseUrl,
  meId,
  members,
  initialLegs,
  team,
  positions,
  initialRunner,
}: {
  /** The server's clock when it rendered (the first paint must match it). */
  nowMs: number;
  slug: string;
  courseUrl: string;
  meId: string | null;
  members: MemberLite[];
  initialLegs: Leg[];
  team: TeamClock;
  positions: PositionView[];
  initialRunner: string | null;
}) {
  const { course } = useCourse(courseUrl);
  const [legs, setLegs] = useState<Leg[]>(sortLegs(initialLegs));
  const [saved, setSaved] = useState<Leg[]>(sortLegs(initialLegs));
  const runners = useMemo(() => members.filter((m) => m.role === "runner"), [members]);
  const [who, setWho] = useState<string>(() => initialRunner ?? (meId && initialLegs.some((l) => l.memberId === meId) ? meId : ""));
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [now] = useState(nowMs);

  const lengthCm = course ? Math.floor((course.length_m / MI) * 100) : 40_000;
  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.name] as const)), [members]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m] as const)), [members]);
  const colors = useMemo(() => colorsOf(members), [members]);
  const paceOf = useCallback((id: string | null) => (id ? byId.get(id)?.paceSec ?? null : null), [byId]);
  const clock = useMemo(() => planClock(legs, paceOf, team.planPaceSec), [legs, paceOf, team.planPaceSec]);
  const dirty = JSON.stringify(legs) !== JSON.stringify(saved);

  /* Where the team is, for the clock. */
  const startMs = team.startAt ? Date.parse(team.startAt) : null;
  const progress = useMemo(() => {
    let at: { cm: number; ms: number } | null = null;
    if (course) {
      const on = positions.map((p) => ({ p, s: snapToCourse(course, p.lat, p.lon) })).filter((x) => x.s.offM < 1.5 * MI);
      const lead = on.find((x) => x.p.kind === "runner") ?? on.filter((x) => x.p.kind === "van").sort((a, b) => b.s.m - a.s.m)[0];
      if (lead) at = { cm: Math.round((lead.s.m / MI) * 100), ms: Date.parse(lead.p.at) };
    }
    return progressOf({ startMs, planPaceSec: team.planPaceSec, atCm: at?.cm ?? null, atMs: at?.ms ?? null });
  }, [course, positions, startMs, team.planPaceSec]);

  const stat = useCallback(
    (l: Leg) => {
      const lenCm = l.endCm - l.startCm;
      const c = course ? climbBetween(course, cmM(l.startCm), cmM(l.endCm)) : { up: 0, down: 0 };
      const dirt = course ? dirtBetween(course, cmM(l.startCm), cmM(l.endCm)) : 0;
      const turns = course ? course.turns.filter((t) => t.m >= cmM(l.startCm) && t.m < cmM(l.endCm)) : [];
      const from = course ? [...course.places].reverse().find((p) => p.m <= cmM(l.startCm) + 400) : undefined;
      const pace = paceOf(l.memberId) ?? team.planPaceSec;
      return { lenCm, up: c.up, down: c.down, dirt, turns, near: from?.name ?? null, start: etaPlan(clock, progress, startMs, l.startCm), done: progress.atCm !== null && l.endCm <= progress.atCm, sec: (lenCm / 100) * pace, pace };
    },
    [course, progress, startMs, clock, paceOf, team.planPaceSec],
  );

  /* The shifts, and where one hands to the next. */
  const squads = useMemo(() => {
    const m = new Map<number, MemberLite[]>();
    for (const r of members) if (r.squad > 0) m.set(r.squad, [...(m.get(r.squad) ?? []), r]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [members]);
  const handoffList = useMemo(() => {
    return handoffsOf(legs, (id) => (id ? byId.get(id)?.squad ?? 0 : 0)).map((h, i) => {
      const m = (h.cm / 100) * MI;
      const near = course ? [...course.places].reverse().find((p) => p.m <= m + 400) : undefined;
      let turn: { name: string; d: number } | null = null;
      if (course) for (const t of course.turns) if (!turn || Math.abs(t.m - m) < Math.abs(turn.d)) turn = { name: t.street ?? t.name, d: t.m - m };
      const pt = course ? pointAt(course, m) : null;
      return { ...h, n: i + 1, m, near: near?.name ?? null, turn, pt, when: etaPlan(clock, progress, startMs, h.cm) };
    });
  }, [legs, byId, course, clock, progress, startMs]);

  const shown = useMemo(() => legs.map((l, i) => ({ l, i })).filter(({ l }) => !who || l.memberId === who), [legs, who]);
  const totals = useMemo(() => {
    let cm = 0;
    let up = 0;
    let down = 0;
    let leftCm = 0;
    let next: number | null = null;
    for (const { l } of shown) {
      const s = stat(l);
      cm += s.lenCm;
      up += s.up;
      down += s.down;
      if (!s.done) {
        leftCm += s.lenCm;
        if (next === null && s.start !== null) next = s.start;
      }
    }
    return { cm, up, down, leftCm, next };
  }, [shown, stat]);

  /* Per-runner miles, for the EVERYONE view and the rotation's sanity check. */
  const perRunner = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of legs) if (l.memberId) m.set(l.memberId, (m.get(l.memberId) ?? 0) + (l.endCm - l.startCm));
    return m;
  }, [legs]);
  const coveredCm = legs.reduce((s, l) => s + (l.endCm - l.startCm), 0);

  /* ─── Editing ──────────────────────────────────────────────────────────── */

  const [rotFrom, setRotFrom] = useState("0");
  const [rotTo, setRotTo] = useState("");
  const [rotLen, setRotLen] = useState("1");
  const [rotShift, setRotShift] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const toCm = (text: string): number | null => {
    const n = Number(text);
    return text.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };

  function applyRotation() {
    const from = toCm(rotFrom);
    const to = rotTo.trim() === "" ? lengthCm : toCm(rotTo);
    const len = toCm(rotLen);
    if (from === null || to === null || len === null || len < 10) return setMsg("The rotation needs a from mile, a to mile and a leg length of at least 0.1.");
    if (to <= from) return setMsg("The rotation ends after it starts.");
    const shift = rotShift.trim() === "" ? null : toCm(rotShift);
    let fresh: Leg[];
    if (shift !== null) {
      if (shift < len) return setMsg("A shift is at least one leg long.");
      // The shifts in number order; inside one, the order tapped, else the roster's.
      const pool = order.length > 0 ? order.map((id) => byId.get(id)).filter((m): m is MemberLite => !!m) : runners;
      const groups = squads.map(([n]) => pool.filter((m) => m.squad === n).map((m) => m.id)).filter((g) => g.length > 0);
      if (groups.length < 2) return setMsg("Put the runners on at least two shifts first (the team page), or leave the shift length empty.");
      fresh = shiftPlan({ fromCm: from, toCm: Math.min(to, lengthCm), legCm: len, shiftCm: shift, squads: groups });
    } else {
      if (order.length === 0) return setMsg("Tap the runners in the order they run.");
      fresh = rotation({ fromCm: from, toCm: Math.min(to, lengthCm), legCm: len, order });
    }
    const next = overlay(legs, fresh);
    const problem = checkLegs(next, lengthCm);
    if (problem) return setMsg(problem);
    setLegs(next);
    setMsg(`${fresh.length} legs laid from mile ${miText(from)} to ${miText(Math.min(to, lengthCm))}. Not saved yet.`);
  }

  const nudge = (i: number, edge: "start" | "end", by: number) => setLegs((cur) => moveEdge(cur, i, edge, cur[i][edge === "start" ? "startCm" : "endCm"] + by, lengthCm));
  const setRunnerOf = (i: number, memberId: string) => setLegs((cur) => cur.map((l, k) => (k === i ? { ...l, memberId: memberId || null } : l)));
  const removeLeg = (i: number) => setLegs((cur) => cur.filter((_, k) => k !== i));
  const splitLeg = (i: number) =>
    setLegs((cur) => {
      const l = cur[i];
      const mid = Math.round((l.startCm + l.endCm) / 20) * 10;
      if (mid <= l.startCm || mid >= l.endCm) return cur;
      return sortLegs([...cur.slice(0, i), { ...l, endCm: mid }, { ...l, startCm: mid }, ...cur.slice(i + 1)]);
    });
  function addLeg() {
    const last = legs[legs.length - 1];
    const start = last ? last.endCm : 0;
    if (start >= lengthCm) return setMsg("The plan already reaches the finish.");
    setLegs(sortLegs([...legs, { startCm: start, endCm: Math.min(lengthCm, start + 100), memberId: null }]));
  }

  async function save() {
    if (busy) return;
    const problem = checkLegs(legs, lengthCm);
    if (problem) return setMsg(problem);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(tspApi(slug, "/legs"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legs }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; legs?: Leg[] };
      if (!res.ok || !j.ok || !j.legs) throw new Error(j.error || "Could not save — try again.");
      setLegs(j.legs);
      setSaved(j.legs);
      setMsg("Saved. Everyone sees it on their next refresh.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save — try again.");
    }
    setBusy(false);
  }

  const whoName = who ? nameOf.get(who) ?? "Runner" : "Everyone";

  return (
    <>
      <div className="tsp-who">
        <label className="tsp-k" htmlFor="tsp-legs-who">
          Whose legs
        </label>
        <select id="tsp-legs-who" className="tsp-in" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone — the whole plan</option>
          {runners.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.id === meId ? " (me)" : ""}
            </option>
          ))}
        </select>
        {meId && (
          <button type="button" className={`rt-chip${editing ? " on" : ""}`} onClick={() => setEditing((v) => !v)}>
            {editing ? "Done editing" : "Edit the plan"}
          </button>
        )}
      </div>

      <div className="xp-sum tsp-legsum" aria-label={`${whoName}: totals`}>
        <div className="c">
          <div className="k">{who ? "Legs" : "Planned"}</div>
          <div className="v">{who ? shown.length : `${miText(coveredCm)} mi`}</div>
          {!who && course && <small>of {miText(lengthCm)} · {legs.length} legs</small>}
        </div>
        <div className="c">
          <div className="k">{who ? "Miles" : "Unassigned"}</div>
          <div className="v">{who ? miText(totals.cm) : `${miText(Math.max(0, lengthCm - coveredCm))} mi`}</div>
          {who && totals.leftCm !== totals.cm && <small>{miText(totals.leftCm)} still to run</small>}
        </div>
        <div className="c per">
          <div className="k">{who ? "Climb" : "Climb in the plan"}</div>
          <div className="v">{course ? `${feet(totals.up)} ft` : "…"}</div>
          <small>{course ? `${feet(totals.down)} ft down` : ""}</small>
        </div>
      </div>
      {who && totals.next !== null && (
        <p className="tsp-next mono">
          NEXT LEG STARTS <b>{inText(totals.next, now).toUpperCase()}</b> · ABOUT {clockText(totals.next, now)} · {progress.source === "moving" ? "TARGET PACES, ADJUSTED FOR THE RACE SO FAR" : "AT THE TARGET PACES"}
        </p>
      )}
      {!who && runners.length > 0 && legs.length > 0 && (
        <p className="tsp-next mono">
          {runners.map((r) => `${first(r.name).toUpperCase()} ${((perRunner.get(r.id) ?? 0) / 100).toFixed(1)}`).join(" · ")}
        </p>
      )}

      {!who && !editing && squads.length > 0 && (
        <>
          <h3 className="tsp-sub">Shifts</h3>
          <div className="tsp-squads">
            {squads.map(([n, list]) => (
              <div key={n}>
                <b>SHIFT {n}</b>
                {list.map((m) => (
                  <div key={m.id}>
                    <i className="sw" style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", marginRight: 7, background: colors.get(m.id) ?? NOBODY_COLOR }} />
                    {first(m.name)}
                    {m.paceSec ? ` · ${paceText(m.paceSec)}/mi` : ""}
                    {m.placeholder ? " · not joined yet" : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <h3 className="tsp-sub">Hand-offs between shifts</h3>
          {handoffList.length === 0 ? (
            <p className="tm-note">None yet. Lay a rotation with a shift length (Edit the plan) and every change of shift shows here and on the map.</p>
          ) : (
            <ol className="tsp-hos">
              {handoffList.map((h) => (
                <li key={h.cm}>
                  <span className="n">H{h.n}</span>
                  <span className="t">
                    Mile {miText(h.cm)} · shift {h.fromSquad} to shift {h.toSquad}
                    <small>
                      {first(nameOf.get(h.fromId ?? "") ?? "?")} hands to {first(nameOf.get(h.toId ?? "") ?? "?")}
                      {h.near ? ` · after ${h.near}` : ""}
                      {h.turn ? ` · ${Math.abs(h.turn.d) < 80 ? "at" : `${(Math.abs(h.turn.d) / MI).toFixed(1)} mi ${h.turn.d > 0 ? "before" : "past"}`} the turn: ${h.turn.name}` : ""}
                    </small>
                  </span>
                  <span className="w">{h.when !== null ? clockText(h.when, now) : ""}</span>
                  <span className="acts">
                    <a className="rt-mini fill" href={`${teamPath(slug, "")}?at=${Math.round(h.m)}`}>
                      On the map →
                    </a>
                    {h.pt && (
                      <a className="rt-mini" href={`https://www.google.com/maps/search/?api=1&query=${h.pt[1].toFixed(5)},${h.pt[0].toFixed(5)}`} target="_blank" rel="noreferrer">
                        Google Maps
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <h3 className="tsp-sub">Every leg</h3>
        </>
      )}

      {editing && (
        <div className="tsp-rot">
          <div className="tsp-k">The rotation — fill a stretch in one go</div>
          <div className="row">
            <label>
              <span className="tsp-k">From mile</span>
              <input className="tm-num" type="text" inputMode="decimal" value={rotFrom} onChange={(e) => setRotFrom(e.target.value)} />
            </label>
            <label>
              <span className="tsp-k">To mile</span>
              <input className="tm-num" type="text" inputMode="decimal" value={rotTo} placeholder={course ? miText(lengthCm) : "finish"} onChange={(e) => setRotTo(e.target.value)} />
            </label>
            <label>
              <span className="tsp-k">Each leg, miles</span>
              <input className="tm-num" type="text" inputMode="decimal" value={rotLen} onChange={(e) => setRotLen(e.target.value)} />
            </label>
            <label>
              <span className="tsp-k">Each shift, miles</span>
              <input className="tm-num" type="text" inputMode="decimal" value={rotShift} placeholder="no shifts" onChange={(e) => setRotShift(e.target.value)} />
            </label>
          </div>
          <p className="tm-note">With a shift length, the shifts take turns in blocks that long and each rotates its own runners; who is on which shift is set on the team page. Leave it empty for one rotation of the runners you tap.</p>
          <div className="tsp-k" style={{ marginTop: 14 }}>
            Tap the runners in running order
          </div>
          <div className="tsp-pills">
            {runners.map((r) => {
              const at = order.indexOf(r.id);
              return (
                <button type="button" key={r.id} className={`tsp-ord${at >= 0 ? " on" : ""}`} onClick={() => setOrder((o) => (o.includes(r.id) ? o.filter((x) => x !== r.id) : [...o, r.id]))}>
                  {at >= 0 && <b>{at + 1}</b>}
                  {r.name}
                  {r.squad ? ` · S${r.squad}` : ""}
                </button>
              );
            })}
            {runners.length === 0 && <span className="tm-note">Nobody has joined as a runner yet — send the invite link first.</span>}
          </div>
          <div className="tm-actions">
            <button type="button" className="tm-btn" onClick={applyRotation}>
              Lay the rotation
            </button>
            <button type="button" className="tm-btn quiet" onClick={addLeg}>
              + One leg at the end
            </button>
            {legs.length > 0 && (
              <button type="button" className="tm-btn quiet" onClick={() => window.confirm("Clear every leg? Nothing is saved until you press SAVE.") && setLegs([])}>
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {(dirty || msg) && (
        <div className="tsp-save">
          {dirty && (
            <>
              <button type="button" className="tm-btn fill" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save the plan"}
              </button>
              <button type="button" className="tm-btn quiet" disabled={busy} onClick={() => { setLegs(saved); setMsg(""); }}>
                Undo changes
              </button>
            </>
          )}
          {msg && <span className="tm-note" style={{ marginTop: 0 }}>{msg}</span>}
        </div>
      )}

      <ol className="tsp-legs">
        {shown.length === 0 && <li className="list-empty">{legs.length === 0 ? "NO PLAN YET — EDIT THE PLAN AND LAY A ROTATION." : `${whoName.toUpperCase()} IS NOT DOWN FOR ANY LEG YET.`}</li>}
        {shown.map(({ l, i }) => {
          const s = stat(l);
          const isOpen = open === i;
          return (
            <li key={`${l.startCm}-${l.endCm}`} className={`tsp-leg${s.done ? " done" : ""}${l.memberId === meId && meId ? " mine" : ""}`}>
              <div className="top">
                <div className="mi mono">
                  MI {miText(l.startCm)}–{miText(l.endCm)}
                </div>
                <div className="len">{miText(s.lenCm)} mi</div>
              </div>
              <div className="meta mono">
                {!who && (
                  <b>
                    <i className="sw" style={{ background: colors.get(l.memberId ?? "") ?? NOBODY_COLOR }} />
                    {(nameOf.get(l.memberId ?? "") ?? "NOBODY YET").toUpperCase()} ·{" "}
                  </b>
                )}
                {course ? `↑ ${feet(s.up)} FT · ↓ ${feet(s.down)} FT` : "…"}
                {s.dirt > 80 ? ` · ${(s.dirt / MI).toFixed(1)} MI DIRT` : ""}
                {` · ABOUT ${durText(s.sec).toUpperCase()} AT ${paceText(s.pace)}`}
                {s.near ? ` · AFTER ${s.near.toUpperCase()}` : ""}
              </div>
              <div className="when mono">{s.done ? "DONE" : s.start !== null ? `${inText(s.start, now).toUpperCase()} · ${clockText(s.start, now)}` : "SET A START TIME ON THE TEAM PAGE FOR CLOCK TIMES"}</div>

              {editing ? (
                <div className="edit">
                  <div className="ends">
                    {(["start", "end"] as const).map((edge) => (
                      <div className="end" key={edge}>
                        <span className="tsp-k">{edge === "start" ? "Starts" : "Ends"} · mi {miText(edge === "start" ? l.startCm : l.endCm)}</span>
                        <div className="steps">
                          {[-50, -10, 10, 50].map((by) => (
                            <button type="button" className="rt-mini" key={by} onClick={() => nudge(i, edge, by)} aria-label={`${edge} ${by > 0 ? "later" : "earlier"} by ${Math.abs(by) / 100} mile`}>
                              {by > 0 ? "+" : "−"}
                              {Math.abs(by) / 100}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ends">
                    <select className="tsp-in" value={l.memberId ?? ""} onChange={(e) => setRunnerOf(i, e.target.value)} aria-label="Who runs it">
                      <option value="">— nobody yet —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.role === "crew" ? " (crew)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="steps">
                      <button type="button" className="rt-mini" onClick={() => splitLeg(i)}>
                        Split
                      </button>
                      <button type="button" className="rt-mini" onClick={() => removeLeg(i)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="acts">
                  <a className="rt-mini fill" href={`${teamPath(slug, "")}?leg=${l.startCm}-${l.endCm}`}>
                    On the map →
                  </a>
                  <button type="button" className="rt-mini" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                    {isOpen ? "Hide turns" : `${s.turns.length} turn${s.turns.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              )}
              {isOpen && !editing && (
                <ul className="turns">
                  {s.turns.length === 0 && <li>Straight through — no turns on this leg.</li>}
                  {s.turns.map((t) => (
                    <li key={t.m}>
                      <span className="mono">{(t.m / MI).toFixed(1)}</span>
                      {t.name}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
