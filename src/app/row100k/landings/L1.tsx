import type { CSSProperties } from "react";
import Link from "next/link";
import { GOAL_METERS, MONTH, MONTH_DAYS, MONTH_WORD, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { INK, PAPER, accentOn, capsOn, type Palette, type PaletteGround } from "@/lib/rowPalette";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import type { LandingData, LandingExample } from "../landing/data";
import { MeterCount } from "../landing/MeterCount";
import type { ShareData } from "../share/cards";
import { L4Cards } from "./L4Cards";
import { l1Css } from "./l1Css";

/* THE DARE — the front page for every stranger (owner brief, 2026-09-30:
 * the landing has to turn someone who tapped a link on Instagram into a
 * rower; the month's goal is the 100K, the tracking is the second reason,
 * OPT IN is the one action). Picked from five drafts the same day ("the
 * best one so far") and cut to his notes: ink ground, white type, ONE
 * accent, the brand white, black and red.
 *
 * THE FOLD IS A POSTER: the dateline with the month's days as a strip,
 * the eyebrow, one sentence fitted flush to the measure line by line with
 * the month in the accent, then the two live figures — ROWERS and METERS,
 * this month, the meters counting up — and OPT IN as a block where a thumb
 * lands. No arithmetic, no countdown, no chips, no sign-in talk.
 *
 * UNDER IT, still on the same ground: how a meter counts in three lines,
 * the cards a rower posts after a row (the share dialog's own month and
 * profile cards, painted off one real rower's month — L4Cards), the number
 * the next rower gets, OPT IN again, the footer.
 *
 * THE GROUND AND THE ACCENT COME FROM THE PALETTE (rowPalette.ts): ink or
 * paper (ink whatever the preset says under the site's ink look —
 * sitePalette.ts landingGround), and the accent cut for it. The page sets
 * them as variables on its root (--l1-*) and the sheet (l1Css.ts) reads
 * nothing else, so one sheet serves every preset. On ink it wears theme.ts
 * .chrome-ink, so the bar and the footer are ink too; the bar is NOT
 * sticky here, and its SIGN IN chip is hidden (l1Css.ts) so OPT IN is the
 * one door. A joined rower, or any signed-in account, never sees this page
 * (page.tsx renders the front). */

/* OPT IN goes to the Rowtember sign-in and lands back on the front page at
 * #join (the same place the front page OPT IN sends a stranger). */
const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";

/* What the tiles paint when there is no rower to draw: the mark alone. */
const BARE: ShareData = { displayName: "", rowerNumber: 0, instagram: "", meters: 0, sessions: 0, byDay: {} };

/* ARCHIVO BLACK, as a share of the em — the advances and every kerned pair
 * of the face the page loads, the same measurement raceday/page.tsx fits
 * its bill with (kept in step by hand: that table is private to its page).
 * A server page has no measuring context, so each display line is given
 * its width in ems here and CSS sizes it calc(100cqw / var(--k)). */
const ADV: Record<string, number> = {
  A: 0.778, B: 0.778, C: 0.778, D: 0.778, E: 0.722, F: 0.667, G: 0.833,
  H: 0.833, I: 0.389, J: 0.667, K: 0.833, L: 0.667, M: 0.944, N: 0.833,
  O: 0.833, P: 0.722, Q: 0.833, R: 0.778, S: 0.722, T: 0.722, U: 0.833,
  V: 0.778, W: 1, X: 0.778, Y: 0.778, Z: 0.722,
  /* The space is wider than the bill has it: fitted here with one and two
   * of them in a line and read off the screenshot, .333 ran the ink 17px
   * past a 1000px measure. */
  " ": 0.43, ",": 0.333, ".": 0.333,
};
const DIGIT = 0.667;
const KERN: Record<string, number> = {
  AC: -0.018, AG: -0.018, AO: -0.018, AQ: -0.019, AT: -0.069, AU: -0.034,
  AV: -0.055, AW: 0.008, AY: -0.085, BA: -0.017, BU: -0.026, "B,": 0.025,
  "B.": 0.016, "C,": 0.025, "C.": 0.017, DA: -0.043, DV: -0.034, DW: 0.017,
  DY: -0.034, "D,": -0.01, "D.": -0.017, FA: -0.094, "F,": -0.146,
  "F.": -0.153, "G,": 0.016, "G.": 0.01, JA: -0.026, "J,": -0.018,
  "J.": -0.026, KC: -0.034, KG: -0.034, KO: -0.034, LC: -0.017, LG: -0.017,
  LO: -0.017, LT: -0.051, LU: -0.026, LV: -0.051, LW: -0.017, LY: -0.077,
  NA: -0.01, OA: -0.034, OT: -0.026, OV: -0.043, OW: -0.017, OX: -0.052,
  OY: -0.068, "O,": -0.017, "O.": -0.026, PA: -0.085, "P,": -0.18,
  "P.": -0.188, QA: 0.017, QT: -0.018, QV: -0.043, QY: -0.051, "Q,": 0.033,
  "Q.": 0.017, RC: -0.018, RG: -0.018, RO: -0.017, RQ: -0.02, RT: -0.009,
  RU: -0.017, RV: -0.017, RY: -0.043, TA: -0.068, TC: -0.034, TG: -0.034,
  TO: -0.034, TQ: -0.034, "T,": -0.146, "T.": -0.153, UA: -0.034,
  "U,": -0.026, "U.": -0.034, VA: -0.057, VC: -0.034, VG: -0.034,
  VO: -0.034, VQ: -0.034, "V,": -0.12, "V.": -0.128, WC: -0.017,
  WG: -0.017, WO: -0.017, "W,": -0.043, "W.": -0.052, XC: -0.034,
  XG: -0.034, XO: -0.034, YA: -0.094, YC: -0.06, YG: -0.06, YO: -0.06,
  YS: -0.043, "Y,": -0.162, "Y.": -0.17,
};
/* The display lines are tracked at -.02em (l1Css.ts .l1-dare, .l1-next).
 * Counted on the gaps, not the glyphs: CSS tracks after the last character
 * too, and it is the ink that has to reach the edge. */
const TRACK = 0.02;

function fitK(text: string): number {
  const s = text.toUpperCase();
  let em = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    em += ch >= "0" && ch <= "9" ? DIGIT : (ADV[ch] ?? ADV.A);
    if (i > 0) em += KERN[s[i - 1] + ch] ?? 0;
  }
  return Math.max(0.5, em - Math.max(0, s.length - 1) * TRACK);
}

