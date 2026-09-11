import type { ReactNode } from "react";

import { fmtRowerNumber } from "@/lib/row100k";
import {
  bracketView,
  fmtAgo,
  fmtClock,
  fmtElapsed,
  fmtGap,
  fmtSplitFor,
  fmtTime,
  inWave,
  liveWave,
  nextWave,
  ordinal,
  placeOf,
  podium,
  racerById,
  ranked,
  roomCounts,
  waveLines,
  type BracketView,
  type ResultBoard,
  type ResultRacer,
} from "./types";

/* THE START LIST THAT FILLS IN — the results board.
 *
 * ONE TABLE HOLDS EVERY RACER from the moment the field is set, grouped by
 * wave, ordered by lane inside each wave so a row never moves, and a time
 * simply APPEARS in a row when that racer pulls. At 7:38 PM the empty rows
 * ARE the information: nobody has to be told the leaderboard is provisional,
 * because sixteen rows have no time in them. No row is ever blank, though —
 * every racer carries their fastest 5k coming in, so an unrowed row still
 * says who is on the way.
 *
 * GRAFTED IN, from the two boards that lost on the owner lens but won on
 * the others:
 *   - the line that makes a partial leaderboard honest, on every leader box:
 *     13 STILL TO ROW · 2 OF THEM HAVE A FASTER 5K ON RECORD. Computed off
 *     best5k, which the site already has. The wording is the corrected one —
 *     HAVE GONE FASTER read as if two people had already beaten him tonight.
 *   - the lane-by-lane strip for the wave on the ergs, with the empty erg
 *     shown. Nobody in the room asks who is in wave 3, they ask which erg.
 *   - the three-cell counter. Broadcast filled its middle cell; here the
 *     live cell wears the 9px bar instead, because on this board a FILL
 *     means a settled fact (a wave that is in, a winner) and a BAR means
 *     something happening now. Fill had to mean one thing.
 *   - the heavy rule under the last finisher reading THE FIELD BELOW THE
 *     RULE HAS NOT ROWED, and a bar down the side of anybody still to row
 *     whose seed is under the leading time.
 *
 * FIRST, SECOND AND THIRD WITHOUT A COLOUR — four redundant signals, since
 * a monochrome board cannot hand out a gold medal:
 *   1 THE BLOCK   filled white / 2px outline / 1px hairline. Fill beats
 *                 outline beats hairline: it is a literal podium.
 *   2 THE CLOCK   86 / 52 / 38 on a laptop, 50 / 36 / 31 on a phone, so the
 *                 stair survives the stack.
 *   3 THE ORDINAL spelled: 1ST / 2ND / 3RD.
 *   4 THE GAP     printed on all three. First carries WON BY 0:31.5 rather
 *                 than an empty space, so the blocks read as ONE
 *                 measurement and not a winner plus two also-rans.
 * And under each podium, the line a podium normally hides: FOURTH, with how
 * far off it they were. On this field a woman misses third by nine tenths of
 * a second, and that is the best thing on the page.
 *
 * The components take a plain serialisable model (types.ts) and never read
 * the database, so the real page can hand them real rows unchanged. */

const DASH = "—";

function no(n: number): string {
  return `No. ${fmtRowerNumber(n)}`;
}

function seedText(r: ResultRacer): string {
  if (!r.best5k) return "First 5k";
  return fmtTime(r.best5k.seconds) + (r.best5k.prorated ? " (pro-rated)" : "");
}

/* Tonight against their own fastest 5k this September. Signed the rowing
 * way: a minus means they went faster than they ever have. */
function vsBest(r: ResultRacer): string | null {
  if (r.seconds === null || !r.best5k) return null;
  return fmtGap(r.seconds - r.best5k.seconds);
}

/* ---- the dateline ---------------------------------------------------- */

export function Dateline({ board }: { board: ResultBoard }) {
  const final = board.state === "finished";
  return (
    <>
      <div className="rr-line">
        <p className="rr-date">
          <b>{board.dateLine}</b>
          {board.placeLine}
        </p>
        <p className="rr-now">
          {!final && <span className="rr-sq" aria-hidden="true" />}
          {final ? "Final " : "Live "}
          {fmtClock(board.nowMs)}
        </p>
      </div>
      <Freshness board={board} />
    </>
  );
}

/* A BOARD IS ONLY AS LIVE AS THE PERSON TYPING TIMES between waves, and on
 * a television nobody can tell the difference between a slow wave and a
 * wave nobody entered. So the last entry is printed, and once it is more
 * than five minutes old the line says how old in plain words. */
