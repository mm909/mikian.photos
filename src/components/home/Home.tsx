"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from "react";
import type { MeterSnapshot } from "@/lib/homeStats";
import { useLiveMeters } from "./useLiveMeters";
import { metersText, tokensFor } from "./digits";

/* The landing page body — the odometer poster (owner pick, 2026-09-03,
 * from five candidates). One colossal water-blue number set in Archivo
 * Black straight onto the paper, its digits rolling vertically like a
 * mechanical odometer; a mono status line above, a mono unit line below,
 * then a huge underlined OPT IN text link to /row100k and a thin mono
 * ledger with dotted leaders. No tiles, no box, no dark surface.
 *
 * RULE (same as theme.ts): the css string must contain NO double quotes,
 * NO apostrophes and NO angle brackets anywhere, comments included — React
 * escapes them server-side only and the style tag hydration-mismatches. */

const css = `
.home .stage{position:relative;padding:clamp(34px,7vh,84px) 0 48px}
.home .status{display:flex;align-items:center;flex-wrap:wrap;font-family:var(--home-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}

/* Counter width math. Archivo Black digits are all .667em wide and the
 * comma is .333em, so the cells are .68em and .34em: 8 digit cells plus
 * 2 comma cells = 5.44em + .68em = 6.12em. At 375px the wrap leaves
 * 335px, so the natural size is (100vw - 40px) / 6.12 = 16.34vw - 6.5px;
 * 16.3vw - 10px keeps a few px in hand and clears a classic desktop
 * scrollbar, which vw includes: 375px gives 51px type and a 313px counter,
 * 800px gives 120px type and 737px, and the 160px cap holds the counter
 * at 979px inside the 1000px content width of the wrap. The 30vh term
 * keeps it sane in a short laptop pane. */
.home .od{--od-size:clamp(40px,min(calc(16.3vw - 10px),30vh),160px);--od-cw:.68em;--od-sw:.34em;
  display:flex;align-items:flex-start;margin-top:22px;font-family:var(--home-archivo-black),sans-serif;font-size:var(--od-size);line-height:1;color:var(--water);letter-spacing:0;font-variant-numeric:tabular-nums}
.home .od .cell{position:relative;flex:none;width:var(--od-cw);height:1em;overflow:hidden;transition:opacity 420ms ease}
.home .od .strip{display:block;width:100%;transition:transform 170ms cubic-bezier(.2,.7,.2,1)}
.home .od .g{display:block;height:1em;line-height:1;text-align:center}
.home .od .sep{flex:none;width:var(--od-sw);height:1em;line-height:1;text-align:center;transition:opacity 420ms ease}
.home .od .lead{opacity:.25}

.home .unit{margin-top:16px;font-family:var(--home-mono),monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.home .unit b{color:var(--ink);font-weight:700}

.home .cta{margin-top:clamp(30px,6vh,64px)}
.home .opt{display:inline-block;font-family:var(--home-archivo-black),sans-serif;font-size:clamp(38px,8.6vw,96px);line-height:1;text-transform:uppercase;letter-spacing:-.01em;color:var(--ink);white-space:nowrap;
  text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:.09em;text-underline-offset:.12em;text-decoration-skip-ink:none;transition:color 160ms ease}
.home .opt:hover{color:var(--water)}
.home .opt:focus-visible{outline-offset:8px}
.home .opt .arr{display:inline-block;width:.8em;height:.8em;margin-left:.14em;vertical-align:-.06em}
.home .opt .arr svg{display:block;width:100%;height:100%}

/* Thin mono ledger with dotted leaders. */
.home .ledger{list-style:none;border-top:2px solid var(--ink);padding:20px 0 26px;display:grid;gap:12px 40px;font-family:var(--home-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.home .ledger li{display:flex;align-items:baseline;gap:10px;min-width:0}
.home .ledger .k{color:var(--ink-soft);white-space:nowrap}
.home .ledger .dots{flex:1 1 24px;min-width:24px;height:0;border-bottom:2px dotted var(--gray)}
.home .ledger .v{font-weight:700;color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}

/* Rotated mono tag in the left gutter, wide screens only. Hugs the wrap. */
.home .side{display:none}

@media(min-width:720px){
  .home .ledger{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
}
@media(min-width:1200px){
  .home .side{display:block;position:absolute;left:max(24px,calc(50% - 566px));bottom:48px;writing-mode:vertical-rl;transform:rotate(180deg);font-family:var(--home-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
}
`;

