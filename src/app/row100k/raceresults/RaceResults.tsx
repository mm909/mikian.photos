import { Fragment, type CSSProperties, type ReactNode } from "react";

import { fmtRowerNumber } from "@/lib/row100k";
import {
  bracketView,
  brLetter,
  fmtAgo,
  fmtClock,
  fmtElapsed,
  fmtGap,
  fmtSplitFor,
  fmtTime,
  inWave,
  isPr,
  nextWave,
  ordinal,
  pickedWave,
  placeOf,
  podium,
  racerById,
  ranked,
  roomCounts,
  waveLineOf,
  waveLines,
  waveOf,
  type BracketView,
  type ResultBoard,
  type ResultRacer,
  type ResultWave,
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
 *   - the lane-by-lane strip, with the empty erg shown. Nobody in the room
 *     asks who is in wave 3, they ask which erg. It is the PANEL of the wave
 *     picker now rather than a block of its own — see WavePicker.
 *   - the heavy rule under the last finisher reading THE FIELD BELOW THE
 *     RULE HAS NOT ROWED. The line is the mark, and it says the honest thing
 *     louder than a column of dashes.
 *
 * WHAT CAME OFF, 2026-09-11, all of it the owner reading the board on his
 * phone. The board counts and explains less and shows the same night:
 *   - the PROVISIONAL chips, and the whole still-to-row foot under each
 *     leader box (N STILL TO ROW · N OF THEM HAVE A FASTER 5K ON RECORD ·
 *     N WITH NO 5K ON RECORD, and the FASTEST TO COME lines under it).
 *   - the three-cell ROWED / ON THE ERGS / STILL TO COME counter, and the
 *     same counts again out of the NEXT line. NEXT · WAVE 4 AT 7:45 PM is
 *     the half of that line worth printing, and it is all that is left.
 *   - the seed bar down the side of a row. It meant the same thing as the
 *     leader-box threats, and the single sentence that taught it went with
 *     the prose, leaving a mark nobody could read.
 *   - three paragraphs of prose: the podium mark legend, the M1 / W1
 *     explanation over the result, and NOBODY IS DROPPED FROM THE SHEET.
 *     The owner test is the reason and it is a good one — if a thing needs
 *     a paragraph to explain it, fix the thing. So the bracket letter in the
 *     Br column now matches the letter in the place mark (it printed F
 *     against a mark reading W1), and the sole remaining reason a name has
 *     no time says DID NOT FINISH in the time column, in words.
 *   - every signed plus and minus against a best coming in. In their place
 *     ONE MARK: a PR tag beside the name of anybody who went faster tonight
 *     than they ever have. See isPr() in types.ts.
 *
 * AND THE ONE THING HE ASKED FOR RATHER THAN ASKED OFF: the grid is now the
 * control. Tap wave 1 and the lane panel under it becomes wave 1, with the
 * times of anybody who has actually rowed. See WavePicker, and pickedWave()
 * in types.ts for what the panel shows when nobody has touched it — which on
 * a television is always.
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

/* THE PR MARK, and the only mark this board hands out for a time measured
 * against a rower's own history. It replaced vsBest(), which printed a
 * signed -0:20.6 / +0:01.4 in four places and needed a sentence of legend to
 * say which sign was the good one. A tag either sits beside a name or it
 * does not, and PR needs no explaining to anybody who has ever rowed.
 *
 * IT SURVIVES THE PHONE, which a column could not: Br, BEST COMING IN, /500
 * and the old VS BEST are all .rr-hx and vanish under 620px, so the one
 * screen the owner reads the board on would have been the one screen with
 * no mark on it. This rides in the name cell. */
function PrTag({ racer }: { racer: ResultRacer }) {
  if (!isPr(racer)) return null;
  return <span className="rr-tag pr">PR</span>;
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

/* LEADING, MID-RACE ONLY. Both the page and the wall draw this inside their
 * !final branch — the finished board hands the same story to the podium — so
 * there is no Won / Final arm here any more, and no chip: the word
 * PROVISIONAL came off (owner, 2026-09-11) and what is left saying it is the
 * blinking square in the dateline, the freshness line, the withheld podium
 * fill on the place marks, the N OF N ROWED beside this heading and sixteen
 * empty rows in the table below. Five signals; the label was the sixth. */
export function LeaderBox({ board, view }: { board: ResultBoard; view: BracketView }) {
  const lead = view.leader;
  return (
    <div className="rr-box lead">
      <p className="rr-eye">
        <span>Leading · {view.label}</span>
        <span className="rt">
          {view.rowed} of {view.all.length} rowed
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
          {/* The leader box is the mid-race podium, so it wears the mid-race
            * podium's mark. Without it the wall carried no PR anywhere until
            * the sheet went up, and the tag has to mean the same thing on
            * every screen or it means nothing on any of them. */}
          <p className="rr-meta">
            <b>{fmtSplitFor(board.meters, lead.seconds ?? 0)}</b> /500 · Wave {lead.wave}
            <PrTag racer={lead} />
          </p>
        </>
      )}
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

/* THE THREE-CELL COUNTER IS GONE (owner, 2026-09-11: I probably do not need
 * the number that is already rowed, number still to come, stuff like that.
 * Like, that is not needed). It stood under the lane strip on the page and
 * as THE ROOM column on the wall, and both are the same three numbers the
 * board was already spending a line on underneath. The .rr-count / .rr-cell
 * markup it shared did NOT die with it — the finished wall still hand-rolls
 * a counter out of those classes in CastFrame, with the fastest piece, the
 * finishers and the metres. Only the .live mark went, since that strip was
 * the one place a cell counted something still happening. */

/* ---- the wave picker ------------------------------------------------- */

/* THE GRID IS THE CONTROL (owner, 2026-09-11: I like the idea of being able
 * to click on the grid sections and seeing the different waves — click on
 * wave one and then see the names up above change with their times whenever
 * they have actually done them).
 *
 * WHAT WENT, and it was three components drawing one wave between them:
 *   LANESTRIP  it is the panel now. It was welded to liveWave(), so it
 *              returned NOTHING the moment nobody was pulling: for the
 *              twenty-odd minutes between an eight minute piece and the next
 *              wave going off the top of the board reflowed and a television
 *              clipped at 720 was left with a hole. Closing that is a fix,
 *              not a side effect — see pickedWave() in types.ts.
 *   WAVEGRID   it is the tab strip now. Same five cells, same marks; the
 *              whole tile is simply a radio button as well.
 *   ONTHEERGS  deleted. The panel head four inches below it printed the same
 *              wave, the same start stamp, the same elapsed clock and how
 *              many were rowing, with eight names attached. This change made
 *              that box a duplicate, so this change removes it. The leader
 *              pair it sat in is .rr-two now rather than .rr-three.
 *
 * NO JAVASCRIPT. No client component, no state hook, no event handler, no
 * bundle: it is a native radio group plus a sibling selector in rrCss.ts,
 * which is what keeps the cast frame a plain server-rendered document on
 * whatever browser is bolted to the television. The keyboard story comes free
 * and correct — one tab stop, arrows move and select, the focus ring is the
 * whole tile because the input is stretched over it.
 *
 * THE PANEL SITS UNDER THE CELLS, not above them as he described it. The pane
 * is 562px tall on a 320px screen, so a panel above the cells means a tap
 * changes something largely off the top of the phone, which reads as broken.
 * The thing that changes has to be beside the thumb that changed it, and the
 * bar under the chosen cell points DOWN at the panel it opened so the
 * direction is stated rather than assumed.
 *
 * A PICK LIVES IN THE DOM, NOT IN THE URL, so a route refresh returns to the
 * computed default. Nothing on this page refreshes today; the day the cast
 * frame gets the poll it already asks for, move the pick into ?wave=N — which
 * this already reads, and which is how a gym pins one wave to the wall. */
const WAVE_GROUP = "rr-wave";

export function WavePicker({
  board,
  cast,
  pick,
}: {
  board: ResultBoard;
  cast?: boolean;
  pick?: number | null;
}) {
  const chosen = pickedWave(board, pick);
  const you = cast ? null : racerById(board, board.youId);
  const next = nextWave(board);
  /* The column count travels as a custom property for the same reason the
   * lane count does: the frame is clipped at 720, and a grid whose width is
   * typed into the stylesheet wraps to a second row and falls off the
   * television with no error the night the floor runs six waves. */
  const style = { "--rr-waves": board.waves.length } as CSSProperties;
  return (
    /* ONE BLOCK, caption and cells together. The cast frame is a flex column
     * with justify-content:space-between, so a caption returned as a loose
     * sibling of the grid got the frame slack dealt out BETWEEN them and
     * floated forty pixels above the thing it names. */
    <div className="rr-pick">
      {cast ? (
        <p className="rr-castk">
          The grid · {board.waves.length} waves · {board.ergs} ergs
          {next ? ` · next off at ${fmtClock(next.scheduledAtMs)}` : ""}
        </p>
      ) : (
        /* ONE WORD OF AFFORDANCE. A phone gets no hover, so a card that can
         * be tapped has to say so once. The wall gets the neutral caption
         * instead — nobody taps a television. */
        <p className="rr-pickk">
          <span>
            The grid · {board.waves.length} waves · {board.ergs} ergs
          </span>
          <span className="rt">Tap a wave</span>
        </p>
      )}
      {/* role=group, NOT role=radiogroup: the panes live inside the same grid
        * element, and a radiogroup with eight lane blocks inside it is a lie.
        * The cells and panes are INTERLEAVED so the open pane is an adjacent
        * sibling of its own cell; the stylesheet puts every cell on row 1 and
        * every pane on row 2 across all columns. */}
      <div className="rr-sel" style={style} role="group" aria-label="The waves">
        {board.waves.map((w) => (
          <Fragment key={w.wave}>
            <WaveCell
              board={board}
              w={w}
              open={w.wave === chosen}
              yours={you !== null && you.wave === w.wave}
              cast={cast}
            />
            <WavePane board={board} w={w} open={w.wave === chosen} you={you} cast={cast} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* A CELL IS THE WHOLE HIT AREA. The radio is stretched over the tile rather
 * than drawn as a 13px dot beside it, so a thumb cannot miss and a keyboard
 * ring lands on the thing it is choosing. On the wall there is no input at
 * all and nothing is focusable: nobody standing in front of a television is
 * holding a keyboard. */
function WaveCell({
  board,
  w,
  open,
  yours,
  cast,
}: {
  board: ResultBoard;
  w: ResultWave;
  open: boolean;
  yours: boolean;
  cast?: boolean;
}) {
  const field = inWave(board, w.wave);
  const done = ranked(field);
  const elapsed = fmtElapsed(w.startedAtMs, board.nowMs);
  const state = w.state === "rowed" ? "done" : w.state === "on_the_ergs" ? "live" : "soon";
  /* NAMED .pick AND NOT .on, because the state word `soon` contains the
   * substring `on` and a careless selector would match it. */
  const cls = `rr-cw ${state}${yours ? " yours" : ""}${open ? " pick" : ""}`;
  const body = (
    <>
      {!cast && (
        <input className="rr-hit" type="radio" name={WAVE_GROUP} defaultChecked={open} />
      )}
      <p className="rr-cwk">Wave</p>
      <p className="rr-wn">{w.wave}</p>
      {/* .rr-hx: the detail leaves the tile on a phone, where five cells
        * across 335px is a segmented control and the panel it opens is
        * carrying all of this anyway. */}
      <p className="rr-cws rr-hx">
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
      {/* The tongue that bridges the 10px gap down to the panel. A real span,
        * not a pseudo element: content needs a quoted value and rrCss.ts is
        * a style-tag template that cannot hold a quote. */}
      <span className="rr-nub" aria-hidden="true" />
    </>
  );
  return cast ? <div className={cls}>{body}</div> : <label className={cls}>{body}</label>;
}

/* THE PANEL HEAD, and THE STATE WORD LEADS IT. A reader can park the panel on
 * wave 1 while wave 3 is pulling, so a settled wave that opened with a clock
 * would read as the live one. Rowed, on the ergs and to come each say which
 * they are first and put the numbers after.
 *
 * THE FASTEST AND THE AVERAGE COME OFF waveLineOf(), the same ledger the
 * night table prints, so a head can never disagree with the table below it. */
function paneHead(board: ResultBoard, w: ResultWave): string {
  if (w.state === "rowed") {
    const line = waveLineOf(board, w.wave);
    const bits = [`Rowed · off at ${fmtClock(w.startedAtMs ?? w.scheduledAtMs)}`];
    if (line?.fastest) bits.push(`fastest ${fmtTime(line.fastest.seconds ?? 0)}`);
    if (line && line.averageSeconds !== null) bits.push(`average ${fmtTime(line.averageSeconds)}`);
    return bits.join(" · ");
  }
  if (w.state === "on_the_ergs") {
    /* NO START STAMP, NO CLOCK. A wave that went late must never be counted
     * from the schedule, or it reads as nearly finished. */
    if (w.startedAtMs === null) return "On the ergs · start not stamped";
    const elapsed = fmtElapsed(w.startedAtMs, board.nowMs);
    return `On the ergs · started ${fmtClock(w.startedAtMs)}${elapsed ? ` · ${elapsed} elapsed` : ""}`;
  }
  const sheet = inWave(board, w.wave).length;
  const mins = Math.round((w.scheduledAtMs - board.nowMs) / 60000);
  const when = mins > 0 ? `${mins} min from now` : "due now";
  return `To come · due ${fmtClock(w.scheduledAtMs)} · ${sheet} on the sheet · ${when}`;
}

/* THE FOURTH LINE IN A LANE, and it is keyed off the RACER and not the wave,
 * so every combination is honest including ones this sample cannot produce —
 * somebody who walked away from a wave that is still on the ergs.
 *
 * A TIME IS A FACT AND A SEED IS A PROMISE, so they are drawn differently
 * (rrCss.ts): the time white, bold and tabular, the seed at the grey floor in
 * the eye size. That difference is the owner test applied — where a legend was
 * load-bearing, make the mark self-evident instead of keeping the paragraph.
 *
 * A WAVE ON THE ERGS GETS NO FOURTH LINE AT ALL. They all started together,
 * so there is ONE clock and it lives in the head; eight identical elapsed
 * clocks down the lanes would be eight copies of one fact. */
type LaneValue = { text: string; tone: "time" | "seed" | "out"; pr: boolean };

function laneValue(r: ResultRacer | null): LaneValue | null {
  if (r === null) return null;
  if (r.status === "finished" && r.seconds !== null) {
    return { text: fmtTime(r.seconds), tone: "time", pr: isPr(r) };
  }
  if (r.status === "rowing") return null;
  if (r.status === "dnf") return { text: "Did not finish", tone: "out", pr: false };
  return {
    text: r.best5k ? `Best in ${fmtTime(r.best5k.seconds)}` : "First 5k",
    tone: "seed",
    pr: false,
  };
}

/* ONE WAVE, LANE BY LANE. Always board.ergs of them, an erg with nobody
 * assigned DRAWN and not skipped so the room can see the empty seat.
 *
 * NO PLACE MARK IN A LANE. Mid-race a place is provisional and the table
 * withholds the fill to say so; a bare M1 in a lane would carry no such
 * context and would read settled. Placing is the table's job — the lane says
 * who was on which erg and what they pulled. */
function WavePane({
  board,
  w,
  open,
  you,
  cast,
}: {
  board: ResultBoard;
  w: ResultWave;
  open: boolean;
  you: ResultRacer | null;
  cast?: boolean;
}) {
  const field = inWave(board, w.wave);
  const lanes = Array.from({ length: board.ergs }, (_, i) => {
    const lane = i + 1;
    return { lane, racer: field.find((r) => r.lane === lane) ?? null };
  });
  return (
    <div className={open ? "rr-pane pick" : "rr-pane"}>
      <p className="rr-eye">
        {/* THE LIVE SQUARE IS DRAWN IN ONE PLACE ONLY — inside the pane of
          * the wave that is actually on the ergs. With no JavaScript that is
          * trivially correct: the square is in one wave's markup and nowhere
          * else, so a panel parked on a settled wave can never wear it. */}
        {w.state === "on_the_ergs" && <span className="rr-sq" aria-hidden="true" />}
        <span>Wave {w.wave} · lane by lane</span>
        <span className="rt">{paneHead(board, w)}</span>
      </p>
      <div className="rr-lanes">
        {lanes.map(({ lane, racer }) => {
          const v = laneValue(racer);
          return (
            <div className={racer === null ? "rr-lane open" : "rr-lane"} key={lane}>
              <p className="rr-ln">Lane {lane}</p>
              <p className="rr-lname">
                {racer ? castName(racer.name, cast) : "Erg open"}
                {racer !== null && you !== null && racer.id === you.id && (
                  <span className="rr-tag you">You</span>
                )}
              </p>
              <p className="rr-lsub">
                {racer === null
                  ? "No entry"
                  : `${no(racer.rowerNumber)} · ${brLetter(racer.bracket)}`}
              </p>
              {v && (
                <p className={v.tone === "time" ? "rr-lval" : `rr-lval ${v.tone}`}>
                  {v.text}
                  {v.pr && <span className="rr-tag pr">PR</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
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
      {brLetter(racer.bracket)}
      {p}
    </span>
  );
}

/* DID NOT START LEFT THIS CELL WITH THE STATUS. Did not finish stays, and it
 * is now the only reason a row on the sheet carries a name and no time —
 * which is exactly why the sentence that used to sit above those rows
 * explaining that nobody is dropped could go. One status word in the time
 * column says it; two of them needed a paragraph. */
function TimeCell({ racer }: { racer: ResultRacer }) {
  if (racer.status === "finished" && racer.seconds !== null) {
    return <td className="tm">{fmtTime(racer.seconds)}</td>;
  }
  if (racer.status === "rowing") return <td className="st now">Rowing</td>;
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
  /* The signed ON BEST clause came off this line with every other plus and
   * minus; the split stays, and the PR tag above it carries what the sign
   * was for. On a phone this sub-line IS the Br, seed and /500 columns. */
  const sub =
    racer.status === "finished" && racer.seconds !== null
      ? `${fmtSplitFor(board.meters, racer.seconds)} /500`
      : racer.best5k
        ? `Best in ${fmtTime(racer.best5k.seconds)}`
        : "First 5k";
  return (
    <td className="nm">
      {racer.name}
      {you && <span className="rr-tag you">You</span>}
      <PrTag racer={racer} />
      <span className="rr-sub">{sub}</span>
    </td>
  );
}

/* THE FIELD, grouped by wave: every racer from the moment the field is set,
 * a row that never moves, and a time that appears when they pull. */
export function FieldTable({ board }: { board: ResultBoard }) {
  const lastRowed = [...board.waves].filter((w) => w.state === "rowed").pop() ?? null;
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
      /* THE SEED BAR IS GONE from this list. It marked anybody still to row
       * whose fastest 5k on record was under the leading time — the same
       * fact the leader-box foot was cut for — and the only thing that ever
       * said what the bar meant was a sentence of the prose over the table,
       * cut in the same pass. A bar with nothing to teach it is noise. */
      const cls = [r.status === "rowing" ? "live" : "", you ? "mine" : ""]
        .filter(Boolean)
        .join(" ");
      rows.push(
        <tr className={cls || undefined} key={r.id}>
          <td className="pl">
            <PlaceMark board={board} racer={r} />
          </td>
          <td className="no">{fmtRowerNumber(r.rowerNumber)}</td>
          <NameCell board={board} racer={r} you={you} />
          <td className="br rr-hx">{brLetter(r.bracket)}</td>
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
     * dashes. THE GLOSS THAT RODE ON IT IS GONE (N STILL TO GO · N SEEDED
     * UNDER THE LEAD · N WITH NO 5K ON RECORD): it was the still-to-come
     * count and the no-5k callout the owner cut off the leader boxes, in
     * smaller type. The rule is the mark; it needed no caption. */
    if (lastRowed !== null && w.wave === lastRowed.wave) {
      rows.push(
        <tr className="rule" key="rule">
          <th colSpan={7} scope="colgroup">
            The field below the rule has not rowed
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
  /* A NAME WITH NO TIME, and there is now exactly one kind: somebody who sat
   * down and stopped. The no-shows used to be here beside them under a rule
   * reading NOBODY IS DROPPED FROM THE SHEET; they are marked when the waves
   * are assigned now and never enter the field, so the rule went with them
   * and DID NOT FINISH in the time column is left to speak for itself. */
  const out = board.racers.filter((r) => r.status === "dnf");
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
          {/* NINE COLUMNS, NOW EIGHT. VS BEST held the signed -0:20.6 that
            * needed a legend to say which sign was the good one, and it was
            * .rr-hx besides, so the phone never saw it. The PR tag beside
            * the name says the half of it worth saying, everywhere. */}
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
            <td className="br rr-hx">{brLetter(r.bracket)}</td>
            <td className="seed rr-hx">{seedText(r)}</td>
            <TimeCell racer={r} />
            <td className="dim rr-hx">{fmtSplitFor(board.meters, r.seconds ?? 0)}</td>
            <td className="dim rr-hx">{r.wave}</td>
          </tr>
        ))}
        {out.map((r) => (
          <tr key={r.id}>
            <td className="pl">
              <span className="rr-pl">{DASH}</span>
            </td>
            <td className="no">{fmtRowerNumber(r.rowerNumber)}</td>
            <NameCell board={board} racer={r} you={r.id === board.youId} />
            <td className="br rr-hx">{brLetter(r.bracket)}</td>
            <td className="seed rr-hx">{seedText(r)}</td>
            <TimeCell racer={r} />
            <td className="dim rr-hx">{DASH}</td>
            <td className="dim rr-hx">{r.wave}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- the podium ------------------------------------------------------ */

/* No `cast` prop any more: it existed only to keep the signed ON THEIR BEST
 * COMING IN line off the television, and that line is gone from both. */
export function Podium({ board, view }: { board: ResultBoard; view: BracketView }) {
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
            {/* The second line of this block used to print -0:20.6 ON THEIR
              * BEST COMING IN, on the page only. It is one tag now, and the
              * wall gets it too: a podium finisher who went faster than they
              * ever have is worth a mark from across a gym. */}
            <p className="rr-pm">
              {no(racer.rowerNumber)} · <b>{fmtSplitFor(board.meters, racer.seconds ?? 0)}</b> /500 ·
              Wave {racer.wave}
              <PrTag racer={racer} />
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
      k: "Fastest 5,000 m in the room",
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
   * figure the site can actually compute is the one printed.
   *
   * THE LAST SIGNED NUMBER ON THE BOARD, and it was considered in the pass
   * that removed the rest. It stays because it is a CALLOUT and not a mark:
   * it names one rower, prints both her times underneath, and reads as a
   * gain rather than as a symbol a reader has to be taught. */
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

  /* THE TALLY OF THE MARK. It was SEPTEMBER BESTS SET · 29 OF 33 with a
   * gloss underneath counting who came in with no 5k on record — the same
   * zero-fives callout the owner cut off the leader boxes, and a denominator
   * that only existed to be explained. Named for the mark instead, it is
   * what makes the tag self-evident with no legend: count the PR tags down
   * the sheet and you get this number. */
  notes.push({
    k: "Personal records set",
    v: `${all.filter(isPr).length}`,
    n: "marked PR on the sheet",
  });

  const c = roomCounts(board.racers);
  notes.push({
    k: "The field",
    v: `${c.field} racers`,
    n: `${bracketView(board, "M").all.length} men · ${bracketView(board, "F").all.length} women · ${board.waves.length} waves · ${board.ergs} ergs`,
  });
  /* The gloss used to add DID NOT START and DID NOT FINISH to the finisher
   * count. Nobody reads a metres figure to find out who stopped, and the
   * sheet twenty inches below prints DID NOT FINISH against the one name. */
  notes.push({
    k: "Metres pulled",
    v: (c.rowed * board.meters).toLocaleString(),
    n: `${c.rowed} finished`,
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
  const w = waveOf(board, you.wave);
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
          {bracketView(board, you.bracket).ranked.length}
          {/* ON YOUR BEST COMING IN, signed, used to close this line. It is
            * the line a rower screenshots, so it is where the one mark that
            * replaced every signed number earns the most. */}
          <PrTag racer={you} />
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

export function RaceResults({
  board,
  note,
  pick,
}: {
  board: ResultBoard;
  note?: ReactNode;
  /* ?wave=N — a deep link on a phone, and how a gym pins one wave. It beats
   * the computed default; see pickedWave() in types.ts. */
  pick?: number | null;
}) {
  const final = board.state === "finished";
  const men = bracketView(board, "M");
  const women = bracketView(board, "F");
  const c = roomCounts(board.racers);
  const next = nextWave(board);

  return (
    <div className="rr-dark">
      <section>
        <div className="rr-wrap">
          {note}
          <Dateline board={board} />
          <YouStrip board={board} />

          {final ? null : (
            <>
              {/* TWO BOXES, NOT THREE. ON THE ERGS NOW was the third, and the
                * wave panel a few inches below prints the same wave, the same
                * start stamp and the same elapsed clock with eight names
                * attached. The picker created that duplicate, so the picker
                * removes it. */}
              <div className="rr-two">
                <LeaderBox board={board} view={men} />
                <LeaderBox board={board} view={women} />
              </div>
              {/* THE PICKER GOES IN THE SLOT THE COUNTER STRIP VACATED, so
                * the top of the board does not grow, and the cells and the
                * panel they open TOUCH. The standalone grid section that used
                * to sit three hundred pixels and a section boundary further
                * down is deleted: a control that far from the thing it
                * controls is not an interaction. Its mono subtitle is the
                * caption inside the picker now. */}
              <WavePicker board={board} pick={pick} />
              {/* WHAT IS NEXT, and nothing else. This line carried the room
                * counts as well — N OF N HAVE ROWED · N ON THE ERGS · N
                * STILL TO COME · N DID NOT START — under a three-cell
                * counter that had just said the same thing bigger. Both went
                * (owner, 2026-09-11). The wave and the time it goes off is
                * the half a rower standing in the gym needs. It is rendered
                * only when there IS a next wave, or the last wave of the
                * night left an empty bar ruled across the page. */}
              {next && (
                <p className="rr-next">
                  Next ·{" "}
                  <b>
                    Wave {next.wave} at {fmtClock(next.scheduledAtMs)}
                  </b>
                </p>
              )}
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
              {/* THE MARK LEGEND STOOD HERE and it is gone (owner,
                * 2026-09-11: if we need this much text to explain something,
                * it is probably not good). It taught four things and three
                * of them did not need it: the podium blocks already spell
                * 1ST / 2ND / 3RD across the top of each card, and the place
                * marks down the sheet carry the numeral itself. The fourth
                * was the signed vs-best, which went with the numbers. What
                * DID need a fix rather than a paragraph was the letter: the
                * mark read W1 while the Br column beside it read F, and only
                * this sentence reconciled them. The column says W now. */}
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
                {/* The waves and the ergs come off the picker caption twenty
                  * pixels below this line now, so the head keeps the one fact
                  * the picker does not print. */}
                <span className="mono">Every wave · {board.waveMinutes} minutes apart</span>
              </div>
              {/* THE PICKER AND THE LEDGER SIT IN ONE SECTION, and the table
                * stays: the panel is how ONE wave ran with the names
                * attached, the table is how the five compare side by side,
                * which a panel showing one at a time cannot do. Both route
                * their fastest and their average through waveLines, so they
                * can never disagree. On a finished sheet the panel opens on
                * YOUR wave — the first reader of a result is a rower looking
                * for themselves. */}
              <WavePicker board={board} pick={pick} />
              <NightTable board={board} />
            </div>
          </section>
        </>
      )}

      {/* THE STANDALONE GRID SECTION STOOD HERE, mid-race only, three hundred
        * pixels below the lane strip it described. The cells are the control
        * now and they live directly on top of the panel they open, up in the
        * first section. */}

      <section>
        <div className="rr-wrap">
          <div className="sec-head">
            <h2>{final ? "The result" : "The field"}</h2>
            <span className="mono">
              {c.field} racers · {men.all.length} men · {women.all.length} women
            </span>
          </div>
          {/* BOTH PARAGRAPHS THAT STOOD HERE ARE GONE. The finished one
            * explained M1 and W1 — the caption on the table below says one
            * room sorted by time, scored apart, in a line, and the mark now
            * wears the same letter as the Br column. The mid-race one
            * explained that empty rows fill in (the sixteen empty rows do
            * that themselves), counted how many were still to come (a count
            * the owner cut everywhere else on the board), and was the only
            * thing that ever explained the seed bar — so the bar went with
            * the sentence rather than standing there unreadable. */}
          {final ? <ResultTable board={board} /> : <FieldTable board={board} />}
        </div>
      </section>
    </div>
  );
}
