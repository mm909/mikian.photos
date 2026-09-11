import type { CSSProperties, ReactNode } from "react";

import {
  bracketView,
  fmtAgo,
  fmtClock,
  fmtTime,
  liveWave,
  nextWave,
  ranked,
  roomCounts,
  type ResultBoard,
} from "./types";
import { Counters, LaneStrip, LeaderBox, Podium, WaveGrid } from "./RaceResults";

/* THE WALL. A frame built for a television in the gym, not the page scaled
 * up: exactly 1280 by 720, no site bar, no footer, nothing that scrolls,
 * and no personal block — the cast is FORCED SIGNED OUT (youId is dropped
 * on the way in), because a gym casting from a signed-in laptop would put
 * one rower on the wall all evening.
 *
 * It has to answer all three questions at once, from across a room:
 *   WHO LEADS      two clocks at 104px, one per bracket, each with the line
 *                  that makes them honest.
 *   WHO IS PULLING the wave on the ergs, lane by lane, with the empty erg
 *                  drawn rather than skipped.
 *   WHAT IS LEFT   the wave grid, so a rower standing in front of the TV
 *                  learns when their own wave goes, and the three-cell
 *                  counter with the middle cell filled.
 *
 * TERSE, AND CORRECT. On the wall the threats are COUNTED and only the
 * fastest is named, since nobody standing in front of a television can ask
 * a question. The wording says A FASTER 5K ON RECORD, never HAVE GONE
 * FASTER, which read as though somebody had already beaten the leader
 * tonight.
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
 * THE GRID COUNTS COME IN AS CUSTOM PROPERTIES. The frame is clipped at 720,
 * so a lane strip or a wave grid whose column count is typed into the
 * stylesheet wraps to a second row and falls off the bottom of the television
 * with no error the moment the floor runs anything but eight ergs and five
 * waves. The components map over the model; now so does the stylesheet.
 *
 * THE STAGE. A transform scales what you see and not the box it sits in, so
 * a phone looking at the wall was looking at a thumbnail adrift in a 1280 by
 * 720 hole. The frame is pinned to the top left of a stage that is resized to
 * the scaled size, and on a phone it gets a caption — outside the scaled box,
 * so it is never on the television. */
export function CastFrame({ board, note }: { board: ResultBoard; note?: ReactNode }) {
  /* Forced signed out. */
  const b: ResultBoard = { ...board, youId: null };
  const final = b.state === "finished";
  const men = bracketView(b, "M");
  const women = bracketView(b, "F");
  const c = roomCounts(b.racers);
  const live = liveWave(b);
  const next = nextWave(b);
  const fastest = ranked(b.racers)[0] ?? null;
  const stale = !final && b.nowMs - b.updatedAtMs > 5 * 60_000;
  /* Inline style objects carry no hydration-character risk, which is why the
   * counts travel this way rather than through the style template. */
  const frame = { "--rr-ergs": b.ergs, "--rr-waves": b.waves.length } as CSSProperties;

  return (
    <div className="rr-fit">
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
                <Podium board={b} view={men} cast />
              </div>
              <div>
                <p className="rr-castk">
                  The women · {women.all.length} racers · {women.rowed} times · scored apart
                </p>
                <Podium board={b} view={women} cast />
              </div>
              <div className="rr-count">
                <div className="rr-cell fill">
                  <div className="rr-n">{fastest ? fmtTime(fastest.seconds ?? 0) : "—"}</div>
                  <div className="rr-k">
                    Fastest piece in the room{fastest ? ` · ${fastest.name}` : ""}
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
                <LeaderBox board={b} view={men} cast />
                <LeaderBox board={b} view={women} cast />
              </div>
              <LaneStrip board={b} cast />
              <div className="rr-strip">
                <div className="rr-col">
                  <p className="rr-castk">
                    The grid · {b.waves.length} waves · {b.ergs} ergs
                    {next ? ` · next off at ${fmtClock(next.scheduledAtMs)}` : ""}
                    {live ? ` · wave ${live.wave} on the ergs` : ""}
                  </p>
                  <WaveGrid board={b} cast />
                </div>
                <div className="rr-col">
                  <p className="rr-castk">The room</p>
                  <Counters board={b} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Phone only — display:none from 768 up, so a television never sees
        * it. It says what the shrunken rectangle IS. */}
      <p className="rr-fitcap">
        <b>The wall frame</b> · 1280 by 720{note ? <> · {note}</> : null}
      </p>
    </div>
  );
}