/* ---- Odometer digit ------------------------------------------------------
 * A 1em-tall window over a vertical strip of glyphs, 0-9 repeated twice.
 * The strip is translated by -p em with a transition; p only ever grows
 * (a 9 becomes a 0 by rolling forward into the second lap), and once a
 * roll has finished the strip snaps back a whole lap with the transition
 * off. Because the strip is periodic, that snap draws the identical frame.
 *
 * The roll is timed per glyph off the counter's tempo (the hook's tempoMs,
 * the interval between steps right now). At rest — the ones wheel turning
 * one glyph every split/500 s, 170 ms at the fastest split useLiveMeters
 * allows — a glyph takes ROLL_GLYPH_MS, so it is settled before the next
 * tick lands: one glyph, a rest, one glyph, like an erg monitor and not a
 * slot machine (owner's call, 2026-09-05; the old fixed 420 ms roll was
 * always mid-flight under a faster cadence). When the counter sprints to
 * catch a board that got ahead, steps come as fast as every 70 ms: the
 * roll shortens with the tempo (never under ROLL_MIN_MS a glyph) and ends
 * ROLL_REST_MS before the next step is due, so the wheel is never still
 * mid-roll when the number moves on — it never trails the value, and the
 * transition really ends, which is what lets the lap snap below happen
 * unseen. The one place the per-glyph minimum yields is a two-meter step
 * at the 70 ms floor: 30 ms a glyph, because a 120 ms roll would overrun
 * the next step and a wheel lagging the value is the worse fault. Making
 * more of a sprint single meters (STEP2_M in useLiveMeters) is the only
 * lever. A multi-glyph change that is not a tempo step (a board that went
 * down, a tab that was hidden a while) rolls all its glyphs in one motion
 * capped at ROLL_MAX_MS, so a big jump is a flick, not a blur.
 *
 * A sprint can retarget every roll before it ends (no transitionend, so
 * nothing settles the strip) until it is too deep into the second lap to
 * roll on. Then it is folded back a lap first — same frame, no transition,
 * in a render the browser never paints — and the step still rolls; the one
 * cost is that a roll in flight at that instant is cut to its end frame,
 * once a lap (review, 2026-09-05: it used to land as an unanimated jump).
 * Under prefers-reduced-motion the base CSS kills the transition, so every
 * change is an instant, correct jump. */
const LAPS = 2;
const STRIP = Array.from({ length: LAPS * 10 }, (_, i) => i % 10);
const ROLL_GLYPH_MS = 170;
const ROLL_MIN_MS = 60;
const ROLL_MAX_MS = 420;
const ROLL_REST_MS = 10;
/* Steps of this many glyphs or fewer are what the tempo emits (a meter, a
 * couple); anything bigger is a one-off change and gets the full roll. */
const TEMPO_STEP_MAX = 2;

/* A tempo step must be settled before the next one is due, even when that
 * means less than ROLL_MIN_MS a glyph (2 glyphs at the 70 ms floor). */
const rollMs = (steps: number, tempo: number) => {
  const glyph = tempo > 0 ? Math.min(ROLL_GLYPH_MS, Math.max(ROLL_MIN_MS, tempo)) : ROLL_GLYPH_MS;
  const ms = Math.min(ROLL_MAX_MS, steps * glyph);
  if (tempo <= 0 || steps > TEMPO_STEP_MAX) return ms;
  return Math.max(ROLL_MIN_MS, Math.min(ms, tempo - ROLL_REST_MS));
};

