import type { CSSProperties, ReactNode } from "react";

import {
  bracketView,
  fmtAgo,
  fmtClock,
  fmtTime,
  ranked,
  roomCounts,
  type ResultBoard,
} from "./types";
import { CastShell } from "./CastShell";
import { LeaderBox, Podium, WavePicker } from "./RaceResults";

/* THE WALL. A frame built for a television in the gym, not the page scaled
 * up: exactly 1280 by 720, no site bar, no footer, nothing that scrolls,
 * and no personal block — the cast is FORCED SIGNED OUT (youId is dropped
 * on the way in), because a gym casting from a signed-in laptop would put
 * one rower on the wall all evening.
 *
 * It has to answer all three questions at once, from across a room:
 *   WHO LEADS      two clocks at 104px, one per bracket.
 *   WHAT IS LEFT   the wave grid, so a rower standing in front of the TV
 *                  learns when their own wave goes. It runs the full width
 *                  of the frame now.
 *   WHO IS PULLING the lane panel under the grid — but on the wall there is
 *                  nothing to press, so the panel FOLLOWS THE ROOM: the wave
 *                  on the ergs, and between waves the start list of the wave
 *                  that is next. See pickedWave() in types.ts.
 *
 * THE LANE STRIP AND THE GRID ARE ONE BLOCK NOW, WavePicker. The strip used
 * to be welded to the wave on the ergs and rendered NOTHING between waves, so
 * every half hour a 131px band vanished out of a frame clipped at exactly 720
 * and the television carried a hole for twenty minutes at a stretch. Nothing
 * on the wall is a control — no inputs, no focus, one pane — because nobody
 * standing in front of a television is holding a keyboard.
 *
 * THE ROOM COLUMN WENT (owner, 2026-09-11). It was the three-cell counter —
 * rowed, on the ergs, still to come — sitting in 424px beside the grid, and
 * the grid was already showing every one of those facts a wave at a time,
 * wave by wave, with the finished ones filled. The leader boxes lost their
 * foot in the same pass (the still-to-row count, the threats and the fastest
 * to come), so the top half of the frame breathes where it used to crowd.
 *
 * THE GREY FLOOR IS HIGHER HERE. Nothing under .62 white inside the frame
 * (rrCss.ts) because .5 and .45 crush on a cheap TV in a bright gym.
 *
 * NOT AUTO-REFRESHING YET. The real surface wants a poll so a wall board
 * cannot silently freeze; the sample has nothing to poll, and the freshness
 * line is what makes a stale board look stale in the meantime — which is
 * exactly why the WALL prints the age too, and shouts it. The wall is the one
 * screen in the building nobody can interrogate.
 *
 * THE ERG COUNT COMES IN AS A CUSTOM PROPERTY. The frame is clipped at 720,
 * so a lane strip whose column count is typed into the stylesheet wraps to a
 * second row and falls off the bottom of the television with no error the
 * moment the floor runs anything but eight ergs. The wave count travels the
 * same way, but it is set by WavePicker on the picker itself now rather than
 * here on the frame, so the one component that draws the cells is the one
 * that says how many there are.
 *
 * THE STAGE. A transform scales what you see and not the box it sits in, so
 * a phone looking at the wall was looking at a thumbnail adrift in a 1280 by
 * 720 hole. The frame is pinned to the top left of a stage that is resized to
 * the scaled size, and on a phone it gets a caption — outside the scaled box,
 * so it is never on the television.
 *
 * IT SCALES UP NOW TOO. The 1280 by 720 above is the DESIGN, not the output:
 * the frame is drawn at that size and then scaled to the largest 16 by 9
 * rectangle the screen holds, so a 1920 or a 4K television in the room gets
 * type that is proportionally bigger rather than the same type in more black.
 * The arithmetic is pure CSS and lives in rrCss.ts; nothing here measures
 * anything. Pass pinned to get the literal 1280 by 720 back for a capture. */
