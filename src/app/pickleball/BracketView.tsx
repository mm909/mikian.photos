"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { matchLabel, replay, type MatchState } from "./bracket";
import { teamName } from "./tournament";

/* THE BRACKET on screen (owner, 2026-11-02): winners rounds as columns in
 * a sideways scroll, the losers rounds under them, the grand final, the
 * champions banner. A match both teams stand in pulses — TAP TO SCORE —
 * and the score sheet slides up from the baseline; anyone with the link
 * reports (honor system), one game to 11, and a played match can be
 * fixed the same way (replay drops anything downstream that the fix
 * invalidates). The cards stagger in and a freshly scored match flashes. */

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

export function Bracket({ teams, results }: { teams: TeamRow[]; results: ResultRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<MatchState | null>(null);
  const [fresh, setFresh] = useState("");

  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const state = useMemo(() => {
    const seeded = teams
      .filter((t) => !t.withdrawn && t.seed !== null)
      .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
      .map((t) => t.id);
    return replay(seeded, results);
  }, [teams, results]);

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

  let i = 0;
  const card = (m: MatchState, last: boolean) => {
    const open = m.ready || (m.winner !== null && !m.bye);
    return (
      <div
        key={m.key}
        className={`pb-m${m.ready ? " ready" : ""}${m.winner && !m.bye ? " played" : ""}${m.key === fresh ? " fresh" : ""}`}
        style={{ "--i": i++ } as React.CSSProperties}
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
        {!last ? <span className="pb-j" aria-hidden /> : null}
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
        <div className="pb-grid">
          {state.winners.map((round, r) => (
            <div className="pb-col" key={`w${r}`}>
              {round.map((m) => card(m, false))}
            </div>
          ))}
          <div className="pb-col" key="gf">
            {card(state.final, true)}
          </div>
        </div>
      </div>

      {state.losers.length ? (
        <>
          <p className="pb-sub">Losers bracket — nobody is out until they’ve lost twice</p>
          <div className="pb-scroll">
            <div className="pb-grid">
              {state.losers.map((round, d) => (
                <div className="pb-col" key={`l${d}`}>
                  {round.map((m) => card(m, d === state.losers.length - 1))}
                </div>
              ))}
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
 * (owner, 2026-11-02: "you seed manually"), withdraw or restore a team
 * while signups are open, then LOCK — signups close and the bracket
 * draws. UNLOCK reopens it; the scores already in stay. */
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
                disabled={t.withdrawn}
              />
              <span className="who" style={t.withdrawn ? { textDecoration: "line-through", opacity: 0.5 } : undefined}>
                {teamName(t.player1, t.player2)}
              </span>
              <button type="button" disabled={busy} onClick={() => void post({ action: t.withdrawn ? "restore" : "withdraw", teamId: t.id })}>
                {t.withdrawn ? "Restore" : "Withdraw"}
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
