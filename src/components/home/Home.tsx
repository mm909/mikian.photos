"use client";

import { useCallback, useEffect, useRef, useState, type TransitionEvent } from "react";
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
.home .od .strip{display:block;width:100%;transition:transform 420ms cubic-bezier(.2,.7,.2,1)}
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
 * The strip is translated by -p em with a 420ms transition; p only ever
 * grows (a 9 becomes a 0 by rolling forward into the second lap), and once
 * a roll has finished the strip snaps back a whole lap with the transition
 * off. Because the strip is periodic, that snap draws the identical frame.
 * If a change arrives while the strip is already too deep into the second
 * lap to roll, the digit jumps there without a roll — never wrong, at
 * worst unanimated. Under prefers-reduced-motion the base CSS kills the
 * transition, so every change is an instant, correct jump. */
const LAPS = 2;
const STRIP = Array.from({ length: LAPS * 10 }, (_, i) => i % 10);
const ROLL_MS = 420;

function Digit({ d, lead }: { d: number; lead: boolean }) {
  const [roll, setRoll] = useState({ p: d, snap: true });
  const pos = useRef(d);
  const strip = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);

  const settle = useCallback(() => {
    if (pos.current < 10) return;
    pos.current -= 10;
    setRoll({ p: pos.current, snap: true });
  }, []);

  useEffect(() => {
    const cur = pos.current;
    const steps = (d - (cur % 10) + 10) % 10;
    if (steps === 0) return;
    window.clearTimeout(timer.current);
    // Flush style so the roll starts from the snapped position, not from
    // wherever the browser last saw the strip.
    strip.current?.getBoundingClientRect();
    let next = cur + steps;
    let snap = false;
    if (next >= LAPS * 10) {
      next -= 10;
      snap = true;
    }
    pos.current = next;
    setRoll({ p: next, snap });
    // Fallback for when transitionend never fires (reduced motion, hidden tab).
    timer.current = window.setTimeout(settle, ROLL_MS + 60);
    return () => window.clearTimeout(timer.current);
  }, [d, settle]);

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
          transition: roll.snap ? "none" : undefined,
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

function Odometer({ meters }: { meters: number }) {
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
          <Digit key={`d${tokens.length - i}`} d={Number(t.ch)} lead={t.lead} />
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
          <Odometer meters={m.meters} />
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
