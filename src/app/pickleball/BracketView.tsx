"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { matchLabel, replay, type BracketState, type MatchState } from "./bracket";
import { skillLabel, teamName } from "./tournament";

/* THE BRACKET on screen, drawn like a real one (owner, 2026-11-02: "like
 * a real tourny bracket, drawn out and show winners moving on etc"):
 * columns per round in a sideways scroll, and an SVG laid over each
 * section carrying the elbow lines a bracket sheet has. The lines are
 * MEASURED off the cards after layout, so they always meet; a line whose
 * match is decided turns neon — that is the winner moving on — and every
 * line draws itself in. Loser drops are not drawn (a real sheet labels
 * them too: "Loser of Winners R2 · 1", in the empty slot).
 *
 * A match both teams stand in pulses — TAP TO SCORE — and the score
 * sheet slides up; anyone with the link reports, one game to 11, and a
 * played match can be fixed the same way (replay drops whatever a fix
 * invalidates downstream). */

export type TeamRow = {
  id: string;
  player1: string;
  player2: string;
  skill: string;
  seed: number | null;
  withdrawn: boolean;
};

export type ResultRow = {
  matchKey: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  reportedBy: string;
};

type Edge = { d: string; hot: boolean; delay: number };

/* One section of the sheet (winners + the grand final, or losers): the
 * columns, and the measured overlay. */
function Tree({
  cols,
  card,
  size,
}: {
  cols: { title: string; matches: MatchState[] }[];
  card: (m: MatchState, i: number) => JSX.Element;
  size: { w: number; h: number; edges: Edge[] } | null;
}) {
  return (
    <div className="pb-tree">
      {size ? (
        <svg className="pb-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
          {size.edges.map((e, i) => (
            <path
              key={i}
              d={e.d}
              pathLength={1}
              stroke={e.hot ? "#DFFF3F" : "rgba(244,247,242,.28)"}
              strokeWidth={e.hot ? 3 : 2}
              style={{ animationDelay: `${e.delay}ms` }}
            />
          ))}
        </svg>
      ) : null}
      {cols.map((c, ci) => (
        <div className="pb-col" key={c.title + ci}>
          {c.matches.map((m, mi) => card(m, ci * 8 + mi))}
        </div>
      ))}
    </div>
  );
}

/* The elbow lines for every winner-advancement edge whose two cards both
 * sit inside `root`. */
function measureEdges(root: HTMLElement, matches: MatchState[]): Edge[] {
  const base = root.getBoundingClientRect();
  const rectOf = (key: string): DOMRect | null => {
    const el = root.querySelector(`[data-mk="${CSS.escape(key)}"]`);
    return el ? el.getBoundingClientRect() : null;
  };
  const winnerOf = new Map(matches.map((m) => [m.key, m.winner]));
  const edges: Edge[] = [];
  for (const m of matches) {
    const dst = rectOf(m.key);
    if (!dst) continue;
    for (const feed of [m.aWinnerOf, m.bWinnerOf]) {
      if (!feed) continue;
      const src = rectOf(feed);
      if (!src) continue;
      const x1 = src.right - base.left;
      const y1 = src.top - base.top + src.height / 2;
      const x2 = dst.left - base.left;
      const y2 = dst.top - base.top + dst.height / 2;
      const mid = Math.round((x1 + x2) / 2);
      edges.push({
        d: `M ${Math.round(x1)} ${Math.round(y1)} H ${mid} V ${Math.round(y2)} H ${Math.round(x2)}`,
        hot: !!winnerOf.get(feed),
        delay: Math.round(x1),
      });
    }
  }
  return edges;
}

function useTreeEdges(matches: MatchState[]): [React.RefObject<HTMLDivElement>, { w: number; h: number; edges: Edge[] } | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; edges: Edge[] } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () =>
      setSize({ w: el.scrollWidth, h: el.offsetHeight, edges: measureEdges(el, matches) });
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [matches]);
  return [ref, size];
}

