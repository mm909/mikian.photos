import { Fragment, type CSSProperties, type ReactNode } from "react";

import {
  boardRacers,
  bracketView,
  brLetter,
  fmtAgo,
  fmtClock,
  fmtElapsed,
  fmtGap,
  fmtRaceTime,
  fmtSeed,
  fmtSplitFor,
  inWave,
  nextWave,
  ordinal,
  pickedWave,
  placeOf,
  podium,
  raceTag,
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
import { ShareTime, type ShareRacer } from "./ShareTime";

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
 * in types.ts for what the panel shows when nobody has touched it.
 *
 * WHAT CAME OFF, 2026-09-16, the owner again:
 *   - every wave time is the SCHEDULED one and the phrase OFF AT is gone
 *     ("wave one starts at 6:16 but it should just be 6:15"). The elapsed
 *     clock on the wave on the ergs still runs off the real start stamp;
 *     the stamp itself is printed nowhere.
 *   - the bib text (No. 019): the no() helper beside a name, and the No.
 *     column on both tables.
 *   - WORTH SAYING / WHAT THE TABLE BURIES, the whole section.
 *   - anybody who did not row: a DNF, and on a finished sheet anyone with
 *     no time, is off every table, podium, count and lane (types.ts
 *     boardRacers). The DID NOT FINISH arm went with them.
 *   - the wall is clickable: the cells on the television take a click too
 *     (CastPicker.tsx owns the pick; this file only wires onPick).
 *
 * THE FINISHED SHEET IS THE ARCHIVE (owner, 2026-10-01, the week after the
 * race, reading it on his phone). What changed, all of it his list:
 *   - PUBLIC AND IMPERSONAL. The YOU strip, the YOU tag, the highlighted
 *     row and the open-on-your-wave default are gone from the finished
 *     sheet (mid-race keeps them: a rower in the gym looking for their
 *     wave is a different page). The one personal thing left is SHARE YOUR
 *     TIME (ShareTime.tsx), which puts the signed-in racer first in its
 *     list and marks nothing on the page.
 *   - NO DATELINE. No FINAL 12:00 AM clock, no SHEET POSTED, no freshness
 *     line — the archive header (ArchiveHead.tsx, handed in as `head`) says
 *     the name, the day, the place and the two houses, and the rest is
 *     just the results.
 *   - WHOLE SECONDS, FLOORED, everywhere (types.ts fmtRaceTime): 21:41.1
 *     prints 21:41, a split 2:10.3 prints 2:10. The tenths still decide the
 *     order underneath; nothing is re-sorted after the floor.
 *   - MEN / WOMEN as mono caps labels, not THE MEN / THE WOMEN in the
 *     display face; the counts and SCORED APART are gone with them.
 *   - THE ORDER: the header, then the results (one table per bracket, in
 *     place order), then the waves (the picker and HOW THE NIGHT RAN), then
 *     the winners (1st, 2nd, 3rd, and no fourth line).
 *   - THE SEED wears an asterisk when it is prorated off a longer row, and
 *     never the word; a finisher with no seed at all is tagged FIRST 5K
 *     where PR would go (types.ts raceTag).
 *   - TEN LANES, two rows of five on a laptop and a ruled list on a phone,
 *     drawn in full for every wave so the pane never changes height when a
 *     cell is tapped: an empty lane prints a dash and keeps its rows.
 *
 * The components take a plain serialisable model (types.ts) and never read
 * the database, so the real page can hand them real rows unchanged. */

const DASH = "—";

/* THE PR MARK, and the only mark this board hands out for a time measured
 * against a rower's own history. It replaced vsBest(), which printed a
 * signed -0:20.6 / +0:01.4 in four places and needed a sentence of legend to
 * say which sign was the good one. A tag either sits beside a name or it
 * does not, and PR needs no explaining to anybody who has ever rowed.
 *
 * FIRST 5K rides the same slot (owner, 2026-10-01): a finisher with no
 * 5,000 m before the race is not an absence of a mark, it is a mark. The
 * rule is types.ts raceTag, one answer for every surface.
 *
 * IT SURVIVES THE PHONE, which a column could not: Br, BEST COMING IN, /500
 * and the old VS BEST are all .rr-hx and vanish under 620px, so the one
 * screen the owner reads the board on would have been the one screen with
 * no mark on it. This rides in the name cell. */
function Tag({ racer }: { racer: ResultRacer }) {
  const tag = raceTag(racer);
  if (tag === null) return null;
  return <span className={tag === "PR" ? "rr-tag pr" : "rr-tag first"}>{tag}</span>;
}

/* ---- the dateline (mid-race only) ------------------------------------ */

/* The finished sheet has no dateline any more (owner, 2026-10-01): the
 * archive header carries the day and the place, and FINAL / SHEET POSTED
 * said nothing a reader of a posted sheet needed. Mid-race it is still the
 * clock the room reads. */
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

/* ---- the labels ------------------------------------------------------ */

/* MONO CAPS, NOT THE DISPLAY FACE (owner, 2026-10-01: not THE MEN / THE
 * WOMEN in Archivo Black; the mono caps label style the rest of the page
 * uses). Two weights of the same thing: a section word over a 2px rule,
 * and a bracket word over a hairline inside it. */
function Section({ children }: { children: ReactNode }) {
  return <p className="rr-sec">{children}</p>;
}

function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <p className="rr-lab">
      <span>{children}</span>
      {right !== undefined && <span className="rt">{right}</span>}
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
          <p className="rr-big">{fmtRaceTime(lead.seconds ?? 0)}</p>
          <p className="rr-who">{lead.name}</p>
          {/* The leader box is the mid-race podium, so it wears the mid-race
            * podium's mark. Without it the wall carried no PR anywhere until
            * the sheet went up, and the tag has to mean the same thing on
            * every screen or it means nothing on any of them. */}
          <p className="rr-meta">
            <b>{fmtSplitFor(board.meters, lead.seconds ?? 0)}</b> /500 · Wave {lead.wave}
            <Tag racer={lead} />
          </p>
        </>
      )}
    </div>
  );
}

