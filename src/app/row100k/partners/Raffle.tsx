import type { ReactNode } from "react";
import { fmtDay, fmtRowerNumber } from "@/lib/row100k";
import { fmtPacificDay } from "@/lib/blackoutRules";
import { TrackedLink } from "../TrackedLink";
import { fmtWindowShort, type RaffleDef, type RafflePhase } from "../raffles";
import type { RaffleState } from "../raffleData";

/* THE RAFFLE on the partners page (owner, 2026-09-08): a paper ticket above
 * the Grizzly block. The prize and where it happens, how to enter, and the
 * one line that changes with the viewer and the clock — OPENS WEDNESDAY,
 * LOG A ROW TO ENTER, YOU ARE IN, ENTRIES CLOSED, and once the owner has
 * drawn on /row100k/raffles, THE WINNER with their name and meters. The
 * partner's second chance sits under it only once the owner flips it live.
 *
 * Server component, no data of its own: the page reads the state and hands
 * it in, along with the winner's total already run through the board's
 * blackout rule (a winner can be one of THE ELITE, whose meters are blocks
 * while a window is open — this component never prints a raw total). */

/* Page-local styles — .rf- prefix, theme.ts untouched. Text child of a
 * style tag: no double quotes, angle brackets or apostrophes in here. */
export const raffleCss = `
.row100k .rf-ticket{position:relative;border:2px solid var(--ink);box-shadow:8px 8px 0 rgba(21,23,26,.2);padding:26px 22px 26px;margin-bottom:26px;background:var(--paper)}
.row100k .rf-top{display:flex;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;align-items:baseline}
.row100k .rf-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gray)}
.row100k .rf-phase{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--water)}
.row100k .rf-title{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(34px,9vw,64px);line-height:.95;text-transform:uppercase;letter-spacing:-.01em;margin-top:12px}
.row100k .rf-poster{margin-top:18px}
.row100k .rf-poster img{display:block;width:100%;height:auto;border:2px solid var(--ink)}
@media (min-width:600px){
  .row100k .rf-ticket.has-poster{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:0 24px}
  .row100k .rf-ticket.has-poster .rf-poster{grid-column:2;grid-row:1 / span 4;margin-top:0;align-self:start}
  .row100k .rf-ticket.has-poster .rf-top,.row100k .rf-ticket.has-poster .rf-title,.row100k .rf-ticket.has-poster .rf-sub,.row100k .rf-ticket.has-poster .rf-copy{grid-column:1}
  .row100k .rf-ticket.has-poster .rf-how,.row100k .rf-ticket.has-poster .rf-call,.row100k .rf-ticket.has-poster .rf-win,.row100k .rf-ticket.has-poster .rf-cta,.row100k .rf-ticket.has-poster .rf-given{grid-column:1 / -1}
}
.row100k .rf-sub{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);margin-top:12px;line-height:1.7}
.row100k .rf-copy{font-size:15px;line-height:1.6;color:var(--ink-soft);max-width:60ch;margin-top:14px}
.row100k .rf-copy a{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .rf-copy a:hover{color:var(--ink)}
.row100k .rf-how{margin-top:20px;border-top:1px dashed var(--line);padding-top:14px}
.row100k .rf-how .k{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gray)}
.row100k .rf-how p{font-size:15px;line-height:1.6;margin-top:6px;max-width:60ch}
.row100k .rf-call{display:block;margin-top:18px;border:2px solid var(--ink);padding:16px 18px;text-decoration:none;color:var(--ink)}
.row100k .rf-call .big{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5vw,28px);text-transform:uppercase;line-height:1.05}
.row100k .rf-call .mono{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);margin-top:8px;line-height:1.7}
.row100k .rf-call.go{background:var(--water);border-color:var(--water);color:#fff}
.row100k .rf-call.go .mono{color:rgba(255,255,255,.8)}
.row100k .rf-call.go:hover{background:var(--water-hover);border-color:var(--water-hover)}
.row100k .rf-call.in{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.row100k .rf-call.in .mono{color:rgba(244,243,238,.7)}
.row100k .rf-call.quiet{border-style:dashed;border-color:var(--gray)}
.row100k .rf-win{margin-top:18px;border:2px solid var(--ink);background:var(--ink);color:var(--paper);padding:16px 18px;box-shadow:4px 4px 0 var(--water)}
.row100k .rf-win .t{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,243,238,.7)}
.row100k .rf-stamp{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);background:var(--paper);padding:3px 9px 2px;margin-left:10px;vertical-align:middle;transform:rotate(-2deg)}
.row100k .rf-win .who{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,5.6vw,32px);text-transform:uppercase;line-height:1.05;margin-top:8px}
.row100k .rf-win .who a{color:var(--paper);text-decoration:none}
.row100k .rf-win .who a:hover{color:#fff;text-decoration:underline;text-underline-offset:4px}
.row100k .rf-win .meta{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,238,.7);margin-top:8px;line-height:1.8}
.row100k .rf-win .meta a{color:var(--paper);text-decoration:underline;text-underline-offset:3px}
.row100k .rf-cta{display:block;margin-top:14px;border:2px solid var(--ink);padding:12px 18px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);text-decoration:none;text-align:center}
.row100k .rf-cta:hover{background:var(--water);border-color:var(--water);color:#fff}
.row100k .rf-given{margin-top:16px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray)}
.row100k .rf-given a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.row100k .rf-given a:hover{color:var(--water)}
@media (max-width:599px){
  .row100k .rf-ticket{padding:20px 14px 22px}
  .row100k .rf-call{padding:14px 14px}
  .row100k .rf-win{padding:14px 14px}
}
`;