export function CastFrame({
  board,
  note,
  pick,
  pinned,
}: {
  board: ResultBoard;
  note?: ReactNode;
  /* ?wave=N — how a gym pins ONE wave to the wall for a night. Without it the
   * panel follows the room on its own. */
  pick?: number | null;
  /* The capture frame: exactly 1280 by 720 at any viewport, and no full
   * screen button on it, because whatever grabs those pixels must not grab a
   * control sitting in the corner of them. */
  pinned?: boolean;
}) {
  /* Forced signed out. */
  const b: ResultBoard = { ...board, youId: null };
  const final = b.state === "finished";
  const men = bracketView(b, "M");
  const women = bracketView(b, "F");
  const c = roomCounts(b.racers);
  const fastest = ranked(b.racers)[0] ?? null;
  const stale = !final && b.nowMs - b.updatedAtMs > 5 * 60_000;
  /* Inline style objects carry no hydration-character risk, which is why the
   * count travels this way rather than through the style template. */
  const frame = { "--rr-ergs": b.ergs } as CSSProperties;

  return (
    /* The shell is the black field and the full screen button, and it is the
     * only client code on this view — the frame under it is server-rendered
     * and sized by the stylesheet, so the wall is right before any script
     * runs and right with scripting off. */
    <CastShell pinned={pinned}>
      <div className="rr-stage">
        <div className="rr-cast" style={frame}>
          <div className="rr-line">
            <p className="rr-date">
              <b>{b.placeLine}</b>
              {b.dateLine}
            </p>
            <div>
              <p className="rr-now">
                {!final && <span className="rr-sq" aria-hidden="true" />}
                {final ? "Final " : ""}
                {fmtClock(b.nowMs)}
              </p>
              {/* THE AGE IS PRINTED ON THE WALL TOO. A room cannot ask the
                * television when somebody last typed a time into it, and a
                * frozen board and a slow wave look identical from across a
                * gym. Stale, the line goes full white and bold. */}
              <p className={stale ? "rr-samp stale" : "rr-samp"}>
                {final
                  ? `Sheet posted ${fmtClock(b.updatedAtMs)}`
                  : `Live · last entry ${fmtClock(b.updatedAtMs)} · ${fmtAgo(b.updatedAtMs, b.nowMs)}`}
                {b.sample ? " · sample data" : ""}
              </p>
            </div>
          </div>
  
          {final ? (
            <>
              <div>
                <p className="rr-castk">
                  The men · {men.all.length} racers · {men.rowed} times · scored apart
                </p>
                <Podium board={b} view={men} />
              </div>
              <div>
                <p className="rr-castk">
                  The women · {women.all.length} racers · {women.rowed} times · scored apart
                </p>
                <Podium board={b} view={women} />
              </div>
              <div className="rr-count">
                <div className="rr-cell fill">
                  <div className="rr-n">{fastest ? fmtTime(fastest.seconds ?? 0) : "—"}</div>
                  <div className="rr-k">
                    Fastest 5,000 m in the room{fastest ? ` · ${fastest.name}` : ""}
                  </div>
                </div>
                <div className="rr-cell">
                  <div className="rr-n">{c.rowed}</div>
                  <div className="rr-k">Finished</div>
                </div>
                <div className="rr-cell">
                  <div className="rr-n">{(c.rowed * b.meters).toLocaleString()}</div>
                  <div className="rr-k">Metres pulled</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rr-two">
                <LeaderBox board={b} view={men} />
                <LeaderBox board={b} view={women} />
              </div>
              {/* ONE CALL WHERE THERE WERE TWO BLOCKS AND A DEAD COLUMN: the
                * lane strip, the caption and the grid. The picker draws its
                * own caption, five plain cells with no inputs and exactly one
                * open pane, which is the wave the room is on. */}
              <WavePicker board={b} cast pick={pick} />
            </>
          )}
        </div>
      </div>
      {/* Phone only — display:none from 768 up, so a television never sees
        * it. It says what the rectangle IS, and 1280 by 720 is still the
        * answer: on a phone the frame now runs the full width of the screen,
        * which makes it look like a page rather than the television it is. */}
      {/* NOTHING ADDED FOR THE FIT CASE. 1280 by 720 is still exactly what
        * the rectangle is, the scaling is self-evident when it runs the full
        * width of the phone, and this line is ONE line wide at 430 with no
        * room to spare — a caption that wraps to explain itself is worse than
        * the caption that fit. Only the pinned frame says so, because there
        * the size is the whole point and a second line is the edge case.
        *
        * The hard space keeps the separator on the line it belongs to, or the
        * dot ends up alone at the head of the wrap, above the way out. */}
      <p className="rr-fitcap">
        <b>The wall frame</b> · 1280 by 720{pinned ? ", pinned" : ""}
        {note ? (
          <>
            {" · "}
            {note}
          </>
        ) : null}
      </p>
    </CastShell>
  );
}