const k = (n: number): CSSProperties => ({ "--k": n.toFixed(3) }) as CSSProperties;
const kl = (n: number): CSSProperties => ({ "--kl": n.toFixed(3) }) as CSSProperties;

const num = (n: number) => n.toLocaleString("en-US");

/* The dots between facts, with a break allowed on either side. */
const DOT = " · ";

/* THE DATELINE, from the clock draft (L5, 2026-09-30): the month on the
 * left, the day of it on the right, a 2px rule, then one cell per day with
 * the days gone — today with them — filled. */
function Dateline({ today }: { today: number }) {
  return (
    <div className="l1-top">
      <p className="l1-date mono">
        <b>{MONTH.label}</b>
        <span>
          Day {today} of {MONTH_DAYS}
        </span>
      </p>
      <div className="l1-days" role="img" aria-label={`Day ${today} of ${MONTH_DAYS}`}>
        {Array.from({ length: MONTH_DAYS }, (_, i) => (
          <i key={i} className={i < today ? "on" : undefined} />
        ))}
      </div>
    </div>
  );
}

/* THE POSTER. Four lines on a phone, each its own size so each ends on the
 * measure; two lines from 900px, where four would be taller than a laptop.
 * The month line never outgrows the line above it (MAY is a short word).
 * The month is the one word in the accent — it is a headline, and the
 * month is the news. */
function Dare() {
  const goal = num(GOAL_METERS);
  const row = "Row";
  const meters = "Meters";
  const month = `in ${MONTH_WORD}`;
  const lineA = `${row} ${goal}`;
  const lineB = `${meters} ${month}`;
  return (
    <h1 className="l1-dare" aria-label={`Row ${goal} meters in ${MONTH_WORD}`}>
      <span className="l1-ln" style={kl(fitK(lineA))} aria-hidden="true">
        <span className="l1-w" style={k(fitK(row))}>
          {row}
        </span>{" "}
        <span className="l1-w" style={k(fitK(goal))}>
          {goal}
        </span>
      </span>{" "}
      <span className="l1-ln" style={kl(Math.max(fitK(lineB), fitK(lineA)))} aria-hidden="true">
        <span className="l1-w" style={k(fitK(meters))}>
          {meters}
        </span>{" "}
        <span className="l1-w" style={k(Math.max(fitK(month), fitK(meters)))}>
          in <em>{MONTH_WORD}</em>
        </span>
      </span>
    </h1>
  );
}

/* THE TWO LIVE FIGURES: rowers with a meter this month, and everyone's
 * meters together, counting up (MeterCount). Mono cap labels, tabular
 * figures; two ruled rows on a phone, two cells from 640px. */
function Live({ rowers, meters, allTime }: { rowers: number; meters: number; allTime?: boolean }) {
  /* The 1st of a month, before anyone has logged: the all-time figures,
   * said so, rather than two zeros under the headline. */
  const tail = allTime ? " · all time" : "";
  return (
    <dl className="l1-live">
      <div>
        <dt className="mono">Rowers{tail}</dt>
        <dd>{num(rowers)}</dd>
      </div>
      <div>
        <dt className="mono">Meters{tail}</dt>
        <dd>
          <MeterCount value={meters} />
        </dd>
      </div>
    </dl>
  );
}

/* OPT IN as a block in the accent: the one control on the page, where a
 * thumb lands. */
function Go() {
  return (
    <div className="l1-act">
      <Link className="l1-cta mono" href={SIGN_IN}>
        <span>Opt in</span>
        <span className="arr" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  );
}

