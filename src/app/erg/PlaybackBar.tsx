"use client";

import { useEffect, useReducer, useState } from "react";
import { fmtTenthsClock } from "@/lib/pm5/session";
import { clearErg, markLoaded, startSource, type Erg } from "./hub";
import { PLAYBACK_SPEEDS, playbackFor } from "./playback";

/* THE TRANSPORT (owner, 2026-09-17: "I want to be able to play back a row
 * like how simulate data simulates data").
 *
 * A strip pinned under the head of an erg that is playing a saved session:
 * PLAY and PAUSE, the speed chips, a scrub bar of elapsed against the whole
 * piece, and the title of the row with the word PLAYBACK next to it. That
 * word is not decoration — everything below this strip is the ordinary live
 * console, so without it a replayed row and an erg in the room look exactly
 * alike, and they must never be confused.
 *
 * A PLAYBACK IS NOT SAVABLE and this strip is where that is said: the
 * source of these numbers is a row that is already saved, and saving it
 * again would put a second copy of the same piece under the account.
 *
 * WHY THE SLOT IS CLEARED BEFORE A SEEK. The console is a running tally —
 * samples pushed, strokes filed by number. Moving the playhead backwards
 * and pouring the same piece in again would give it every stroke twice. So
 * a seek empties the slot first and the driver rebuilds it from the
 * document up to the new playhead, which it does in one tick.
 *
 * ITS OWN CLOCK. The hub paints when a packet lands, and a paused playback
 * lands nothing — so the strip ticks itself ten times a second to keep the
 * scrub bar and the buttons honest while nothing is moving. */

const SPEED_WORD = (x: number) => `${x}×`;

export function PlaybackBar({ erg }: { erg: Erg }) {
  const driver = playbackFor(erg.id);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  /* WHERE THE THUMB IS WHILE IT IS BEING DRAGGED, and null the rest of the
   * time. A range input fires onChange on every pointer move, and a seek
   * is not a cheap thing: it empties the slot and pours the piece back in
   * from the document, which on a long row is thousands of packets through
   * ingest. Dozens of those in one drag would lock the tab. So the drag
   * only moves this number, and the seek happens once, when the handle is
   * let go. */
  const [scrub, setScrub] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, []);

  if (!driver) return null;

  const elapsed = driver.elapsedMs;
  const total = Math.max(1, driver.totalMs);
  const pct = Math.round((elapsed / total) * 1000) / 10;

  /* The hub lets the timer go when a driver says it is done, so anything
   * that has to move the playhead re-arms the source first. Only when the
   * link is down: a running playback must not be restarted under itself,
   * or every PAUSE would write another line in the log. */
  const arm = () => {
    if (erg.link !== "live") startSource(erg.id, driver);
  };

  /* Empty the slot, put the LOADED word back on it, move the playhead. The
   * next step fills the console again from the document. */
  const seek = (ms: number) => {
    const loaded = erg.loaded;
    clearErg(erg.id);
    markLoaded(erg.id, loaded);
    driver.seekMs(ms);
    arm();
    tick();
  };

  /* The handle was let go (or the keyboard stopped moving it): one seek to
   * where it ended up, and the bar goes back to following the playhead. */
  const commitScrub = () => {
    if (scrub === null) return;
    const ms = scrub;
    setScrub(null);
    seek(ms);
  };

  const seekStroke = (dir: -1 | 1) => {
    const times = driver.strokeTimesMs;
    if (!times.length) return;
    const here = driver.elapsedMs;
    const next = dir === 1 ? times.find((t) => t > here + 1) : [...times].reverse().find((t) => t < here - 1);
    seek(next ?? (dir === 1 ? driver.totalMs : 0));
  };

  const toggle = () => {
    if (driver.playing) driver.pause();
    else {
      /* PLAY at the end starts the piece over, which is what the button
       * would otherwise do nothing at all. */
      if (driver.finished) {
        seek(0);
        driver.play();
        tick();
        return;
      }
      driver.play();
      arm();
    }
    tick();
  };

  return (
    <div className="eg-pb">
      <div className="eg-pb-top">
        <span className="eg-pb-mark">Playback</span>
        <span className="eg-pb-title">{driver.title}</span>
        <span className="eg-pb-note">Not savable — this row is already saved</span>
      </div>

      <div className="eg-pb-row">
        <button type="button" className="eg-btn" onClick={toggle}>
          {driver.playing ? "Pause" : driver.finished ? "Play again" : "Play"}
        </button>
        <button type="button" className="eg-btn eg-btn-quiet" onClick={() => seek(0)}>
          Restart
        </button>
        <button type="button" className="eg-btn eg-btn-quiet" onClick={() => seekStroke(-1)} disabled={!driver.strokeTimesMs.length}>
          Previous stroke
        </button>
        <button type="button" className="eg-btn eg-btn-quiet" onClick={() => seekStroke(1)} disabled={!driver.strokeTimesMs.length}>
          Next stroke
        </button>

        <span className="eg-pb-speeds">
          <span className="eg-pb-k">Speed</span>
          {PLAYBACK_SPEEDS.map((x) => (
            <button
              key={x}
              type="button"
              className={driver.speed === x ? "eg-chip on" : "eg-chip"}
              aria-pressed={driver.speed === x}
              onClick={() => {
                driver.setSpeed(x);
                tick();
              }}
            >
              {SPEED_WORD(x)}
            </button>
          ))}
        </span>
      </div>

      <div className="eg-pb-scrub">
        <label className="eg-pb-k" htmlFor={`scrub-${erg.id}`}>
          Scrub
        </label>
        <input
          id={`scrub-${erg.id}`}
          type="range"
          min={0}
          max={total}
          step={100}
          value={scrub ?? Math.round(elapsed)}
          onChange={(ev) => setScrub(Number(ev.target.value))}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          onBlur={commitScrub}
        />
        <span className="eg-pb-clock eg-num">
          {fmtTenthsClock((scrub ?? elapsed) / 100)} <span className="eg-pb-of">of {fmtTenthsClock(total / 100)}</span>
        </span>
      </div>

      <div className="eg-pb-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