function Digit({ d, lead, tempo }: { d: number; lead: boolean; tempo: number }) {
  const [roll, setRoll] = useState({ p: d, snap: true, ms: ROLL_GLYPH_MS });
  const pos = useRef(d);
  const strip = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  // Read inside the roll effect without being one of its deps: a tempo
  // change on its own must never restart a roll in flight.
  const tempoRef = useRef(tempo);
  tempoRef.current = tempo;
  // A roll held back one render while the strip folds back a lap first.
  const held = useRef<{ p: number; ms: number } | null>(null);

  const settle = useCallback(() => {
    if (pos.current < 10) return;
    pos.current -= 10;
    const p = pos.current;
    setRoll((r) => ({ p, snap: true, ms: r.ms }));
  }, []);

  const begin = useCallback(
    (p: number, ms: number) => {
      // Flush style so the roll starts from the snapped position, not from
      // wherever the browser last saw the strip.
      strip.current?.getBoundingClientRect();
      pos.current = p;
      setRoll({ p, snap: false, ms });
      // Fallback for when transitionend never fires (reduced motion, hidden tab).
      timer.current = window.setTimeout(settle, ms + 60);
    },
    [settle],
  );

  useEffect(() => {
    const cur = pos.current;
    const steps = (d - (cur % 10) + 10) % 10;
    if (steps === 0) return;
    window.clearTimeout(timer.current);
    const ms = rollMs(steps, tempoRef.current);
    const next = cur + steps;
    if (next < LAPS * 10) {
      begin(next, ms);
    } else {
      // Too deep into the second lap to roll on: fold back a lap (the
      // identical frame) and let the layout effect start this roll from
      // there before the fold is ever painted.
      held.current = { p: next - 10, ms };
      pos.current = cur - 10;
      setRoll((r) => ({ p: cur - 10, snap: true, ms: r.ms }));
    }
    return () => window.clearTimeout(timer.current);
  }, [d, begin]);

  // Runs in the commit of the fold above, before the browser paints, so a
  // state update here re-renders synchronously and the held roll starts
  // from the folded strip with no frame in between.
  useLayoutEffect(() => {
    const h = held.current;
    if (!h || !roll.snap) return;
    held.current = null;
    begin(h.p, h.ms);
  }, [roll, begin]);

  const onEnd = (e: TransitionEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget && e.propertyName === "transform") settle();
  };

  return (
    <span className={`cell${lead ? " lead" : ""}`} aria-hidden="true">
      <span
        ref={strip}
        className="strip"
        style={{
          transform: `translateY(${-roll.p}em)`,
          transition: roll.snap ? "none" : `transform ${roll.ms}ms cubic-bezier(.2,.7,.2,1)`,
        }}
        onTransitionEnd={onEnd}
      >
        {STRIP.map((g, i) => (
          <span key={i} className="g">
            {g}
          </span>
        ))}
      </span>
    </span>
  );
}

function Odometer({ meters, tempo }: { meters: number; tempo: number }) {
  const tokens = tokensFor(metersText(meters, 8));
  // Keyed from the right so each wheel keeps its identity if a ninth digit
  // ever appears on the left.
  return (
    <div className="od" role="img" aria-label={`${meters.toLocaleString("en-US")} meters rowed`}>
      {tokens.map((t, i) =>
        t.sep ? (
          <span key={`s${tokens.length - i}`} className={`sep${t.lead ? " lead" : ""}`} aria-hidden="true">
            {t.ch}
          </span>
        ) : (
          <Digit key={`d${tokens.length - i}`} d={Number(t.ch)} lead={t.lead} tempo={tempo} />
        ),
      )}
    </div>
  );
}

export function Home({ snapshot }: { snapshot: MeterSnapshot }) {
  const m = useLiveMeters(snapshot);
  // Oct 1–3 is still phase "open" (late logs), but the pace is 0 and the
  // month is rowed — say so instead of a stale "day 30 of 30".
  const status =
    m.phase === "before"
      ? "Rowtember 2026 · first stroke Sep 1"
      : m.phase === "closed"
        ? "Rowtember 2026 · final"
        : m.rate <= 0 && m.day >= 30
          ? "Rowtember 2026 · late logs through Oct 3"
          : `Rowtember 2026 · day ${m.day} of 30`;

  const facts: Array<[string, string]> = [
    ["Rowers in", m.rowers.toLocaleString("en-US")],
    ["Sessions logged", m.sessions.toLocaleString("en-US")],
    m.phase === "before" ? ["Starts", "Sep 1"] : ["Days left", String(m.daysLeft)],
  ];
  if (m.finished > 0) facts.push(["Finished 100K", m.finished.toLocaleString("en-US")]);

  return (
    <>
      <style>{css}</style>
      <section className="stage">
        <p className="side" aria-hidden="true">
          Rowtember 2026 · every meter, live
        </p>
        <div className="wrap">
          <p className="status">
            {m.live && <span className="live-dot" aria-hidden="true" />}
            <span>{status}</span>
          </p>
          <h1 className="sr">Meters rowed so far in Rowtember 2026</h1>
          <Odometer meters={m.meters} tempo={m.tempoMs} />
          <p className="unit">
            Meters rowed · <b>everyone together</b>
            {m.phase === "before" ? " · from Sep 1" : ""}
          </p>
          <div className="cta">
            <a className="opt" href="/row100k">
              Opt in
              <span className="arr" aria-hidden="true">
                <svg viewBox="0 0 100 100" focusable="false">
                  <path
                    d="M6 50h78M52 18l32 32-32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                  />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="wrap">
        <ul className="ledger">
          {facts.map(([k, v]) => (
            <li key={k}>
              <span className="k">{k}</span>
              <span className="dots" aria-hidden="true" />
              <span className="v">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