/* Ten lanes across a 1280 frame is not much room: a long name is cut to a
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
 * NO JAVASCRIPT ON THE PAGE. No state hook, no event handler, no bundle: it
 * is a native radio group plus a sibling selector in rrCss.ts. The keyboard
 * story comes free and correct — one tab stop, arrows move and select, the
 * focus ring is the whole tile because the input is stretched over it.
 *
 * THE WALL IS THE EXCEPTION NOW (owner, 2026-09-16: when I click on a wave
 * in the cast view I should see the info change). It has no radio — nothing
 * focusable on a television — so a cell there takes `onPick`, and the thin
 * client wrapper in CastPicker.tsx owns the picked wave. With scripting off
 * the wall is exactly what it was: the server default, one open pane.
 *
 * THE PANEL SITS UNDER THE CELLS, not above them as he described it. The pane
 * is 562px tall on a 320px screen, so a panel above the cells means a tap
 * changes something largely off the top of the phone, which reads as broken.
 * The thing that changes has to be beside the thumb that changed it, and the
 * bar under the chosen cell points DOWN at the panel it opened so the
 * direction is stated rather than assumed.
 *
 * A PICK LIVES IN THE DOM, NOT IN THE URL. The real page polls now
 * (raceday/results/Refresh.tsx, router.refresh() every thirty seconds while
 * the sheet is open), and a pick survives it: the radio is uncontrolled
 * client state on the page and useState in CastPicker on the wall, and
 * router.refresh() keeps both. The move into ?wave=N once proposed here is
 * not needed; ?wave=N stays what it was, the deep link a gym pins one wave
 * to the wall with. A full reload still returns to the computed default.
 *
 * THE PANE NEVER CHANGES HEIGHT (owner, 2026-10-01). Every wave draws every
 * lane — board.ergs of them, ten on the night — with the same four rows in
 * each, a dash where nobody sat, the name on one line and cut if it has to
 * be; so tapping 1, 2, 3 moves names and times and nothing else. The YOURS
 * bar on a cell is gone with the rest of the viewer marks. */
const WAVE_GROUP = "rr-wave";