function Head({ label, note }: { label: string; note?: string }) {
  return (
    <h2 className="l1-h">
      {label}
      {note ? <span>{note}</span> : null}
    </h2>
  );
}

/* HOW IT COUNTS: three verbs, a fact under each. */
function Steps() {
  const steps = [
    { h: "Row", p: "Any rowing machine, any gym, any distance." },
    { h: "Log it", p: "Meters, time and two photos of the monitor." },
    { h: "It counts", p: "On your page and on the board, the minute you log it." },
  ];
  return (
    <ol className="l1-steps">
      {steps.map((s, i) => (
        <li key={s.h}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* THE CARDS a rower posts after a row: the share dialog's month card and
 * profile card, painted off the example rower's real month, each on an ink
 * tile (owner, 2026-09-30: seeing that after a row you can post the card).
 * With no rower to draw — the 1st, or the example masked by a blackout —
 * the mark alone. */
function Cards({ eg }: { eg: LandingExample | null }) {
  return (
    <>
      <div className={eg ? "l1-tiles" : "l1-tiles l1-bare"}>
        {eg ? (
          <L4Cards data={eg.share} ids={["rowtember-month", "rowtember-profile"]} />
        ) : (
          <L4Cards data={BARE} ids={["rowtember-logo"]} />
        )}
      </div>
      {eg ? (
        <p className="l1-eg mono">
          <b>Rower {fmtRowerNumber(eg.rowerNumber)}</b>
          {DOT}
          <a href={`/row100k/r/${eg.rowerNumber}`}>{eg.name}</a>
          {DOT}
          <span className="l1-nb">
            {fmtMeters(eg.meters)} in {eg.sessions} {eg.sessions === 1 ? "row" : "rows"}
          </span>
        </p>
      ) : null}
    </>
  );
}

/* The page's colours, as variables the sheet reads: the ground, the type
 * on it at the theme's four weights, the hairline, and the accent cut for
 * that ground with the type a slab of it carries. The three water
 * variables follow the accent so the focus ring and anything else from
 * theme.ts agrees with the page. */
function vars(p: Palette, ground: PaletteGround): CSSProperties {
  const ink = ground === "ink";
  const a = accentOn(p, ground);
  return {
    "--l1-bg": ink ? INK : "var(--paper)",
    "--l1-fg": ink ? PAPER : INK,
    "--l1-soft": ink ? "rgba(244,243,238,.74)" : "var(--ink-soft)",
    "--l1-key": ink ? "rgba(244,243,238,.62)" : "var(--gray)",
    "--l1-hair": ink ? "rgba(244,243,238,.26)" : "var(--line)",
    "--l1-accent": a.accent,
    "--l1-accent-hover": a.hover,
    "--l1-caps": capsOn(a.accent),
    "--water": a.accent,
    "--water-hover": a.hover,
    "--water-pale": a.pale,
    background: "var(--l1-bg)",
    color: "var(--l1-fg)",
  } as CSSProperties;
}

/* `ground` is the preset's, or ink under the ink look (sitePalette.ts
 * landingGround): the accent is the preset's cut for whichever it is. */
export function L1({ data, palette, ground }: { data: LandingData; palette: Palette; ground: PaletteGround }) {
  const today = Math.min(MONTH_DAYS, Math.max(1, data.today));
  const ink = ground === "ink";
  const root = ["row100k", "l1", ink ? "chrome-ink l1-ink" : "l1-paper", archivo.variable, archivoBlack.variable, spaceMono.variable].join(" ");

  return (
    <div className={root} style={vars(palette, ground)} data-palette={palette.id}>
      <style>{css}</style>
      <style>{l1Css}</style>
      <RowBar active="home" sticky={false} signedIn={false} rowerNumber={null} admin={false} />

      <header className="l1-fold">
        <div className="wrap front l1-poster">
          <Dateline today={today} />
          <p className="l1-eye mono">The monthly rowing challenge</p>
          <Dare />
          {/* OPT IN straight under the sentence, the figures after it
              (owner, 2026-10-01, on his phone: "I need the opt in button
              above the fold — above the stats, the stats side by side
              below it"). */}
          <Go />
          {data.month.meters > 0 ? (
            <Live rowers={data.month.active} meters={data.month.meters} />
          ) : (
            <Live rowers={data.all.active} meters={data.all.meters} allTime />
          )}
        </div>
      </header>

      <main className="l1-body">
        <div className="wrap front">
          <section className="l1-sec">
            <Head label="How it counts" />
            <Steps />
          </section>

          <section className="l1-sec">
            <Head label="The cards" note="After every row" />
            <Cards eg={data.example} />
          </section>
        </div>
      </main>

      <section className="l1-close">
        <div className="wrap front">
          {data.nextNumber ? (
            <p className="l1-next">
              Number {fmtRowerNumber(data.nextNumber)} is next. <span>Yours for life.</span>
            </p>
          ) : null}
          <Go />
        </div>
      </section>

      <RowFooter front />
    </div>
  );
}