export function Bracket({ teams, results }: { teams: TeamRow[]; results: ResultRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<MatchState | null>(null);
  const [fresh, setFresh] = useState("");

  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const state: BracketState = useMemo(() => {
    const seeded = teams
      .filter((t) => !t.withdrawn && t.seed !== null)
      .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
      .map((t) => t.id);
    return replay(seeded, results);
  }, [teams, results]);

  const winnersMatches = useMemo(() => [...state.winners.flat(), state.final], [state]);
  const losersMatches = useMemo(() => state.losers.flat(), [state]);
  const [wRef, wSize] = useTreeEdges(winnersMatches);
  const [lRef, lSize] = useTreeEdges(losersMatches);

  const nameOf = (id: string | null): string => {
    if (!id) return "";
    const t = byId.get(id);
    return t ? `${t.player1.split(" ")[0]} & ${t.player2.split(" ")[0]}` : "?";
  };
  const fullName = (id: string | null): string => {
    if (!id) return "";
    const t = byId.get(id);
    return t ? teamName(t.player1, t.player2) : "?";
  };

  const champion = state.champion ? fullName(state.champion) : null;

  const card = (m: MatchState, i: number) => {
    const open = m.ready || (m.winner !== null && !m.bye);
    return (
      <div
        key={m.key}
        data-mk={m.key}
        className={`pb-m${m.ready ? " ready" : ""}${m.winner && !m.bye ? " played" : ""}${m.key === fresh ? " fresh" : ""}`}
        style={{ "--i": i } as React.CSSProperties}
        role={open ? "button" : undefined}
        tabIndex={open ? 0 : undefined}
        onClick={open ? () => setSel(m) : undefined}
        onKeyDown={open ? (e) => (e.key === "Enter" || e.key === " ") && setSel(m) : undefined}
      >
        <div className="ml">
          <span>{matchLabel(m)}</span>
          {m.ready ? <em>Tap to score</em> : m.bye ? <span>Bye</span> : null}
        </div>
        <div className={`t${m.winner && m.winner === m.a ? " win" : ""}${m.a ? "" : " dim"}`}>
          <span className="nm">{m.a ? nameOf(m.a) : m.aFrom}</span>
          {m.scoreA !== null ? <span className="sc">{m.scoreA}</span> : null}
        </div>
        <div className={`t${m.winner && m.winner === m.b ? " win" : ""}${m.b ? "" : " dim"}`}>
          <span className="nm">{m.b ? nameOf(m.b) : m.bFrom}</span>
          {m.scoreB !== null ? <span className="sc">{m.scoreB}</span> : null}
        </div>
        {m.winner !== null && !m.bye ? <span className="fix">Fix</span> : null}
      </div>
    );
  };

  return (
    <div>
      {champion ? (
        <div className="pb-champ">
          <span className="sheen" aria-hidden />
          <div className="k">Champions</div>
          <div className="v">{champion}</div>
        </div>
      ) : null}

      <p className="pb-sub">Winners bracket</p>
      <div className="pb-scroll">
        <div ref={wRef}>
          <Tree
            cols={[
              ...state.winners.map((round, r) => ({ title: `W${r + 1}`, matches: round })),
              { title: "GF", matches: [state.final] },
            ]}
            card={card}
            size={wSize}
          />
        </div>
      </div>

      {state.losers.length ? (
        <>
          <p className="pb-sub">Losers bracket — nobody is out until they’ve lost twice</p>
          <div className="pb-scroll">
            <div ref={lRef}>
              <Tree cols={state.losers.map((round, d) => ({ title: `L${d + 1}`, matches: round }))} card={card} size={lSize} />
            </div>
          </div>
        </>
      ) : null}

      <p className="pb-hint">
        {state.played} of {state.total} matches played · one game to 11 · anyone at the court can tap a match and put the score in.
      </p>

      {sel ? (
        <ScoreSheet
          match={sel}
          aName={fullName(sel.a)}
          bName={fullName(sel.b)}
          onClose={() => setSel(null)}
          onSaved={(key) => {
            setSel(null);
            setFresh(key);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ScoreSheet({
  match,
  aName,
  bName,
  onClose,
  onSaved,
}: {
  match: MatchState;
  aName: string;
  bName: string;
  onClose: () => void;
  onSaved: (key: string) => void;
}) {
  const [scoreA, setScoreA] = useState(match.scoreA !== null ? String(match.scoreA) : "");
  const [scoreB, setScoreB] = useState(match.scoreB !== null ? String(match.scoreB) : "");
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/pickleball/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchKey: match.key, scoreA: scoreA.trim(), scoreB: scoreB.trim(), reportedBy: by.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Couldn’t save that score — try again.");
      onSaved(match.key);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save that score — try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="pb-dim" onClick={onClose} />
      <div className="pb-sheet" role="dialog" aria-label="Report the score">
        <h3>{match.winner ? "Fix the score" : "Report the score"}</h3>
        <p className="mk">{matchLabel(match)} · one game to 11</p>
        <div className="row">
          <span className="nm">{aName}</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={scoreA} onChange={(e) => setScoreA(e.target.value)} aria-label={`${aName} score`} />
        </div>
        <div className="row">
          <span className="nm">{bName}</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={scoreB} onChange={(e) => setScoreB(e.target.value)} aria-label={`${bName} score`} />
        </div>
        <label className="fl" htmlFor="pb-by">
          Who’s reporting? <span style={{ opacity: 0.6 }}>(optional)</span>
        </label>
        <input id="pb-by" className="by" type="text" maxLength={40} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" />
        {err ? <p className="pb-err">{err}</p> : null}
        <div className="btns">
          <button type="button" onClick={onClose}>
            Never mind
          </button>
          <button type="button" className="primary" disabled={busy || scoreA.trim() === "" || scoreB.trim() === ""} onClick={() => void save()}>
            {busy ? "Saving…" : "Save the score"}
          </button>
        </div>
      </div>
    </>
  );
}

/* THE OWNER PANEL (admin only — the page gates it): seed numbers by hand
 * with each team's self-rated level beside the name as the hint, REMOVE
 * a team outright (owner, 2026-11-02: "let me remove teams"), then LOCK
 * — signups close and the bracket draws. UNLOCK reopens it; the scores
 * already in stay. */
export function AdminPanel({ teams, locked }: { teams: TeamRow[]; locked: boolean }) {
  const router = useRouter();
  const [seeds, setSeeds] = useState<Record<string, string>>(() =>
    Object.fromEntries(teams.map((t) => [t.id, t.seed !== null ? String(t.seed) : ""])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const post = async (body: Record<string, unknown>, after?: string) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/pickleball/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "That didn’t take — try again.");
      setMsg(after ?? "Saved");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That didn’t take — try again.");
    }
    setBusy(false);
  };

  const saveSeeds = () =>
    post(
      {
        action: "seeds",
        seeds: teams
          .filter((t) => !t.withdrawn)
          .map((t) => ({ teamId: t.id, seed: seeds[t.id]?.trim() ? Number(seeds[t.id]) : null })),
      },
      "Seeds saved",
    );

  return (
    <div className="pb-admin">
      <p className="ah">The owner’s panel — only you see this</p>
      {!locked ? (
        <>
          {teams.map((t) => (
            <div className="srow" key={t.id}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={seeds[t.id] ?? ""}
                onChange={(e) => setSeeds((s) => ({ ...s, [t.id]: e.target.value }))}
                aria-label={`Seed for ${teamName(t.player1, t.player2)}`}
              />
              <span className="who">{teamName(t.player1, t.player2)}</span>
              {t.skill ? <span className="sk">{skillLabel(t.skill)}</span> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${teamName(t.player1, t.player2)}? This deletes their signup.`))
                    void post({ action: "remove", teamId: t.id }, "Removed");
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="abtns">
            <button type="button" disabled={busy} onClick={() => void saveSeeds()}>
              Save seeds
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy || teams.filter((t) => !t.withdrawn).length < 2}
              onClick={() => {
                if (window.confirm("Lock the bracket? Signups close and the draw goes up.")) void post({ action: "lock" }, "Locked — the bracket is up");
              }}
            >
              Lock the bracket
            </button>
          </div>
          <p className="pb-hint">Seed 1 is the strongest. Unseeded teams fall in behind the seeded ones in signup order when you lock.</p>
        </>
      ) : (
        <div className="abtns">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Unlock? Signups reopen; the scores already reported stay.")) void post({ action: "unlock" }, "Unlocked — signups are open again");
            }}
          >
            Unlock the bracket
          </button>
        </div>
      )}
      <p className="pb-stk-msg">{msg}</p>
    </div>
  );
}
