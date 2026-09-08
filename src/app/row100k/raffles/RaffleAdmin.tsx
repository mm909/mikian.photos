"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { fmtPacificStamp } from "@/lib/blackoutRules";
import { fmtWindowShort, type RaffleDef, type RafflePhase } from "../raffles";
import type { Entrant, RaffleState, RaffleWinner } from "../raffleData";

/* ONE RAFFLE, for the owner (owner, 2026-09-08). The prize and the rule,
 * the hat, and the three things an admin does: DRAW THE WINNER (a second
 * step while entries are still open — an early draw leaves Friday rowers
 * out), DRAW AGAIN or CLEAR once there is one (both two-step), and the
 * LIVE / HIDDEN switch for the partner's second-chance link on the
 * partners page. Every write goes through /api/row100k/raffle and the page
 * re-renders from the database, so what is shown is what was saved. */

const PHASE_WORD: Record<RafflePhase, string> = {
  before: "NOT OPEN YET",
  open: "TAKING ENTRIES",
  closed: "CLOSED — READY TO DRAW",
};

export function RaffleAdmin({
  raffle: r,
  phase,
  state,
  entrants,
  unreadable,
  inProduction,
}: {
  raffle: RaffleDef;
  phase: RafflePhase;
  state: RaffleState;
  entrants: Entrant[];
  unreadable: boolean;
  inProduction: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /* Which two-step is waiting on its second press. */
  const [confirm, setConfirm] = useState<"early" | "again" | "clear" | null>(null);
  const [winner, setWinner] = useState<RaffleWinner | null>(state.winner);
  const [ctaLive, setCtaLive] = useState(state.ctaLive);

  const hat = entrants.filter((e) => !e.admin);
  const w = winner;

  const call = async (method: "POST" | "PATCH", body: Record<string, unknown>, done: (data: Record<string, unknown>) => void) => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/row100k/raffle", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: r.slug, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        done(data);
        router.refresh();
      } else setError(data.error ?? "Couldn't do that — try again.");
    } catch {
      setError("Couldn't do that — try again.");
    }
    setBusy(false);
    setConfirm(null);
  };

  const draw = (opts: { early?: boolean; again?: boolean }) =>
    call("POST", opts, (data) => {
      const win = data.winner as RaffleWinner | undefined;
      if (win) {
        setWinner(win);
        setOk(`DRAWN — ${win.name.toUpperCase()} · ${fmtRowerNumber(win.rowerNumber)} · FROM ${win.entrants} IN THE HAT`);
      }
    });

  const clear = () =>
    call("PATCH", { clear: true }, () => {
      setWinner(null);
      setOk("WINNER CLEARED — THE HAT IS WHOLE AGAIN");
    });

  const setLive = (live: boolean) =>
    call("PATCH", { ctaLive: live }, () => {
      setCtaLive(live);
      setOk(live ? "SECOND CHANCE IS LIVE ON THE PARTNERS PAGE" : "SECOND CHANCE HIDDEN");
    });

  /* The draw controls, by state. */
  let controls: JSX.Element;
  if (w) {
    controls = (
      <div className="act-row">
        {confirm === "again" ? (
          <>
            <button type="button" className="outline-btn" disabled={busy} onClick={() => void draw({ again: true, early: phase === "open" })}>
              {busy ? "…" : "Yes, draw again"}
            </button>
            <button type="button" className="outline-btn" disabled={busy} onClick={() => setConfirm(null)}>
              Keep {w.name}
            </button>
          </>
        ) : confirm === "clear" ? (
          <>
            <button type="button" className="outline-btn" disabled={busy} onClick={() => void clear()}>
              {busy ? "…" : "Yes, clear the winner"}
            </button>
            <button type="button" className="outline-btn" disabled={busy} onClick={() => setConfirm(null)}>
              Keep {w.name}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="outline-btn" disabled={busy || hat.length === 0} onClick={() => setConfirm("again")}>
              Draw again
            </button>
            <button type="button" className="outline-btn" disabled={busy} onClick={() => setConfirm("clear")}>
              Clear the winner
            </button>
          </>
        )}
      </div>
    );
  } else if (phase === "before") {
    controls = (
      <button type="button" className="send" disabled>
        Opens {fmtWindowShort(r)}
      </button>
    );
  } else if (phase === "open") {
    controls =
      confirm === "early" ? (
        <div className="act-row">
          <button type="button" className="outline-btn" disabled={busy || hat.length === 0} onClick={() => void draw({ early: true })}>
            {busy ? "…" : `Yes, draw now from ${hat.length}`}
          </button>
          <button type="button" className="outline-btn" disabled={busy} onClick={() => setConfirm(null)}>
            Wait for the close
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="send" disabled>
            Entries still open — {r.closesLine.replace(/^Entries close /, "closes ")}
          </button>
          <div className="act-row">
            <button type="button" className="outline-btn" disabled={busy || hat.length === 0} onClick={() => setConfirm("early")}>
              Draw early anyway
            </button>
          </div>
        </>
      );
  } else {
    controls = (
      <button type="button" className="send" disabled={busy || hat.length === 0} onClick={() => void draw({})}>
        {busy ? "…" : hat.length === 0 ? "Nobody in the hat" : `Draw the winner from ${hat.length}`}
      </button>
    );
  }

  return (
    <div className="rf-adm">
      <div className="panel">
        <div className="p-head">
          <h3>{r.title}</h3>
          <span className="mono">{w ? "DRAWN" : PHASE_WORD[phase]}</span>
        </div>
        <p className="rf-adm-note">
          {r.prize} · ${r.valueUsd} · {r.when} · {r.where} · given by{" "}
          <a href={r.sponsorUrl} target="_blank" rel="noopener noreferrer">
            {r.sponsor}
          </a>{" "}
          ·{" "}
          <a href={r.eventUrl} target="_blank" rel="noopener noreferrer">
            event page
          </a>
        </p>
        <p className="rf-adm-note">
          A ticket is a row dated {r.windowLine}, logged before {fmtPacificStamp(new Date(r.closesAt).toISOString())}. One
          ticket per rower, however many rows. {r.drawLine}.{inProduction ? "" : " Dev: the clock is whatever nowMs() says."}
        </p>

        {w && (
          <div className="rf-adm-win">
            <div className="k">
              The winner · drawn {fmtPacificStamp(w.drawnAt)} by {w.drawnBy || "—"} · from {w.entrants} in the hat
            </div>
            <div className="n">
              <a href={`/row100k/r/${w.rowerNumber}`}>
                {w.name} · {fmtRowerNumber(w.rowerNumber)}
              </a>
            </div>
            <div className="l">
              {fmtMeters(w.meters)} at the draw · {w.rows} {w.rows === 1 ? "row" : "rows"} {fmtWindowShort(r)}
            </div>
          </div>
        )}

        {controls}
        {ok && <p className="rf-adm-ok">{ok}</p>}
        {error && <p className="form-err">{error}</p>}
      </div>

      <div className="sec-head">
        <h2>Second chance</h2>
        <span className="mono">{ctaLive ? "LIVE ON THE PARTNERS PAGE" : "HIDDEN"}</span>
      </div>
      <p className="rf-adm-note">
        “{r.cta.label}” →{" "}
        <a href={r.cta.url} target="_blank" rel="noopener noreferrer">
          {r.cta.url}
        </a>
        . Hidden on the partners page until you make it live.
      </p>
      <div className="tabs" role="group" aria-label="Second chance link" style={{ marginTop: 14 }}>
        <button type="button" className={ctaLive ? "on" : undefined} aria-pressed={ctaLive} disabled={busy || ctaLive} onClick={() => void setLive(true)}>
          Live
        </button>
        <button type="button" className={!ctaLive ? "on" : undefined} aria-pressed={!ctaLive} disabled={busy || !ctaLive} onClick={() => void setLive(false)}>
          Hidden
        </button>
      </div>

      <div className="sec-head">
        <h2>The hat</h2>
        <span className="mono">
          {hat.length} {hat.length === 1 ? "ROWER" : "ROWERS"}
          {entrants.length > hat.length ? ` · ${entrants.length - hat.length} ADMIN LISTED, NOT DRAWN` : ""}
        </span>
      </div>
      {unreadable ? (
        <p className="board-empty">THE HAT COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT.</p>
      ) : entrants.length === 0 ? (
        <p className="board-empty">NOBODY HERE YET — A ROW {fmtWindowShort(r)} PUTS A ROWER IN.</p>
      ) : (
        <table className="board">
          <thead>
            <tr>
              <th>Rower</th>
              <th>Board</th>
              <th className="num" style={{ textAlign: "right" }}>
                Rows
              </th>
              <th className="num" style={{ textAlign: "right" }}>
                {fmtWindowShort(r)}
              </th>
              <th className="num" style={{ textAlign: "right" }}>
                Total
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entrants.map((e) => (
              <tr key={e.participantId}>
                <td className="who">
                  <a href={`/row100k/r/${e.rowerNumber}`}>
                    {e.name} · {fmtRowerNumber(e.rowerNumber)}
                  </a>
                </td>
                <td className="mono">{e.division}</td>
                <td className="num">{e.rows}</td>
                <td className="num">{fmtMeters(e.windowMeters)}</td>
                <td className="num">{fmtMeters(e.meters)}</td>
                <td className="adm mono">{e.admin ? "ADMIN" : w?.participantId === e.participantId ? "WINNER" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
