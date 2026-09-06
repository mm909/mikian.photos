"use client";

import { useState } from "react";
import { ELITE_LABEL, clockShape, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import { fmtDay, fmtRecordTime, fmtRowerNumber, fmtSplit } from "@/lib/row100k";
import { BlockClock, Blocks } from "../../Blackout";
import { Who } from "../../Boards";
import {
  RECORD_DEFS,
  podiumWindow,
  type RecordDef,
  type RecordKey,
  type RecordRowLite,
  type RecordsProp,
} from "../../records/defs";

/* MOCK (owner ask, 2026-09-05 — "give me a picture, I do not think I want
 * to do that yet"): the stats page records head with the five-link record
 * submenu folded into ONE control. The headline, the holder line and the
 * podiums are the live page's markup (Stats.tsx StatsRecords, mirrored
 * here so the live file stays untouched); only the way a record gets
 * picked changes:
 *
 *   name — the record's name under the holder line, ink on a water
 *          underline (the .st-sub .on idiom) with a caret after it, so it
 *          reads as the thing on this head that can change;
 *   chip — the name as a small mono chip on the right end of the holder
 *          line, the caret on its edge.
 *
 * Both open the same inline list — mono, dashed hairlines, the current
 * record in ink, the rest grey; no modal, no shadow, no radius — and a
 * pick swaps the headline and the podiums in place (client state, the
 * live page's RecordsProp shape).
 *
 * Blackout: the props arrive blanked from the page (records/defs.ts
 * liteRecords), exactly as on the live page; a hidden row draws blocks of
 * the shape its number had and a hidden holder's split stays off. */

export type PickVariant = "name" | "chip";

const defOf = (key: RecordKey): RecordDef => RECORD_DEFS.find((d) => d.key === key)!;

export function RecordsPick({
  records,
  started,
  meId,
  anyHidden,
  unavailable = false,
  blackout = { active: false },
  variant,
}: {
  records: RecordsProp;
  started: boolean;
  /* Signed-in rower's participant id (resolved server-side), or null. */
  meId: string | null;
  /* Whether this viewer has rows hidden from them — the bo-note line. */
  anyHidden: boolean;
  /* The board could not be read, so the records are empty for that reason
   * and not because nobody has rowed. */
  unavailable?: boolean;
  blackout?: { active: boolean; endsAt?: string };
  /* Which of the two closed states to draw (the open list is shared). */
  variant: PickVariant;
}) {
  const [key, setKey] = useState<RecordKey>("total");
  const [open, setOpen] = useState(false);
  const def = defOf(key);
  const rows = records[key] ?? [];
  const first = rows[0];
  const until = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";

  const meRow = meId ? rows.find((r) => r.participantId === meId) : undefined;
  const overall = meRow !== undefined && meRow.division !== "M" && meRow.division !== "F";

  /* The holder line under the headline, as on the live page: number ·
   * NAME · day, plus the split for a pace record and the session count
   * for total meters. A hidden holder's split is the time by another
   * name, so it stays off. */
  const meta = first
    ? [
        first.day ? fmtDay(first.day) : null,
        def.kind === "time" && def.dist && !first.masked ? `${fmtSplit(def.dist, first.value)} /500m` : null,
        first.sessions != null ? `${first.sessions} sessions` : null,
      ]
        .filter(Boolean)
        .map((s) => ` · ${s}`)
        .join("")
    : "";

  const listId = `st-pick-${variant}`;
  const pick = (k: RecordKey) => {
    setKey(k);
    setOpen(false);
  };
  const caret = (
    <span className="st-pick-caret" aria-hidden="true">
      {open ? "▴" : "▾"}
    </span>
  );

  /* The one control. Look "name": under the holder line. Look "chip": on
   * the holder line's right end (the line becomes a flex row). */
  const control = (
    <button
      type="button"
      className={variant === "chip" ? "st-pick-chip" : "st-pick-name"}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={listId}
      onClick={() => setOpen((o) => !o)}
    >
      {def.title} {caret}
    </button>
  );

  /* The inline list: every record, the picked one in ink. It hangs off
   * the same edge as its control — left under the name, right under the
   * chip. */
  const list = open && (
    <div
      id={listId}
      className={variant === "chip" ? "st-pick-list right" : "st-pick-list"}
      role="group"
      aria-label="Record"
    >
      {RECORD_DEFS.map((d) => (
        <button
          key={d.key}
          type="button"
          aria-pressed={key === d.key}
          className={key === d.key ? "on" : undefined}
          onClick={() => pick(d.key)}
        >
          {d.title}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {(blackout.active || anyHidden) && (
        <p className="bo-note">
          {anyHidden ? `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}` : `BLACKOUT ON${until} — YOU SEE EVERYTHING`}
        </p>
      )}

      {first ? (
        <div className="bhead st-rec st-pick">
          <div className="bhead-n">
            <Val r={first} def={def} unit="big" />
          </div>
          {variant === "chip" ? (
            <p className="bhead-l mono st-pick-line">
              <span className="st-pick-holder">
                {fmtRowerNumber(first.rowerNumber)} · <b>{first.name}</b>
                {meta}
              </span>
              {control}
            </p>
          ) : (
            <>
              <p className="bhead-l mono">
                {fmtRowerNumber(first.rowerNumber)} · <b>{first.name}</b>
                {meta}
              </p>
              {control}
            </>
          )}
          {list}
        </div>
      ) : (
        <div className="st-pick">
          <p className="board-empty">
            {unavailable ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT." : def.emptyHint(started)}
          </p>
          {/* An empty record still needs the control, or nothing could be
              picked away from it. The name look serves both variants here. */}
          <button
            type="button"
            className="st-pick-name"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            {def.title} {caret}
          </button>
          {list}
        </div>
      )}

      {!unavailable && (
        <div className="front-top st-podiums">
          <Podium label="Men" rows={rows.filter((r) => r.division === "M")} def={def} meId={meId} />
          <Podium label="Women" rows={rows.filter((r) => r.division === "F")} def={def} meId={meId} />
        </div>
      )}
      {overall && <Podium label="Overall" rows={rows} def={def} meId={meId} top={0} className="st-overall" />}

      <div className="ms-actions">
        <a className="quiet-btn" href={`/row100k/records/${key}?d=all`}>
          FULL RANKING →
        </a>
      </div>
    </div>
  );
}

/* ---- the live page's pieces, mirrored (Stats.tsx keeps its own) ---- */

/* A record value: a time with tenths, or meters with its unit — small and
 * grey inside the headline, plain in a table cell. A hidden row draws the
 * shape the page attached (the value itself is 0 by now). */
function Val({ r, def, unit }: { r: RecordRowLite; def: RecordDef; unit: "big" | "table" }) {
  if (def.kind === "time") {
    return r.masked ? <BlockClock shape={r.shape ?? clockShape(r.value, true)} /> : <>{fmtRecordTime(r.value)}</>;
  }
  const num = r.masked ? <Blocks digits={r.digits ?? digitCount(r.value)} /> : Math.round(r.value).toLocaleString("en-US");
  return unit === "big" ? (
    <>
      {num} <span className="u">m</span>
    </>
  ) : (
    <>{num} m</>
  );
}

/* One division's top three and, for a signed-in rower placed deeper,
 * their neighbourhood under a gap row (records/defs.ts podiumWindow). */
function Podium({
  label,
  rows,
  def,
  meId,
  top = 3,
  className,
}: {
  label: string;
  rows: RecordRowLite[];
  def: RecordDef;
  meId: string | null;
  top?: number;
  className?: string;
}) {
  const meIdx = meId ? rows.findIndex((r) => r.participantId === meId) : -1;
  const w = podiumWindow(rows, meIdx, top);
  if (top === 0 && w.ctx.length === 0) return null;
  return (
    <div className={className ? `front-three ${className}` : "front-three"}>
      <h3 className="mono">{label}</h3>
      {rows.length === 0 ? (
        <p className="board-empty">NOBODY ON THIS BOARD YET.</p>
      ) : (
        <table className="board">
          <tbody>
            {w.top.map((r, i) => (
              <RecTr key={r.participantId} r={r} rank={i + 1} def={def} me={r.participantId === meId} />
            ))}
            {w.gap && (
              <tr className="gaprow">
                <td colSpan={3}>···</td>
              </tr>
            )}
            {w.ctx.map((r, i) => (
              <RecTr key={r.participantId} r={r} rank={w.ctxStart + i + 1} def={def} me={r.participantId === meId} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RecTr({ r, rank, def, me }: { r: RecordRowLite; rank: number; def: RecordDef; me: boolean }) {
  return (
    <tr className={me ? "fin" : undefined}>
      <td className="rk">{rank}</td>
      <td>
        <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
      </td>
      <td className="num">
        <Val r={r} def={def} unit="table" />
      </td>
    </tr>
  );
}
