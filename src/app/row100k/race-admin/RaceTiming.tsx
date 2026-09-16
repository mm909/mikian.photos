"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import type { RaceDef } from "../raceday";
import type { Racer } from "../racedayData";
import {
  brLetter,
  fmtClock,
  fmtElapsed,
  fmtTime,
  type ResultBoard,
  type ResultRacer,
  type ResultWave,
} from "../raceresults/types";

/* THE TIMING CONSOLE (owner, 2026-09-16: "Review how racers submit times
 * during race day"). The night, lane by lane: one card per wave with START
 * WAVE on it — the stamp the elapsed clock on the wall runs off — and a
 * time box, SAVE and DNF on every lane. POST THE SHEET at the top turns the
 * board from mid-race to the sheet with the podiums filled, and shuts the
 * door racers post their own times through.
 *
 * IT IS FED THE BOARD, not the raw rows: resultBoard() (raceResults.ts)
 * already knows the wave states, the lanes and every status, and every
 * write comes back with the fresh board, so what is on the screen is what
 * the wall is showing. The raw racers ride along for the one thing the
 * board does not carry — who put a time in, the rower or the owner — and
 * for the racers with no wave, who cannot be timed until they have one.
 *
 * Every write is one POST to /api/row100k/raceday/results, which
 * re-authenticates; nothing here is trusted. After each one the router is
 * refreshed too, so the door list and the wave console above — server
 * blocks reading the same rows — agree with this. */

const RESULTS_PATH = "/row100k/raceday/results";

type Board = { ok?: boolean; error?: string; board?: ResultBoard };
type Wrote = { board: ResultBoard } | { error: string };

const stateWord = (w: ResultWave, nowMs: number): string => {
  if (w.state === "rowed") return "ROWED";
  if (w.state === "on_the_ergs") {
    const el = fmtElapsed(w.startedAtMs, nowMs);
    return el ? `ON THE ERGS · ${el}` : "ON THE ERGS";
  }
  return "TO COME";
};

const resultWord = (r: ResultRacer): string => {
  if (r.status === "finished" && r.seconds !== null) return fmtTime(r.seconds);
  if (r.status === "dnf") return "DNF";
  if (r.status === "rowing") return "ROWING";
  return "—";
};