export function WavePicker({
  board,
  cast,
  pick,
  onPick,
}: {
  board: ResultBoard;
  cast?: boolean;
  pick?: number | null;
  /* Wall only: a cell was clicked. Never passed on the page, where the
   * radio group does the picking with no script at all. */
  onPick?: (wave: number) => void;
}) {
  const chosen = pickedWave(board, pick);
  const next = nextWave(board);
  /* The column count travels as a custom property for the same reason the
   * lane count does: the frame is clipped at 720, and a grid whose width is
   * typed into the stylesheet wraps to a second row and falls off the
   * television with no error the night the floor runs six waves. */
  const style = { "--rr-waves": board.waves.length } as CSSProperties;
  /* ROWING MACHINES, not ergs, in anything a rower reads. */
  const grid = `${board.waves.length} waves · ${board.ergs} rowing machines`;
  return (
    /* ONE BLOCK, caption and cells together. The cast frame is a flex column
     * with justify-content:space-between, so a caption returned as a loose
     * sibling of the grid got the frame slack dealt out BETWEEN them and
     * floated forty pixels above the thing it names. */
    <div className="rr-pick">
      {cast ? (
        <p className="rr-castk">
          {grid}
          {next ? ` · next wave ${fmtClock(next.scheduledAtMs)}` : ""}
        </p>
      ) : (
        /* ONE WORD OF AFFORDANCE. A phone gets no hover, so a card that can
         * be tapped has to say so once. The wall gets the neutral caption
         * instead — nobody taps a television. */
        <p className="rr-pickk">
          <span>{grid}</span>
          <span className="rt">Tap a wave</span>
        </p>
      )}
      {/* role=group, NOT role=radiogroup: the panes live inside the same grid
        * element, and a radiogroup with ten lane blocks inside it is a lie.
        * The cells and panes are INTERLEAVED so the open pane is an adjacent
        * sibling of its own cell; the stylesheet puts every cell on row 1 and
        * every pane on row 2 across all columns. */}
      <div className="rr-sel" style={style} role="group" aria-label="The waves">
        {board.waves.map((w) => (
          <Fragment key={w.wave}>
            <WaveCell board={board} w={w} open={w.wave === chosen} cast={cast} onPick={onPick} />
            <WavePane board={board} w={w} open={w.wave === chosen} cast={cast} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* A CELL IS THE WHOLE HIT AREA. The radio is stretched over the tile rather
 * than drawn as a 13px dot beside it, so a thumb cannot miss and a keyboard
 * ring lands on the thing it is choosing. On the wall there is no input at
 * all and nothing is focusable — nobody standing in front of a television is
 * holding a keyboard — but the tile takes a click (onPick). */
function WaveCell({
  board,
  w,
  open,
  cast,
  onPick,
}: {
  board: ResultBoard;
  w: ResultWave;
  open: boolean;
  cast?: boolean;
  onPick?: (wave: number) => void;
}) {
  const field = inWave(board, w.wave);
  const done = ranked(field);
  const elapsed = fmtElapsed(w.startedAtMs, board.nowMs);
  const state = w.state === "rowed" ? "done" : w.state === "on_the_ergs" ? "live" : "soon";
  /* NAMED .pick AND NOT .on, because the state word `soon` contains the
   * substring `on` and a careless selector would match it. */
  const cls = `rr-cw ${state}${open ? " pick" : ""}`;
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
        <b>{fmtClock(w.scheduledAtMs)}</b>
        <br />
        {w.state === "rowed" ? (
          <>
            Rowed
            {done[0] ? (
              <>
                <br />
                Best {fmtRaceTime(done[0].seconds ?? 0)}
              </>
            ) : null}
          </>
        ) : w.state === "on_the_ergs" ? (
          <>
            Rowing
            {elapsed ? (
              <>
                <br />
                {elapsed} elapsed
              </>
            ) : null}
          </>
        ) : (
          <>{field.length} racers</>
        )}
      </p>
      {/* The tongue that bridges the 10px gap down to the panel. A real span,
        * not a pseudo element: content needs a quoted value and rrCss.ts is
        * a style-tag template that cannot hold a quote. */}
      <span className="rr-nub" aria-hidden="true" />
    </>
  );
  if (!cast) return <label className={cls}>{body}</label>;
  /* A handler is not markup, so the wall's first paint is the same with and
   * without one; only the cursor (rrCss.ts) says the tile can be pressed. */
  return (
    <div className={cls} onClick={onPick ? () => onPick(w.wave) : undefined}>
      {body}
    </div>
  );
}

/* THE PANEL HEAD, and THE STATE WORD LEADS IT. A reader can park the panel on
 * wave 1 while wave 3 is pulling, so a settled wave that opened with a clock
 * would read as the live one. Rowed, on the machines and to come each say
 * which they are first and put the numbers after.
 *
 * THE FASTEST AND THE AVERAGE COME OFF waveLineOf(), the same ledger the
 * night table prints, so a head can never disagree with the table below it.
 *
 * NO STAMP. OFF AT and STARTED went (owner, 2026-09-16): the cell above the
 * panel already prints the scheduled time, and the real start stamp is only
 * ever the thing the elapsed clock counts from. */
function paneHead(board: ResultBoard, w: ResultWave): string {
  if (w.state === "rowed") {
    const line = waveLineOf(board, w.wave);
    const bits = ["Rowed"];
    if (line?.fastest) bits.push(`fastest ${fmtRaceTime(line.fastest.seconds ?? 0)}`);
    if (line && line.averageSeconds !== null) bits.push(`average ${fmtRaceTime(line.averageSeconds)}`);
    return bits.join(" · ");
  }
  if (w.state === "on_the_ergs") {
    /* NO START STAMP, NO CLOCK. A wave that went late must never be counted
     * from the schedule, or it reads as nearly finished. */
    const elapsed = fmtElapsed(w.startedAtMs, board.nowMs);
    return `Rowing${elapsed ? ` · ${elapsed} elapsed` : ""}`;
  }
  const sheet = inWave(board, w.wave).length;
  const mins = Math.round((w.scheduledAtMs - board.nowMs) / 60000);
  const when = mins > 0 ? `${mins} min from now` : "due now";
  return `To come · due ${fmtClock(w.scheduledAtMs)} · ${sheet} on the sheet · ${when}`;
}

/* THE FOURTH LINE IN A LANE, and it is keyed off the RACER and not the wave,
 * so every combination is honest. A DNF never reaches a lane any more
 * (types.ts boardRacers) — the machine they sat on is drawn open.
 *
 * A TIME IS A FACT AND A SEED IS A PROMISE, so they are drawn differently
 * (rrCss.ts): the time white, bold and tabular, the seed at the grey floor in
 * the eye size. That difference is the owner test applied — where a legend was
 * load-bearing, make the mark self-evident instead of keeping the paragraph.
 *
 * EVERY LANE HAS A FOURTH LINE NOW, a dash when there is nothing to say —
 * an open machine, a wave on the machines — so the pane is the same height
 * whatever wave is open (owner, 2026-10-01). */
type LaneValue = { text: string; tone: "time" | "seed" | "none"; racer: ResultRacer | null };

function laneValue(r: ResultRacer | null): LaneValue {
  if (r === null) return { text: DASH, tone: "none", racer: null };
  if (r.status === "finished" && r.seconds !== null) {
    return { text: fmtRaceTime(r.seconds), tone: "time", racer: r };
  }
  if (r.status === "rowing") return { text: DASH, tone: "none", racer: null };
  const seed = fmtSeed(r.best5k);
  return { text: seed ? `Best in ${seed}` : "First 5k", tone: "seed", racer: null };
}

/* ONE WAVE, LANE BY LANE. Always board.ergs of them, a machine with nobody
 * assigned DRAWN and not skipped so the room can see the empty seat.
 *
 * NO PLACE MARK IN A LANE. Mid-race a place is provisional and the table
 * withholds the fill to say so; a bare M1 in a lane would carry no such
 * context and would read settled. Placing is the table's job — the lane says
 * who was on which machine and what they pulled. */
function WavePane({
  board,
  w,
  open,
  cast,
}: {
  board: ResultBoard;
  w: ResultWave;
  open: boolean;
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
          * the wave that is actually on the machines. With no JavaScript
          * that is trivially correct: the square is in one wave's markup
          * and nowhere else, so a panel parked on a settled wave can never
          * wear it. */}
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
              <p className="rr-lname">{racer ? castName(racer.name, cast) : DASH}</p>
              <p className="rr-lsub">{racer === null ? " " : brLetter(racer.bracket)}</p>
              <p className={v.tone === "time" ? "rr-lval" : `rr-lval ${v.tone}`}>
                {v.text}
                {v.racer && <Tag racer={v.racer} />}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- the field table (mid-race) -------------------------------------- */

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

/* DID NOT START LEFT THIS CELL WITH THE STATUS, and DID NOT FINISH followed
 * it on 2026-09-16: a DNF is off the sheet altogether (types.ts boardRacers),
 * so a row with a name and no time is only ever somebody still to row. */
function TimeCell({ racer }: { racer: ResultRacer }) {
  if (racer.status === "finished" && racer.seconds !== null) {
    return <td className="tm">{fmtRaceTime(racer.seconds)}</td>;
  }
  if (racer.status === "rowing") return <td className="st now">Rowing</td>;
  return <td className="dim">{DASH}</td>;
}

/* The seed cell: whole seconds, an asterisk for a prorated one, a dash for
 * none (the FIRST 5K tag beside the name says the rest). */
function SeedCell({ racer }: { racer: ResultRacer }) {
  const seed = fmtSeed(racer.best5k);
  return <td className="seed rr-hx">{seed ?? DASH}</td>;
}

function NameCell({
  board,
  racer,
  you,
}: {
  board: ResultBoard;
  racer: ResultRacer;
  /* Mid-race only; the finished sheet marks nobody. */
  you?: boolean;
}) {
  /* The signed ON BEST clause came off this line with every other plus and
   * minus; the split stays, and the tag above it carries what the sign was
   * for. On a phone this sub-line IS the seed, /500 and wave columns. */
  const seed = fmtSeed(racer.best5k);
  const sub =
    racer.status === "finished" && racer.seconds !== null
      ? `${fmtSplitFor(board.meters, racer.seconds)} /500 · wave ${racer.wave}${seed ? ` · was ${seed}` : ""}`
      : seed
        ? `Best in ${seed}`
        : "First 5k";
  return (
    <td className="nm">
      {racer.name}
      {you && <span className="rr-tag you">You</span>}
      <Tag racer={racer} />
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
        <th colSpan={6} scope="colgroup">
          Wave {w.wave} · {fmtClock(w.scheduledAtMs)} · {field.length} racers
          <span className={w.state === "on_the_ergs" ? "now" : undefined}>
            {w.state === "rowed" ? "Rowed" : w.state === "on_the_ergs" ? "Rowing" : "To come"}
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
          <NameCell board={board} racer={r} you={you} />
          <td className="br rr-hx">{brLetter(r.bracket)}</td>
          <SeedCell racer={r} />
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
          <th colSpan={6} scope="colgroup">
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

/* ---- the result (finished) ------------------------------------------- */

/* ONE TABLE PER BRACKET (owner, 2026-10-01), in place order, under a MEN or
 * WOMEN label. It used to be one room sorted by time with M1 / W1 marks; a
 * sheet per bracket needs no letter on the place, so the mark is the bare
 * numeral — first keeps its fill, second and third are white and bold, the
 * rest sit at the grey floor. The seed column prints the asterisk for a
 * prorated baseline and a dash for none. */
function PlaceNum({ place }: { place: number }) {
  const cls = place === 1 ? "rr-pl p1" : place <= 3 ? "rr-pl top" : "rr-pl";
  return <span className={cls}>{place}</span>;
}

export function BracketTable({ board, view }: { board: ResultBoard; view: BracketView }) {
  return (
    <table className="rr-t">
      <thead>
        <tr>
          <th className="pl" scope="col">
            Pl.
          </th>
          <th scope="col">Rower</th>
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
            Wave
          </th>
        </tr>
      </thead>
      <tbody>
        {view.ranked.map((r, i) => (
          <tr key={r.id}>
            <td className="pl">
              <PlaceNum place={i + 1} />
            </td>
            <NameCell board={board} racer={r} />
            <SeedCell racer={r} />
            <TimeCell racer={r} />
            <td className="dim rr-hx">{fmtSplitFor(board.meters, r.seconds ?? 0)}</td>
            <td className="dim rr-hx">{r.wave}</td>
          </tr>
        ))}
        {view.ranked.length === 0 && (
          <tr>
            <td className="dim" colSpan={6} style={{ textAlign: "left" }}>
              {DASH}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ---- the podium ------------------------------------------------------ */

/* FIRST, SECOND AND THIRD WITHOUT A COLOUR — a monochrome board cannot hand
 * out a gold medal, so the three say their place with the block (first
 * filled white), the clock (86 / 52 / 38 on a laptop, 50 / 36 / 31 on a
 * phone), the spelled ordinal and the gap, printed on all three so the
 * blocks read as ONE measurement: first carries WON BY rather than an empty
 * space. NO BOX AROUND SECOND OR THIRD any more (owner, 2026-10-01: the
 * second-place frame style is out): they are ruled, not framed — a hairline
 * over each — and first keeps its fill. The FOURTH line under the podium is
 * gone with them; the sheet above has the whole order. No `cast` prop any
 * more: it existed only to keep the signed ON THEIR BEST COMING IN line off
 * the television, and that line is gone from both. */
export function Podium({ board, view }: { board: ResultBoard; view: BracketView }) {
  const p = podium(view);
  if (p.steps.length === 0) return null;
  return (
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
          <p className="rr-pt">{fmtRaceTime(racer.seconds ?? 0)}</p>
          <p className="rr-pn">{racer.name}</p>
          {/* The second line of this block used to print -0:20.6 ON THEIR
            * BEST COMING IN, on the page only. It is one tag now, and the
            * wall gets it too: a podium finisher who went faster than they
            * ever have is worth a mark from across a gym. */}
          <p className="rr-pm">
            <b>{fmtSplitFor(board.meters, racer.seconds ?? 0)}</b> /500 · Wave {racer.wave}
            <Tag racer={racer} />
          </p>
        </div>
      ))}
    </div>
  );
}

/* WORTH SAYING / WHAT THE TABLE BURIES stood here — the fastest piece, the
 * closest finish, the biggest gain, the PR tally, the field, the metres, the
 * first pull and the fastest wave — and came off whole (owner, 2026-09-16:
 * remove Worth saying / What the table buries). */

/* HOW THE NIGHT RAN — the ledger idea, and it fills the ragged column under
 * the shorter of the two brackets rather than leaving white. */
function NightTable({ board }: { board: ResultBoard }) {
  return (
    <table className="rr-t">
      <caption>How the night ran · a row per wave</caption>
      <thead>
        <tr>
          <th scope="col">Wave</th>
          <th scope="col">Scheduled</th>
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
            <td className="tm">{l.fastest ? fmtRaceTime(l.fastest.seconds ?? 0) : DASH}</td>
            <td className="dim">{l.averageSeconds === null ? DASH : fmtRaceTime(l.averageSeconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- you (mid-race) -------------------------------------------------- */

function YouStrip({ board }: { board: ResultBoard }) {
  const you = racerById(board, board.youId);
  if (!you) return null;
  const w = waveOf(board, you.wave);
  const place = placeOf(board, you);
  return (
    <div className="rr-you">
      <span>You</span>
      <span className="nm">{you.name}</span>
      {you.status === "finished" && you.seconds !== null ? (
        <span>
          <b>{fmtRaceTime(you.seconds)}</b> · {place === null ? "" : `${place}${place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th"} `}
          {/* RANKED AGAINST THE NUMBER ACTUALLY RANKED. The bracket field
            * drops the no-shows but keeps a rower who sat down and stopped,
            * so this line was printing 12TH MAN OF 23 under a heading that
            * said 22 TIMES. It is the one line a rower screenshots. */}
          {you.bracket === "M" ? "man" : "woman"} of{" "}
          {bracketView(board, you.bracket).ranked.length}
          <Tag racer={you} />
        </span>
      ) : (
        <span>
          Your wave is <b>Wave {you.wave}</b> at <b>{fmtClock(w?.scheduledAtMs ?? board.nowMs)}</b> · lane{" "}
          <b>{you.lane}</b> ·{" "}
          {w && w.scheduledAtMs > board.nowMs
            ? `${Math.max(1, Math.round((w.scheduledAtMs - board.nowMs) / 60000))} min from now`
            : "on the floor now"}
        </span>
      )}
    </div>
  );
}

/* ---- the share list -------------------------------------------------- */

/* Every finisher as the share card wants them — display-ready, floored,
 * tagged — the signed-in racer first when they are one of them. The board
 * is the only source, so the card can never print a time the sheet does
 * not. The day is the board's own dateLine cut to its middle cell. */
function shareRacers(board: ResultBoard): ShareRacer[] {
  const rows = ranked(boardRacers(board)).map(
    (r): ShareRacer => ({
      id: r.id,
      name: r.name,
      rowerNumber: r.rowerNumber,
      time: fmtRaceTime(r.seconds ?? 0),
      wave: r.wave,
      split: fmtSplitFor(board.meters, r.seconds ?? 0),
      tag: raceTag(r),
    }),
  );
  if (!board.youId) return rows;
  const i = rows.findIndex((r) => r.id === board.youId);
  if (i <= 0) return rows;
  return [rows[i], ...rows.slice(0, i), ...rows.slice(i + 1)];
}

/* "RACE DAY · SUNDAY, SEP 27 · 5,000 M" -> "SUNDAY, SEP 27", upper-cased
 * the way the share payload is. */
function shareDay(board: ResultBoard): string {
  return (board.dateLine.split("·")[1] ?? board.dateLine).trim().toUpperCase();
}

/* ---- the page -------------------------------------------------------- */

export function RaceResults({
  board,
  note,
  head,
  pick,
}: {
  board: ResultBoard;
  note?: ReactNode;
  /* THE ARCHIVE HEADER (ArchiveHead.tsx), finished sheet only: the page
   * builds it off the RaceDef, which the board does not carry. */
  head?: ReactNode;
  /* ?wave=N — a deep link on a phone, and how a gym pins one wave. It beats
   * the computed default; see pickedWave() in types.ts. */
  pick?: number | null;
}) {
  const final = board.state === "finished";
  const men = bracketView(board, "M");
  const women = bracketView(board, "F");
  const c = roomCounts(board);
  const next = nextWave(board);

  if (final) {
    return (
      <div className="rr-dark">
        <section>
          <div className="rr-wrap">
            {note}
            {head}
            {/* THE ONE PERSONAL THING on the sheet, and it marks nothing. */}
            <ShareTime
              racers={shareRacers(board)}
              race={{ title: board.dateLine.split("·")[0].trim().toUpperCase(), day: shareDay(board) }}
            />
            <Section>Results</Section>
            <Label>Men</Label>
            <BracketTable board={board} view={men} />
            <Label>Women</Label>
            <BracketTable board={board} view={women} />
          </div>
        </section>
        <section>
          <div className="rr-wrap">
            <Section>Waves</Section>
            {/* THE PICKER AND THE LEDGER SIT IN ONE SECTION, and the table
              * stays: the panel is how ONE wave ran with the names
              * attached, the table is how the three compare side by side,
              * which a panel showing one at a time cannot do. Both route
              * their fastest and their average through waveLines, so they
              * can never disagree. */}
            <WavePicker board={board} pick={pick} />
            <NightTable board={board} />
          </div>
        </section>
        <section>
          <div className="rr-wrap">
            <Section>Winners</Section>
            <Label>Men</Label>
            <Podium board={board} view={men} />
            <Label>Women</Label>
            <Podium board={board} view={women} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="rr-dark">
      <section>
        <div className="rr-wrap">
          {note}
          <Dateline board={board} />
          <YouStrip board={board} />

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
        </div>
      </section>

      <section>
        <div className="rr-wrap">
          <div className="sec-head">
            <h2>The field</h2>
            <span className="mono">
              {c.field} racers · {men.all.length} men · {women.all.length} women
            </span>
          </div>
          {/* BOTH PARAGRAPHS THAT STOOD HERE ARE GONE. The mid-race one
            * explained that empty rows fill in (the sixteen empty rows do
            * that themselves), counted how many were still to come (a count
            * the owner cut everywhere else on the board), and was the only
            * thing that ever explained the seed bar — so the bar went with
            * the sentence rather than standing there unreadable. */}
          <FieldTable board={board} />
        </div>
      </section>
    </div>
  );
}