function Freshness({ board }: { board: ResultBoard }) {
  const final = board.state === "finished";
  const stale = board.nowMs - board.updatedAtMs > 5 * 60_000;
  if (final) {
    return (
      <p className="rr-fresh">
        Sheet posted <b>{fmtClock(board.updatedAtMs)}</b> · every wave is in
      </p>
    );
  }
  return (
    <p className={stale ? "rr-fresh stale" : "rr-fresh"}>
      Last time entered <b>{fmtClock(board.updatedAtMs)}</b> · <b>{fmtAgo(board.updatedAtMs, board.nowMs)}</b>
    </p>
  );
}

/* ---- the leader box -------------------------------------------------- */

export function LeaderBox({
  board,
  view,
  cast,
}: {
  board: ResultBoard;
  view: BracketView;
  cast?: boolean;
}) {
  const final = board.state === "finished";
  const lead = view.leader;
  const left = view.stillToRow.length;
  const thr = view.threats;
  const blind = view.unseeded.length;
  return (
    <div className="rr-box lead">
      <p className="rr-eye">
        <span>
          {final ? "Won" : "Leading"} · {view.label}
        </span>
        <span className={final ? "rr-chip fill" : "rr-chip"}>{final ? "Final" : "Provisional"}</span>
        <span className="rt">
          {view.rowed} of {view.field} rowed
        </span>
      </p>
      {lead === null ? (
        <>
          <p className="rr-big">{DASH}</p>
          <p className="rr-meta">Nobody in this bracket has pulled yet.</p>
        </>
      ) : (
        <>
          <p className="rr-big">{fmtTime(lead.seconds ?? 0)}</p>
          <p className="rr-who">
            {lead.name} <span>{no(lead.rowerNumber)}</span>
          </p>
          <p className="rr-meta">
            <b>{fmtSplitFor(board.meters, lead.seconds ?? 0)}</b> /500 · Wave {lead.wave}
          </p>
        </>
      )}
      {!final && (
        <div className="rr-foot">
          <b>
            {left} still to row
          </b>{" "}
          ·{" "}
          {thr.length === 0 ? (
            "none of them has a faster 5k on record"
          ) : (
            <>
              <b>{thr.length}</b> of them {thr.length === 1 ? "has" : "have"} a faster 5k on record
            </>
          )}
          {/* The unknowns are counted on a phone and a laptop; on the wall
           * the line has to stay one line, so it is dropped there. */}
          {!cast && blind > 0 ? ` · ${blind} with no 5k on record` : ""}
          {/* On the wall the threats are counted and the fastest named in one
           * line; on a phone or a laptop every one of them is named, because
           * the rower sitting fourth is the reader who needs it. */}
          {thr.slice(0, cast ? 1 : 3).map((t) => (
            <span className="thr" key={t.id}>
              Fastest to come · <b>{fmtTime(t.best5k?.seconds ?? 0)}</b> {t.name} ·{" "}
              {t.status === "rowing" ? "on the ergs now" : `wave ${t.wave}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- who is on the ergs --------------------------------------------- */

export function OnTheErgs({ board }: { board: ResultBoard }) {
  const w = liveWave(board);
  if (!w) return null;
  const field = inWave(board, w.wave);
  const rowing = field.filter((r) => r.status === "rowing").length;
  /* AN EMPTY ERG IS COUNTED OFF THE FLOOR, not off the wave. Counting the
   * wave only ever finds a no-show and is blind to a machine nobody was
   * assigned to — a short last wave would print no empty ergs at all while
   * the lane strip directly beneath drew three of them, because the strip
   * has always iterated board.ergs. The two now agree. */
  const open = Math.max(0, board.ergs - rowing);
  const elapsed = fmtElapsed(w.startedAtMs, board.nowMs);
  return (
    <div className="rr-box lead">
      <p className="rr-eye">
        <span className="rr-sq" aria-hidden="true" />
        <span>On the ergs now</span>
      </p>
      <p className="rr-big">Wave {w.wave}</p>
      <p className="rr-meta">
        {/* No start stamp, no clock: a wave that went late must never be
         * counted from the schedule, or it reads as nearly finished. */}
        {w.startedAtMs === null ? (
          <>Started · not stamped</>
        ) : (
          <>
            Started <b>{fmtClock(w.startedAtMs)}</b>
            {elapsed ? (
              <>
                {" "}
                · <b>{elapsed}</b> elapsed
              </>
            ) : null}
          </>
        )}
      </p>
      <p className="rr-meta">
        <b>{rowing}</b> rowing
        {open > 0 ? (
          <>
            {" "}
            · <b>{open}</b> {open === 1 ? "erg" : "ergs"} empty
          </>
        ) : null}
      </p>
    </div>
  );
}

/* THE LANES. An erg with nobody on it is drawn, not skipped — the room can
 * see the empty seat, and a no-show is named rather than left a mystery. */
export function LaneStrip({ board, cast }: { board: ResultBoard; cast?: boolean }) {
  const w = liveWave(board);
  if (!w) return null;
  const field = inWave(board, w.wave);
  const lanes = Array.from({ length: board.ergs }, (_, i) => {
    const lane = i + 1;
    return { lane, racer: field.find((r) => r.lane === lane) ?? null };
  });
  return (
    <div className="rr-box lead" style={{ marginTop: 14 }}>
      <p className="rr-eye">
        <span>
          The ergs · wave {w.wave} · lane by lane
        </span>
        {!cast && w.startedAtMs !== null && (
          <span className="rt">
            Started {fmtClock(w.startedAtMs)} · {fmtElapsed(w.startedAtMs, board.nowMs)} elapsed
          </span>
        )}
      </p>
      <div className="rr-lanes">
        {lanes.map(({ lane, racer }) => {
          const empty = racer === null || racer.status !== "rowing";
          return (
            <div className={empty ? "rr-lane open" : "rr-lane"} key={lane}>
              <p className="rr-ln">Lane {lane}</p>
              <p className="rr-lname">{racer ? castName(racer.name, cast) : "Erg open"}</p>
              <p className="rr-lsub">
                {racer === null
                  ? "No entry"
                  : racer.status === "rowing"
                    ? `${no(racer.rowerNumber)} · ${racer.bracket}`
                    : racer.status === "dns"
                      ? "Did not start"
                      : racer.status === "dnf"
                        ? "Did not finish"
                        : `${no(racer.rowerNumber)} · ${racer.bracket}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Eight lanes across a 1280 frame is not much room: a long name is cut to a
 * first name and an initial on the wall only, never on a phone. */
function castName(name: string, cast?: boolean): string {
  if (!cast || name.length <= 12) return name;
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/* ---- the counter ----------------------------------------------------- */

export function Counters({ board }: { board: ResultBoard }) {
  const c = roomCounts(board.racers);
  const final = board.state === "finished";
  const cells = final
    ? [
        { n: c.rowed, k: "Finished", mark: "fill" },
        { n: c.dns, k: "Did not start", mark: "" },
        { n: c.dnf, k: "Did not finish", mark: "" },
      ]
    : [
        { n: c.rowed, k: "Rowed", mark: "fill" },
        { n: c.onErgs, k: "On the ergs", mark: "live" },
        { n: c.toCome, k: "Still to come", mark: "" },
      ];
  return (
    <div className="rr-count">
      {cells.map((cell) => (
        <div className={cell.mark ? `rr-cell ${cell.mark}` : "rr-cell"} key={cell.k}>
          <div className="rr-n">{cell.n}</div>
          <div className="rr-k">{cell.k}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- the wave grid --------------------------------------------------- */

export function WaveGrid({ board, cast }: { board: ResultBoard; cast?: boolean }) {
  const you = cast ? null : racerById(board, board.youId);
  return (
    <div className="rr-grid">
      {board.waves.map((w) => {
        const field = inWave(board, w.wave);
        const done = ranked(field);
        const yours = you !== null && you.wave === w.wave;
        const cls =
          w.state === "rowed" ? "done" : w.state === "on_the_ergs" ? "live" : "soon";
        const elapsed = fmtElapsed(w.startedAtMs, board.nowMs);
        return (
          <div className={`rr-cw ${cls}${yours ? " yours" : ""}`} key={w.wave}>
            <p className="rr-cwk">Wave</p>
            <p className="rr-wn">{w.wave}</p>
            <p className="rr-cws">
              <b>{fmtClock(w.startedAtMs ?? w.scheduledAtMs)}</b>
              <br />
              {w.state === "rowed" ? (
                <>
                  Rowed
                  {done[0] ? (
                    <>
                      <br />
                      Best {fmtTime(done[0].seconds ?? 0)}
                    </>
                  ) : null}
                </>
              ) : w.state === "on_the_ergs" ? (
                <>
                  On the ergs
                  {elapsed ? (
                    <>
                      <br />
                      {elapsed} elapsed
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {field.length} racers
                  {yours ? (
                    <>
                      <br />
                      Yours
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ---- the field table ------------------------------------------------- */

function PlaceMark({ board, racer }: { board: ResultBoard; racer: ResultRacer }) {
  const p = placeOf(board, racer);
  if (p === null) {
    return <span className="rr-pl">{DASH}</span>;
  }
  const cls = p === 1 ? "rr-pl p1" : p === 2 ? "rr-pl p2" : p === 3 ? "rr-pl p3" : "rr-pl";
  /* Places are WITHIN BRACKET and this table holds one room, so the mark is
   * qualified — an unqualified sheet prints a 1 for the men and a 1 for the
   * women a few rows apart and a reader cannot scan it. */
  return (
    <span className={cls}>
      {racer.bracket === "M" ? "M" : "W"}
      {p}
    </span>
  );
}

function TimeCell({ racer }: { racer: ResultRacer }) {
  if (racer.status === "finished" && racer.seconds !== null) {
    return <td className="tm">{fmtTime(racer.seconds)}</td>;
  }
  if (racer.status === "rowing") return <td className="st now">Rowing</td>;
  if (racer.status === "dns") return <td className="st">Did not start</td>;
  if (racer.status === "dnf") return <td className="st">Did not finish</td>;
  return <td className="dim">{DASH}</td>;
}

function NameCell({
  board,
  racer,
  you,
}: {
  board: ResultBoard;
  racer: ResultRacer;
  you: boolean;
}) {
  const sub =
    racer.status === "finished" && racer.seconds !== null
      ? `${fmtSplitFor(board.meters, racer.seconds)} /500${
          vsBest(racer) ? ` · ${vsBest(racer)} on best` : ""
        }`
      : racer.best5k
        ? `Best in ${fmtTime(racer.best5k.seconds)}`
        : "First 5k";
  return (
    <td className="nm">
      {racer.name}
      {you && <span className="rr-tag you">You</span>}
      <span className="rr-sub">{sub}</span>
    </td>
  );
}

/* THE FIELD, grouped by wave: every racer from the moment the field is set,
 * a row that never moves, and a time that appears when they pull. */
export function FieldTable({ board }: { board: ResultBoard }) {
  const men = bracketView(board, "M");
  const women = bracketView(board, "F");
  const threatIds = new Set([...men.threats, ...women.threats].map((r) => r.id));
  const lastRowed = [...board.waves].filter((w) => w.state === "rowed").pop() ?? null;
  const belowRule = board.racers.filter(
    (r) => lastRowed !== null && r.wave > lastRowed.wave && r.status !== "dns",
  );
  const blind = belowRule.filter((r) => r.best5k === null).length;
  const rows: ReactNode[] = [];

  for (const w of board.waves) {
    const field = inWave(board, w.wave);
    rows.push(
      /* A WAVE HEAD IS A HEADING, not a value in the Place column. As a td it
       * was read out as one, so the group rows are th scope=colgroup and the
       * stylesheet puts the band back. */
      <tr className="wh" key={`h${w.wave}`}>
        <th colSpan={7} scope="colgroup">
          Wave {w.wave} · {fmtClock(w.startedAtMs ?? w.scheduledAtMs)} · {field.length} racers
          <span className={w.state === "on_the_ergs" ? "now" : undefined}>
            {w.state === "rowed" ? "Rowed" : w.state === "on_the_ergs" ? "On the ergs" : "To come"}
          </span>
        </th>
      </tr>,
    );
    for (const r of field) {
      const you = r.id === board.youId;
      const thr = threatIds.has(r.id);
      const cls = [
        r.status === "rowing" ? "live" : "",
        you ? "mine" : "",
        thr ? "thr" : "",
      ]
        .filter(Boolean)
        .join(" ");
      rows.push(
        <tr className={cls || undefined} key={r.id}>
          <td className="pl">
            <PlaceMark board={board} racer={r} />
          </td>
          <td className="no">{fmtRowerNumber(r.rowerNumber)}</td>
          <NameCell board={board} racer={r} you={you} />
          <td className="br rr-hx">{r.bracket}</td>
          <td className="seed rr-hx">{seedText(r)}</td>
          <TimeCell racer={r} />
          <td className="dim rr-hx">
            {r.status === "finished" && r.seconds !== null
              ? fmtSplitFor(board.meters, r.seconds)
              : DASH}
          </td>
        </tr>,
      );
    }
    /* THE RULE. Drawn once, under the last wave that is in — everything
     * below it has not rowed, and saying so with a line beats a column of
     * dashes. */
    if (lastRowed !== null && w.wave === lastRowed.wave) {
      rows.push(
        <tr className="rule" key="rule">
          <th colSpan={7} scope="colgroup">
            The field below the rule has not rowed{" "}
            <em>
              {belowRule.length} still to go · {threatIds.size} seeded under the lead ·{" "}
              {blind} with no 5k on record
            </em>
          </th>
        </tr>,
      );
    }
  }

  return (
    <table className="rr-t prov">
      <caption>The field, by wave · a row appears the moment the field is set</caption>
      <thead>
        <tr>
          <th className="pl" scope="col">
            Pl.
          </th>
          <th scope="col">No.</th>
          <th scope="col">Rower</th>
          <th className="rr-hx" scope="col">
            Br
          </th>
          <th className="rr-hx" scope="col" style={{ textAlign: "right" }}>
            Best coming in
          </th>
          <th scope="col" style={{ textAlign: "right" }}>
            {board.meters.toLocaleString()} m
          </th>
          <th className="rr-hx" scope="col" style={{ textAlign: "right" }}>
            /500
          </th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

/* THE RESULT — the same field, now one list sorted by time. Men and women
 * are scored apart, so the place mark is qualified and the two brackets sit
 * in one room, which is the story the night actually has. */
export function ResultTable({ board }: { board: ResultBoard }) {
  const done = ranked(board.racers);
  const out = board.racers.filter((r) => r.status === "dns" || r.status === "dnf");
  return (
    <table className="rr-t">
      <caption>The result · one room sorted by time, scored apart</caption>
      <thead>
        <tr>
          <th className="pl" scope="col">
            Pl.
          </th>
          <th scope="col">No.</th>
          <th scope="col">Rower</th>
          <th className="rr-hx" scope="col">
            Br
          </th>
          <th className="rr-hx" scope="col" style={{ textAlign: "right" }}>
            Best coming in
          </th>
          <th scope="col" style={{ textAlign: "right" }}>
            {board.meters.toLocaleString()} m
          </th>
          <th className="rr-hx" scope="col" style={{ textAlign: "right" }}>
            /500
          </th>
          <th className="rr-hx" scope="col" style={{ textAlign: "right" }}>
            Vs best
          </th>
          <th className="rr-hx" scope="col" style={{ textAlign: "right" }}>
            Wave
          </th>
        </tr>
      </thead>
      <tbody>
        {done.map((r) => (
          <tr className={r.id === board.youId ? "mine" : undefined} key={r.id}>
            <td className="pl">
              <PlaceMark board={board} racer={r} />
            </td>
            <td className="no">{fmtRowerNumber(r.rowerNumber)}</td>
            <NameCell board={board} racer={r} you={r.id === board.youId} />
            <td className="br rr-hx">{r.bracket}</td>
            <td className="seed rr-hx">{seedText(r)}</td>
            <TimeCell racer={r} />
            <td className="dim rr-hx">{fmtSplitFor(board.meters, r.seconds ?? 0)}</td>
            <td className={vsBest(r) && (r.seconds ?? 0) < (r.best5k?.seconds ?? 0) ? "tm rr-hx" : "dim rr-hx"}>
              {vsBest(r) ?? DASH}
            </td>
            <td className="dim rr-hx">{r.wave}</td>
          </tr>
        ))}
        {out.length > 0 && (
          <tr className="rule" key="out">
            <th colSpan={9} scope="colgroup">
              Nobody is dropped from the sheet <em>a name with no time still has a reason</em>
            </th>
          </tr>
        )}
        {out.map((r) => (
          <tr key={r.id}>
            <td className="pl">
              <span className="rr-pl">{DASH}</span>
            </td>
            <td className="no">{fmtRowerNumber(r.rowerNumber)}</td>
            <NameCell board={board} racer={r} you={r.id === board.youId} />
            <td className="br rr-hx">{r.bracket}</td>
            <td className="seed rr-hx">{seedText(r)}</td>
            <TimeCell racer={r} />
            <td className="dim rr-hx">{DASH}</td>
            <td className="dim rr-hx">{DASH}</td>
            <td className="dim rr-hx">{r.wave}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- the podium ------------------------------------------------------ */

export function Podium({
  board,
  view,
  cast,
}: {
  board: ResultBoard;
  view: BracketView;
  cast?: boolean;
}) {
  const p = podium(view);
  if (p.steps.length === 0) return null;
  return (
    <>
      <div className="rr-pod">
        {p.steps.map(({ racer, place, gap }) => (
          <div className={`rr-step s${place}`} key={racer.id}>
            <p className="rr-ord">
              {ordinal(place)}
              <span className="gp">
                {place === 1
                  ? p.wonBy === null
                    ? "Only finisher"
                    : `Won by ${fmtGap(p.wonBy).slice(1)}`
                  : fmtGap(gap)}
              </span>
            </p>
            <p className="rr-pt">{fmtTime(racer.seconds ?? 0)}</p>
            <p className="rr-pn">{racer.name}</p>
            <p className="rr-pm">
              {no(racer.rowerNumber)} · <b>{fmtSplitFor(board.meters, racer.seconds ?? 0)}</b> /500 ·
              Wave {racer.wave}
              {!cast && (
                <>
                  <br />
                  {vsBest(racer)
                    ? `${vsBest(racer)} on their best coming in`
                    : "First 5k on record"}
                </>
              )}
            </p>
          </div>
        ))}
      </div>
      {p.fourth && (
        <p className="rr-fourth">
          Fourth · <b>{p.fourth.racer.name}</b> · <b>{fmtTime(p.fourth.racer.seconds ?? 0)}</b> ·{" "}
          {p.fourth.offPodium.toFixed(1)} sec off the podium
        </p>
      )}
    </>
  );
}

/* ---- what the table buries ------------------------------------------- */

type Note = { k: string; v: string; n?: string };

/* The place two people were actually fighting over, in words. */
function placeWord(place: number): string {
  return place === 1
    ? "the win"
    : place === 2
      ? "second"
      : place === 3
        ? "third"
        : `place ${place}`;
}

function worthSaying(board: ResultBoard): Note[] {
  const notes: Note[] = [];
  const all = ranked(board.racers);
  const men = bracketView(board, "M");
  const women = bracketView(board, "F");

  if (all[0]) {
    notes.push({
      k: "Fastest piece in the room",
      v: fmtTime(all[0].seconds ?? 0),
      n: `${all[0].name} · wave ${all[0].wave} · either bracket`,
    });
  }

  /* The closest two finishers anywhere, and the places they were fighting
   * over — the only callout on the sheet that celebrates a second and a
   * third rather than a first. */
  type Close = { gap: number; ahead: ResultRacer; behind: ResultRacer; place: number };
  let closest: Close | null = null;
  for (const v of [men, women]) {
    for (let i = 1; i < v.ranked.length; i++) {
      const behind = v.ranked[i];
      const ahead = v.ranked[i - 1];
      const gap = (behind.seconds ?? 0) - (ahead.seconds ?? 0);
      if (closest === null || gap < closest.gap) closest = { gap, ahead, behind, place: i };
    }
  }
  if (closest) {
    notes.push({
      k: "Closest finish",
      v: `${closest.gap.toFixed(1)} sec`,
      n: `${closest.ahead.name} over ${closest.behind.name} for ${placeWord(closest.place)} · waves ${closest.ahead.wave} and ${closest.behind.wave}`,
    });
  }

  /* BIGGEST GAIN, not biggest negative split: nothing in the schema holds a
   * 2,500 m half and nobody is going to photograph forty monitors, so the
   * figure the site can actually compute is the one printed. */
  let gain: ResultRacer | null = null;
  for (const r of all) {
    if (!r.best5k || r.seconds === null) continue;
    const g = r.best5k.seconds - r.seconds;
    const best = gain && gain.best5k ? gain.best5k.seconds - (gain.seconds ?? 0) : -Infinity;
    if (g > best) gain = r;
  }
  if (gain && gain.best5k) {
    notes.push({
      k: "Biggest gain on a September best",
      v: fmtGap((gain.seconds ?? 0) - gain.best5k.seconds),
      n: `${gain.name} · ${fmtTime(gain.best5k.seconds)} in September · ${fmtTime(gain.seconds ?? 0)} tonight`,
    });
  }

  const seeded = all.filter((r) => r.best5k !== null);
  const beat = seeded.filter((r) => (r.seconds ?? 0) < (r.best5k?.seconds ?? 0)).length;
  notes.push({
    k: "September bests set",
    v: `${beat} of ${seeded.length}`,
    n: `${all.length - seeded.length} came in with no 5k on record`,
  });

  const c = roomCounts(board.racers);
  notes.push({
    k: "The field",
    v: `${c.field} racers`,
    n: `${bracketView(board, "M").all.length} men · ${bracketView(board, "F").all.length} women · ${board.waves.length} waves · ${board.ergs} ergs`,
  });
  notes.push({
    k: "Metres pulled",
    v: (c.rowed * board.meters).toLocaleString(),
    n: `${c.rowed} finished · ${c.dns} did not start · ${c.dnf} did not finish`,
  });

  const first = board.waves[0];
  notes.push({
    k: "First pull",
    v: fmtClock(first.startedAtMs ?? first.scheduledAtMs),
    n: `wave 1 of ${board.waves.length}`,
  });

  const lines = waveLines(board);
  const fastestWave = [...lines]
    .filter((l) => l.averageSeconds !== null)
    .sort((a, b) => (a.averageSeconds ?? 0) - (b.averageSeconds ?? 0))[0];
  if (fastestWave) {
    notes.push({
      k: "Fastest wave, averaged",
      v: fmtTime(fastestWave.averageSeconds ?? 0),
      n: `wave ${fastestWave.wave} · ${fastestWave.lanes} lanes`,
    });
  }
  return notes;
}

function WorthSaying({ board }: { board: ResultBoard }) {
  return (
    <ul className="rr-say">
      {worthSaying(board).map((nt) => (
        <li key={nt.k}>
          <span className="ln">
            <span className="k">{nt.k}</span>
            <span className="dt" aria-hidden="true" />
            <span className="v">{nt.v}</span>
          </span>
          {nt.n ? <span className="n">{nt.n}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/* HOW THE NIGHT RAN — the ledger idea, and it fills the ragged column under
 * the shorter of the two brackets rather than leaving white. */
function NightTable({ board }: { board: ResultBoard }) {
  return (
    <table className="rr-t">
      <caption>How the night ran · a row per wave</caption>
      <thead>
        <tr>
          <th scope="col">Wave</th>
          <th scope="col">Off at</th>
          <th scope="col" style={{ textAlign: "right" }}>
            Lanes
          </th>
          <th scope="col" style={{ textAlign: "right" }}>
            Fastest
          </th>
          <th scope="col" style={{ textAlign: "right" }}>
            Average
          </th>
        </tr>
      </thead>
      <tbody>
        {waveLines(board).map((l) => (
          <tr key={l.wave}>
            <td className="nm">Wave {l.wave}</td>
            <td className="dim" style={{ textAlign: "left" }}>
              {l.timeText}
            </td>
            <td className="dim">{l.lanes}</td>
            <td className="tm">{l.fastest ? fmtTime(l.fastest.seconds ?? 0) : DASH}</td>
            <td className="dim">{l.averageSeconds === null ? DASH : fmtTime(l.averageSeconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- you ------------------------------------------------------------- */

function YouStrip({ board }: { board: ResultBoard }) {
  const you = racerById(board, board.youId);
  if (!you) return null;
  const w = board.waves.find((x) => x.wave === you.wave) ?? null;
  const place = placeOf(board, you);
  return (
    <div className="rr-you">
      <span>You</span>
      <span className="nm">{you.name}</span>
      <span>{no(you.rowerNumber)}</span>
      {you.status === "finished" && you.seconds !== null ? (
        <span>
          <b>{fmtTime(you.seconds)}</b> · {place === null ? "" : `${place}${place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th"} `}
          {/* RANKED AGAINST THE NUMBER ACTUALLY RANKED. The bracket field
            * drops the no-shows but keeps a rower who sat down and stopped,
            * so this line was printing 12TH MAN OF 23 under a heading that
            * said 22 TIMES. It is the one line a rower screenshots. */}
          {you.bracket === "M" ? "man" : "woman"} of{" "}
          {bracketView(board, you.bracket).ranked.length} ·{" "}
          {vsBest(you) ?? "first 5k"} on your best coming in
        </span>
      ) : (
        <span>
          Your wave is <b>Wave {you.wave}</b> at{" "}
          <b>{fmtClock(w?.startedAtMs ?? w?.scheduledAtMs ?? board.nowMs)}</b> · lane{" "}
          <b>{you.lane}</b> ·{" "}
          {w && w.scheduledAtMs > board.nowMs
            ? `${Math.max(1, Math.round((w.scheduledAtMs - board.nowMs) / 60000))} min from now`
            : "on the floor now"}
        </span>
      )}
    </div>
  );
}

/* ---- the page -------------------------------------------------------- */

export function RaceResults({ board, note }: { board: ResultBoard; note?: ReactNode }) {
  const final = board.state === "finished";
  const men = bracketView(board, "M");
  const women = bracketView(board, "F");
  const c = roomCounts(board.racers);
  const next = nextWave(board);
  const live = liveWave(board);

  return (
    <div className="rr-dark">
      <section>
        <div className="rr-wrap">
          {note}
          <Dateline board={board} />
          <YouStrip board={board} />

          {final ? null : (
            <>
              <div className="rr-three">
                <LeaderBox board={board} view={men} />
                <LeaderBox board={board} view={women} />
                <OnTheErgs board={board} />
              </div>
              <LaneStrip board={board} />
              <Counters board={board} />
              <p className="rr-next">
                {next ? (
                  <>
                    Next · <b>Wave {next.wave} at {fmtClock(next.scheduledAtMs)}</b> ·{" "}
                  </>
                ) : null}
                {/* THE SAME DENOMINATOR AS THE LEADER BOXES eight inches
                  * above: everybody who can still put a time on the board.
                  * Counting the no-show here and not there put two different
                  * fields on one screen. */}
                <b>{c.rowed} of {c.possible}</b> have rowed · <b>{c.onErgs}</b> on the ergs ·{" "}
                <b>{c.toCome}</b> still to come
                {c.dns > 0 ? (
                  <>
                    {" "}
                    · <b>{c.dns}</b> did not start
                  </>
                ) : null}
              </p>
            </>
          )}
        </div>
      </section>

      {final && (
        <>
          <section>
            <div className="rr-wrap">
              <div className="sec-head">
                <h2>The men</h2>
                <span className="mono">
                  {men.all.length} racers · scored apart · {men.rowed} times
                </span>
              </div>
              <Podium board={board} view={men} />
            </div>
          </section>
          <section>
            <div className="rr-wrap">
              <div className="sec-head">
                <h2>The women</h2>
                <span className="mono">
                  {women.all.length} racers · scored apart · {women.rowed} times
                </span>
              </div>
              <Podium board={board} view={women} />
              {/* On a board with no gold, the grammar is taught once in
               * plain words — then the same three marks run down the sheet. */}
              <p className="rr-legend">
                First is the <b>filled block</b>, second the <b>heavy outline</b>, third the{" "}
                <b>hairline</b>. The same three marks run down the result below. Places are within
                bracket, so a mark reads M1 or W1. A time against a best coming in is signed the
                rowing way: a <b>minus</b> means faster than they have ever gone.
              </p>
            </div>
          </section>
          <section>
            <div className="rr-wrap">
              <div className="sec-head">
                <h2>Worth saying</h2>
                <span className="mono">What the table buries</span>
              </div>
              <WorthSaying board={board} />
            </div>
          </section>
          <section>
            <div className="rr-wrap">
              <div className="sec-head">
                <h2>How the night ran</h2>
                <span className="mono">
                  {board.waves.length} waves · {board.ergs} ergs · {board.waveMinutes} minutes apart
                </span>
              </div>
              <NightTable board={board} />
            </div>
          </section>
        </>
      )}

      {!final && (
        <section>
          <div className="rr-wrap">
            <div className="sec-head">
              <h2>The grid</h2>
              <span className="mono">
                {board.waves.length} waves · {board.ergs} ergs · {board.waveMinutes} minutes apart
              </span>
            </div>
            <WaveGrid board={board} />
          </div>
        </section>
      )}

      <section>
        <div className="rr-wrap">
          <div className="sec-head">
            <h2>{final ? "The result" : "The field"}</h2>
            <span className="mono">
              {c.field} racers · {men.all.length} men · {women.all.length} women
            </span>
          </div>
          {final ? (
            <>
              <p className="rr-note">
                One room, sorted by time, but scored apart: a place mark reads{" "}
                <b>M1</b> for the men and <b>W1</b> for the women, so the two brackets can sit in
                one list without two number ones arguing over the same column.
              </p>
              <ResultTable board={board} />
            </>
          ) : (
            <>
              <p className="rr-note">
                Every racer is in this list from the moment the field is set, and a time appears in
                the row when they pull. <b>{c.onErgs + c.toCome} rows are still empty</b>, so no
                place on this board is final. An empty row still says who is on the way: it carries
                their fastest 5k coming in. A bar down the side of a row means that seed is under
                the time leading their bracket.
                {live ? <> Wave {live.wave} is on the ergs now.</> : null}
              </p>
              <FieldTable board={board} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