export function RaceTiming({ race, racers, board: initial }: { race: RaceDef; racers: Racer[]; board: ResultBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState<ResultBoard>(initial);
  /* THE SERVER BOARD WINS WHEN IT CHANGES (review, 2026-09-16): this used to
   * seed once and then only its own writes could move it, so a second
   * device on the console, a rower posting, or a wave changed in the panel
   * above stayed invisible until a write or a reload. router.refresh()
   * hands a fresh prop; take it. The typed texts are separate state and
   * survive it. */
  useEffect(() => {
    setBoard(initial);
  }, [initial]);
  /* What is typed in each lane box, by signup id. */
  const [texts, setTexts] = useState<Record<string, string>>({});
  /* Who a stored time came from, off the rows the page read: "self" is the
   * rower, anything else the owner. `here` is the lanes THIS console wrote,
   * so the stamp can say so once the refresh lands the owner's email. */
  const by = useMemo(
    () => Object.fromEntries(racers.filter((r) => r.resultBy).map((r) => [r.id, r.resultBy])) as Record<string, string>,
    [racers],
  );
  const [here, setHere] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [ok, setOk] = useState<string | null>(null);
  /* POST THE SHEET waits on a second press. */
  const [confirm, setConfirm] = useState(false);

  const final = board.state === "finished";
  const timesIn = board.racers.filter((r) => r.status === "finished").length;
  const dnfs = board.racers.filter((r) => r.status === "dnf").length;
  /* Live racers with no wave are not on the board and cannot be timed. */
  const unwaved = racers.filter((r) => r.role === "racer" && !r.withdrewAt && r.wave === null);

  /* One write. Hands back the fresh board or the refusal; the caller
   * decides where the refusal prints (review, 2026-09-16: a lane's used to
   * land at the foot of the console, screens away from the box). */
  const post = async (body: Record<string, unknown>, key: string): Promise<Wrote> => {
    setBusy(key);
    setError(null);
    setOk(null);
    let out: Wrote = { error: "Couldn't save that — try again." };
    try {
      const res = await fetch("/api/row100k/raceday/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: race.slug, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as Board;
      if (res.ok && data.ok && data.board) {
        setBoard(data.board);
        /* The door list and the wave console are server blocks on this
         * page reading the same rows; they cannot know. */
        router.refresh();
        out = { board: data.board };
      } else if (data.error) out = { error: data.error };
    } catch {
      /* the fallback line stands */
    }
    setBusy(null);
    return out;
  };

  /* ---------------------------------------------------------- the sheet */

  const setSheet = async (on: boolean) => {
    const w = await post({ action: "final", on }, "final");
    setConfirm(false);
    if ("error" in w) setError(w.error);
    else setOk(on ? `THE SHEET IS POSTED · ${fmtClock(w.board.updatedAtMs)}` : "THE SHEET IS OPEN AGAIN — RACERS CAN POST");
  };

  /* ----------------------------------------------------------- a wave */

  const stampWave = async (w: ResultWave, started: boolean) => {
    const out = await post({ action: "wave", wave: w.wave, started }, `wave-${w.wave}`);
    if ("error" in out) return setError(out.error);
    /* The stamp off the board, not the clock: a START on a wave another
     * device already sent keeps the earlier stamp, and says so. */
    const stamped = out.board.waves.find((x) => x.wave === w.wave)?.startedAtMs ?? out.board.nowMs;
    setOk(started ? `WAVE ${w.wave} STARTED · ${fmtClock(stamped)}` : `WAVE ${w.wave} START UNDONE`);
  };

  /* ----------------------------------------------------------- a lane */

  const setLane = async (r: ResultRacer, body: Record<string, unknown>, said: string) => {
    setRowErr((all) => ({ ...all, [r.id]: "" }));
    const w = await post({ action: "set", id: r.id, ...body }, r.id);
    if ("error" in w) {
      /* The refusal belongs under the box it came from. */
      setRowErr((all) => ({ ...all, [r.id]: w.error }));
      return;
    }
    setHere((all) => ({ ...all, [r.id]: true }));
    setTexts((all) => ({ ...all, [r.id]: "" }));
    setOk(`${r.name.toUpperCase()} · ${said}`);
  };

  const saveTime = (r: ResultRacer) => {
    const text = (texts[r.id] ?? "").trim();
    if (text === "") return;
    void setLane(r, { time: text }, `${text} SAVED`);
  };

  /* A rower's post outranks the memory of a write here: the owner can
   * clear a time from this console and the rower may then post again. */
  const byWord = (id: string): string | null => {
    const who = by[id];
    if (who === "self") return "POSTED BY THE ROWER";
    if (here[id]) return "TYPED HERE";
    if (!who) return null;
    return "TYPED BY THE OWNER";
  };

  return (
    <div>
      <div className="sec-head ra-sec">
        <h2>Timing</h2>
        <span className="mono">THE NIGHT, LANE BY LANE</span>
      </div>
      <p className="ra-note">
        Racers can post their own time from the race day page until the sheet is posted; anything you type here
        overrides it, and a rower cannot post over a time or a DNF you typed. Type 18:52.3, or 1852.3 off a number
        pad.
      </p>

      <div className="ra-act">
        {final ? (
          <button type="button" className="outline-btn" disabled={busy !== null} onClick={() => void setSheet(false)}>
            {busy === "final" ? "…" : "Reopen the sheet"}
          </button>
        ) : confirm ? (
          <>
            <button type="button" className="send" disabled={busy !== null} onClick={() => void setSheet(true)}>
              {busy === "final" ? "…" : "Sure?"}
            </button>
            <button type="button" className="outline-btn" disabled={busy !== null} onClick={() => setConfirm(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="send" disabled={busy !== null} onClick={() => setConfirm(true)}>
            Post the sheet
          </button>
        )}
        <a className="outline-btn" href={RESULTS_PATH}>
          The results page →
        </a>
        <a className="outline-btn" href={`${RESULTS_PATH}?cast=1`}>
          The wall →
        </a>
      </div>
      <p className="ra-note">
        {final ? (
          <>
            <b>SHEET POSTED {fmtClock(board.updatedAtMs)}</b> — podiums filled, no-times and DNFs off the board
          </>
        ) : (
          <b>MID-RACE</b>
        )}{" "}
        · {timesIn} OF {board.racers.length} TIMES IN{dnfs > 0 ? ` · ${dnfs} DNF` : ""}
      </p>
      {unwaved.length > 0 && (
        <p className="ra-warn">
          {unwaved.length} {unwaved.length === 1 ? "RACER HAS" : "RACERS HAVE"} NO WAVE AND CANNOT BE TIMED — GIVE THEM
          ONE IN THE FIELD ABOVE.
        </p>
      )}

      {board.waves.length === 0 ? (
        <p className="board-empty">NO WAVES YET — THE GRID FILLS ITSELF ONCE RACERS HAVE WAVES.</p>
      ) : (
        <div className="ra-tm-grid">
          {board.waves.map((w) => {
            const members = board.racers.filter((r) => r.wave === w.wave).sort((a, b) => a.lane - b.lane);
            const live = w.state === "on_the_ergs";
            /* No START on an empty wave (R5C test, 2026-09-16): a stamp on
             * a wave with nobody in it reads ROWED at once, and a racer
             * moved into it later inherits that stale clock. UNDO stays
             * offered, so a stamp already there can still come off. */
            const canStart = w.startedAtMs !== null || members.length > 0;
            return (
              <div key={w.wave} className={`ra-wave ra-tm${live ? " live" : ""}${w.state === "rowed" ? " full" : ""}`}>
                <div className="h">
                  <span>Wave {w.wave}</span>
                  <span className="t">{fmtClock(w.scheduledAtMs)}</span>
                </div>
                <div className="ra-tm-state">
                  <span>{stateWord(w, board.nowMs)}</span>
                  <button
                    type="button"
                    className="outline-btn"
                    disabled={busy !== null || !canStart}
                    onClick={() => void stampWave(w, w.startedAtMs === null)}
                  >
                    {busy === `wave-${w.wave}` ? "…" : w.startedAtMs === null ? "Start wave" : "Undo start"}
                  </button>
                </div>
                <ul>
                  {members.length === 0 ? (
                    <li>
                      <span className="d">EMPTY</span>
                    </li>
                  ) : (
                    members.map((r) => {
                      const text = texts[r.id] ?? "";
                      const rowBusy = busy === r.id;
                      const who = byWord(r.id);
                      return (
                        <li key={r.id} className={`ra-tm-lane ${r.status}`}>
                          <div className="ra-tm-who">
                            <span className="ln">L{r.lane}</span>
                            <span className="n">{fmtRowerNumber(r.rowerNumber)}</span>
                            <span className="w">{r.name}</span>
                            <span className="d">{brLetter(r.bracket)}</span>
                            <span className="res">{resultWord(r)}</span>
                          </div>
                          <div className="ra-tm-ctl">
                            <input
                              type="text"
                              className="ra-tm-in"
                              inputMode="decimal"
                              placeholder="18:52.3"
                              aria-label={`Time for ${r.name} — 18:52.3, or 1852.3 off a number pad`}
                              value={text}
                              disabled={busy !== null}
                              onChange={(e) => setTexts((all) => ({ ...all, [r.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveTime(r);
                              }}
                            />
                            <button
                              type="button"
                              className="outline-btn"
                              disabled={busy !== null || text.trim() === ""}
                              onClick={() => saveTime(r)}
                            >
                              {rowBusy ? "…" : "Save"}
                            </button>
                            {r.status === "dnf" ? (
                              <button
                                type="button"
                                className="del-btn save"
                                disabled={busy !== null}
                                onClick={() => void setLane(r, { status: "to_come" }, "DNF UNDONE")}
                              >
                                Undo DNF
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="del-btn"
                                disabled={busy !== null}
                                onClick={() => void setLane(r, { status: "dnf" }, "DNF")}
                              >
                                DNF
                              </button>
                            )}
                            {r.status === "finished" && (
                              <button
                                type="button"
                                className="del-btn"
                                disabled={busy !== null}
                                onClick={() => void setLane(r, { time: null }, "TIME CLEARED")}
                              >
                                Clear
                              </button>
                            )}
                            {who && <span className="q">{who}</span>}
                          </div>
                          {rowErr[r.id] && <p className="form-err">{rowErr[r.id]}</p>}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {ok && <p className="ra-ok">{ok}</p>}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