const PHASE_WORD: Record<RafflePhase, string> = {
  before: "OPENS",
  open: "OPEN NOW",
  closed: "ENTRIES CLOSED",
};

export function Raffle({
  raffle: r,
  phase,
  state,
  hat,
  myRows,
  joined,
  winnerTotal,
}: {
  raffle: RaffleDef;
  phase: RafflePhase;
  state: RaffleState;
  /* Rowers in the hat, or null when it could not be counted. */
  hat: number | null;
  /* The viewer's rows inside the window (0 = not in). */
  myRows: number;
  joined: boolean;
  /* The winner's total, already masked the way the board masks it. */
  winnerTotal: ReactNode | null;
}) {
  const entered = myRows > 0;
  const hatLine = hat === null ? null : `${hat} ${hat === 1 ? "ROWER" : "ROWERS"} IN THE HAT`;
  const w = state.winner;

  const phaseWord = w ? "DRAWN" : phase === "before" ? `${PHASE_WORD.before} ${fmtDay(r.entryFrom).toUpperCase()}` : PHASE_WORD[phase];

  return (
    <div className={`rf-ticket${r.poster ? " has-poster" : ""}`} id="raffle">
      {r.poster && (
        <div className="rf-poster">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.poster.src} alt={r.poster.alt} width={r.poster.width} height={r.poster.height} loading="lazy" />
        </div>
      )}
      <div className="rf-top">
        <span className="rf-eyebrow mono">
          The raffle · {r.prize} · ${r.valueUsd}
        </span>
        <span className="rf-phase mono">{phaseWord}</span>
      </div>
      <h3 className="rf-title">{r.title}</h3>
      <p className="rf-sub mono">
        {r.sub} · {r.when} · {r.where}
      </p>
      <p className="rf-copy">
        {r.blurb}{" "}
        <TrackedLink link="raffle-event">
          <a href={r.eventUrl} target="_blank" rel="noopener noreferrer">
            Tickets + info at {r.eventHost} →
          </a>
        </TrackedLink>
      </p>

      <div className="rf-how">
        <span className="k mono">How to enter</span>
        <p>
          Log a row {r.windowLine}. One ticket per rower. {r.closesLine}. {r.drawLine}.
        </p>
      </div>

      {w ? (
        <div className="rf-win">
          <div className="t mono">
            The winner
            <span className="rf-stamp">Drawn</span>
          </div>
          <span className="who">
            <a href={`/row100k/r/${w.rowerNumber}`}>
              {w.name} · {fmtRowerNumber(w.rowerNumber)}
            </a>
          </span>
          <div className="meta mono">
            {winnerTotal ?? "—"} rowed · {w.rows} {w.rows === 1 ? "row" : "rows"} {fmtWindowShort(r)} · drawn{" "}
            {fmtPacificDay(w.drawnAt)} from {w.entrants} in the hat
          </div>
        </div>
      ) : phase === "before" ? (
        <div className="rf-call quiet">
          <span className="big">Opens {fmtDay(r.entryFrom)}</span>
          <span className="mono">Log a row {fmtWindowShort(r)} to enter · {r.drawLine}</span>
        </div>
      ) : phase === "open" ? (
        entered ? (
          <div className="rf-call in">
            <span className="big">You&apos;re in</span>
            <span className="mono">
              {myRows} {myRows === 1 ? "row" : "rows"} this week{hatLine ? ` · ${hatLine}` : ""} · {r.drawLine}
            </span>
          </div>
        ) : (
          <a className="rf-call go" href={joined ? "/row100k#log" : "/row100k#join"}>
            <span className="big">Log a row to enter →</span>
            <span className="mono">
              {joined ? "" : "Opt in, then "}
              {joined ? "One row" : "one row"} {fmtWindowShort(r)} puts you in
              {hatLine ? ` · ${hatLine}` : ""}
            </span>
          </a>
        )
      ) : (
        <div className="rf-call quiet">
          <span className="big">Entries closed</span>
          <span className="mono">
            {entered ? "You are in the hat · " : ""}
            {hatLine ? `${hatLine} · ` : ""}
            {r.drawLine}
          </span>
        </div>
      )}

      {state.ctaLive && (
        <TrackedLink link="raffle-cta">
          <a className="rf-cta" href={r.cta.url} target="_blank" rel="noopener noreferrer">
            {r.cta.label}
          </a>
        </TrackedLink>
      )}

      <p className="rf-given mono">
        Given to Rowtember by{" "}
        <TrackedLink link="raffle-grizzly">
          <a href={r.sponsorUrl} target="_blank" rel="noopener noreferrer">
            {r.sponsor}
          </a>
        </TrackedLink>
      </p>
    </div>
  );
}
