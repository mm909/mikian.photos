import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment, type CSSProperties } from "react";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { hoursLine, raceOpenFor, racePhase, waveTime } from "../raceday";
import { resolvedRace } from "../racedaySettings";
import { listRacers } from "../racedayData";
import { FIELD_SHOWS_AT, Field } from "./Field";
import { RaceShare, type RaceFacts } from "./RaceShare";
import { rdCss } from "./rdCss";
import { SignupPanel } from "./SignupPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race day — 100K September",
  robots: { index: false, follow: false },
};

/* RACE DAY (owner, 2026-09-10): a timed 5,000 m trial at The Strip Barbell
 * on the last Sunday of Rowtember. Free — a rower registers, the owner puts
 * them in a wave, and an email tells them which one.
 *
 * THE PAGE IS THE FLYER (owner, 2026-09-11, looking at the story ad: "I
 * really like the flyer — the first flyer, with RACE DAY that are on top of
 * each other. Let us see if that can be the UI that we show when we are
 * signing up"). The stub of facts this page used to open with is gone; the
 * bill is here instead, in the order the ad sets it: a thick rule, the
 * promoter line with the day flush right, RACE over DAY jammed to the
 * measure, a hairline, the piece, the first wave, the bracketed strip
 * between two rules, THE HOUSE — and then, exactly where the ad prints its
 * OPT IN slab, THE ACT. The canvas source is poster/raceday.ts; this is
 * that composition translated into HTML and CSS, not imported from it, and
 * the two are kept honest by reading the same RaceDef.
 *
 * NOTHING HERE IS TYPED THAT THE RACE ALREADY KNOWS. The hours come from
 * hoursLine(race) and the first wave from waveTime(race, 1), so the console
 * moving a time moves the bill — there is no sentence for it to disagree
 * with. And the race itself comes from resolvedRace(), not currentRace():
 * the bill has to be the race AS IT STANDS, overrides and all, or the owner
 * moving the first wave in /row100k/race-admin would mail every rower one
 * time while this page went on printing another.
 *
 * WHAT CAME OFF (owner, 2026-09-11, the same message): no ROWED IN WAVES OF
 * EIGHT, no NEW THIS SEPTEMBER, no MEN AND WOMEN SCORED APART, no SIGN UP BY
 * SAT SEP 26, and no registration-closes line anywhere. The rule still
 * refuses a late entry (raceday.closesAt); it simply no longer announces
 * itself. Later the same day, the THE HOUSE label over the venue mark went
 * too ("Remove the house on race day ads") — off the ads and off this page
 * in one pass, because the mark is the credit and naming it twice was the
 * only sentence that block ever spent on itself.
 *
 * IT IS STILL A PAGE. The act is not a picture of a button: sign in, opt in
 * as a racer, sign up as a spectator, the confirmation with the wave once
 * one is assigned, opting out and the waiver ask all live inside the slab
 * at the foot of the bill (SignupPanel). THE RACERS follow underneath, one
 * board table, and only once FIELD_SHOWS_AT names are in it.
 *
 * MONOCHROME (owner, 2026-09-11: "on the race day sign up, let us stick
 * with monochromatic — just black and whites, whites on black"). Everything
 * between the bar and the footer sits on the ink ground of .rd-dark, the
 * water blue is off this surface entirely, and rdCss.ts carries the grey
 * ladder with the contrast it was chosen on.
 *
 * HIDDEN FOR NOW (owner: "this should be hidden in development for now").
 * raceOpenFor is the one switch: open in local dev so the page can be
 * driven signed out, admin-only in production until the owner opens it.
 *
 * BLACKOUT: the field prints TIMES, never meters. A fastest 5k is public
 * even for one of the elite while a window is open (the elite rule hides
 * their meters, not their clock), so this page reads the same to everybody
 * and nothing on it has to be masked. */

/* ARCHIVO BLACK, measured off the face the page actually loads — the
 * next/font build, ctx.measureText at 1000 px in the dev browser — as a
 * share of the em. It is here because the bill FITS each display line
 * flush to the measure: a four-letter word and a three-letter word that
 * span the same column cannot be one size, and that stepped block is the
 * whole look. The canvas ad measures the face to do it (paint.fitSize); a
 * server-rendered page has no measuring context, so it does the same
 * arithmetic from these numbers and hands the answer to CSS as --k. */
const ADV: Record<string, number> = {
  A: 0.778, B: 0.778, C: 0.778, D: 0.778, E: 0.722, F: 0.667, G: 0.833,
  H: 0.833, I: 0.389, J: 0.667, K: 0.833, L: 0.667, M: 0.944, N: 0.833,
  O: 0.833, P: 0.722, Q: 0.833, R: 0.778, S: 0.722, T: 0.722, U: 0.833,
  V: 0.778, W: 1, X: 0.778, Y: 0.778, Z: 0.722,
  " ": 0.333, ",": 0.333, ".": 0.333, "–": 0.5,
};
/* Every digit is one width in this face, which is what lets a bracket of
 * numbers line up at all. */
const DIGIT = 0.667;
/* And every pair it kerns — all 98 of them, off the same measurement. The
 * first cut of this carried only the pairs worth more than .03 em and RACE
 * came out nine pixels short of the rule above it while DAY, whose two
 * pairs were both in the short list, sat flush: on a headline the whole
 * point of which is two lines ending on the same edge, a missing .018 is
 * not a rounding error, it is the design. */
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
/* The bill sets display type at -.02em, the way the ad does. */
const TRACK = 0.02;

/* How many ems of column a line asks for: hand CSS measure / fitK(line)
 * and the ink lands on the measure. The tracking is counted on the GAPS
 * and not the glyphs — CSS adds letter-spacing after the last character
 * too, so the box comes out one step narrower than the ink, and it is the
 * ink that has to reach the edge. */
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

/* --k on the element, calc(100cqw / var(--k)) in the stylesheet. */
const fit = (text: string): CSSProperties => ({ "--k": fitK(text).toFixed(3) }) as CSSProperties;
/* --kb: the three bracket values share ONE size, the largest at which the
 * longest of them fits a cell, because a bracket of unequal numbers reads
 * as three separate things. */
const fitAll = (texts: string[]): CSSProperties =>
  ({ "--kb": Math.max(...texts.map(fitK)).toFixed(3) }) as CSSProperties;

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_WORD = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export default async function RaceDayPage() {
  const viewer = await resolveViewer();
  // Hidden until the owner opens it: dev for everyone, production for an
  // admin. The same gate the shirt shop wears.
  if (!raceOpenFor(viewer.isAdmin)) notFound();

  // THE RACE AS IT STANDS, not as it shipped: the settings console writes
  // RowRaceSettings and this reads it, so a door or a first wave moved at
  // 4 PM is on the bill at 4 PM. racedaySettings fails open — a settings
  // table that cannot be read costs the overrides, never the page.
  const race = await resolvedRace();
  const phase = racePhase(race);
  const racers = await listRacers(race);
  // A withdrawal keeps its row so the wave console can see the hole it
  // leaves; the FIELD is only the names still in.
  const live = racers.filter((r) => r.withdrewAt === null);
  // THE FIELD IS THE START LIST, so it is RACERS (owner, 2026-09-11: a
  // spectator gets no wave and no erg). The people coming to watch are a
  // number beside it — they are in the room, they are not in the race.
  const field = live.filter((r) => r.role === "racer");
  const watching = live.length - field.length;
  const mine = viewer.myParticipantId
    ? (racers.find((r) => r.participantId === viewer.myParticipantId) ?? null)
    : null;

  // Noon UTC on race day, so the square never slides either way whatever
  // zone the browser is standing in.
  const day = new Date(`${race.day}T12:00:00Z`);
  const date = `${MON[day.getUTCMonth()]} ${day.getUTCDate()}`;
  const stamp = `${DOW[day.getUTCDay()]} ${date}`;
  // "The Strip Barbell · Las Vegas" → "Las Vegas": the name of the venue is
  // the MARK, so the line beside it carries the town and nothing else.
  const city = race.venueLine.split("·").slice(1).join("·").trim() || race.venueLine;
  // "6:00 – 9:00 PM" → "6 – 9 PM". Derived, never typed: a window at
  // display weight is read, not set by a timer, and the minutes are noise
  // at that size — but moving the doors in the console still moves this.
  const hours = hoursLine(race).replace(/:00/g, "");
  // RACE over DAY. Two words on a title of two, one line on a title of one,
  // and each of them fitted to the column on its own.
  const head = race.title.toUpperCase().split(/\s+/).filter(Boolean);
  // Written once because the bracket cell and the sticker both say it, and a
  // free race that costs money on one of them is the worst kind of typo.
  const price = "FREE";
  const cells = [
    { v: date, s: DAY_WORD[day.getUTCDay()] },
    { v: hours, s: `WAVES EVERY ${race.waveMinutes} MIN` },
    { v: price, s: "RACER OR SPECTATOR" },
  ];

  /* THE SHAREABLES (owner, 2026-09-11: "There should be a shareable for
   * whenever you sign up for race day ... And just a shareable with the
   * event name and logo"). The facts are built HERE, off the same values the
   * bill prints — stamp, hoursLine, the room, the house's own mark — and
   * handed down display-ready: share/cards.ts reads no clock and formats no
   * day, because two surfaces that formatted the same evening their own way
   * would disagree the first time a door moved in the console. The viewer's
   * own half (`mine`) is not in here; the panel adds it, because it knows
   * about an opt-in the moment it happens and this render does not. */
  const raceFacts: RaceFacts = {
    title: race.title.toUpperCase(),
    sub: race.sub.toUpperCase(),
    piece: `${race.meters.toLocaleString("en-US")} M`,
    stamp,
    when: `${stamp} · ${hours} · ${price}`,
    where: `${race.room} · ${city}`.toUpperCase(),
    mark: race.venueMark,
  };

  // The bill wears a stamp once it is over, and nothing while it is open:
  // the day is already the biggest thing on the page.
  const headNote = phase === "closed" ? "REGISTRATION CLOSED" : phase === "raced" ? "RACED" : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{rdCss}</style>
      {/* The rail marks this page: RACE DAY is a nav key now, and it rides
        * the same raceOpenFor switch the page does, so the chip and the page
        * appear for the same people on the same day. */}
      <RowBar active="raceday" {...barProps(viewer)} />

      <div className="rd-dark">
        <section>
          <div className="wrap">
            {/* It IS linked from the bar now — the rail carries RACE DAY on
              * the same raceOpenFor switch — so the note says the thing that
              * is still true: in production this page, and that chip, exist
              * for the owner alone until he opens the race. */}
            <p className="rd-dev">In development · admin only until the race opens</p>

            <div className="rd-bill">
              <div className="rd-rule" />
              {/* The space between the two halves is written, not left to
               * JSX: the spans are flush ends of one flex line, and without
               * it the masthead reads back as ROWTEMBER 2026SUN SEP 27 to a
               * screen reader and to find-in-page. A whitespace-only child
               * of a flex box is not rendered, so nothing moves. */}
              <p className="rd-mast">
                <span>Rowtember {day.getUTCFullYear()}</span>{" "}
                <span>{stamp}</span>
              </p>
              {headNote && <p className="rd-stamp">{headNote}</p>}

              {/* THE HEADLINE IS TWO WORDS, however it is stacked. The fitted
               * spans are blocks with no text between them, so the biggest
               * thing on the page used to read back as one word — RACEDAY —
               * to a screen reader, and find-in-page for "race day" missed
               * it. The title goes on the element as the name; the space
               * between the blocks collapses away, so the picture is
               * untouched and the text is a sentence again. */}
              <h1 className="rd-head" aria-label={race.title}>
                {head.map((line, i) => (
                  <Fragment key={line}>
                    {i > 0 ? " " : null}
                    <span style={fit(line)}>{line}</span>
                  </Fragment>
                ))}
              </h1>
              <div className="rd-hair" />

              <p className="rd-piece" style={fit(race.sub)}>
                {race.sub}
              </p>
              {/* The one time the owner asked for out loud — "maybe we could
               * just say first wave starts at six thirty" — and the only
               * thing about the format a rower has to know before they put a
               * name in. Read off the race, never typed. */}
              <p className="rd-first">First wave {waveTime(race, 1)}</p>

              <ul className="rd-brk" style={fitAll(cells.map((c) => c.v))}>
                {cells.map((c) => (
                  <li key={c.v}>
                    <b>{c.v}</b>
                    <span>{c.s}</span>
                  </li>
                ))}
              </ul>

              {/* THE HOUSE, quietly: their mark, their room, their town, and
               * the waiver that is signed on their system — and no label over
               * it (owner, 2026-09-11: "Remove the house on race day ads").
               * The ads dropped the eyebrow the same day, and the page is the
               * flyer now, so a label here and none there would split them. */}
              <div className="rd-house">
                <div className="rd-houseRow">
                  {race.venueMark ? (
                    <a
                      className="rd-marklink"
                      href={race.venueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        className="rd-mark"
                        src={race.venueMark.src}
                        alt={race.venueMark.alt}
                        width={1000}
                        height={Math.round(1000 / race.venueMark.ratio)}
                      />
                    </a>
                  ) : (
                    <p className="rd-room">
                      <b>{race.venue}</b>
                    </p>
                  )}
                  <p className="rd-room">
                    <b>{race.room}</b>
                    <span>{city}</span>
                    {race.waiver && (
                      <a href={race.waiver.url} target="_blank" rel="noopener noreferrer">
                        Waiver · {race.waiver.host}
                      </a>
                    )}
                  </p>
                </div>
              </div>

              {/* THE ACT, where the ad prints OPT IN. */}
              <SignupPanel
                race={race}
                signedIn={viewer.actor !== null}
                joined={viewer.myParticipantId !== null}
                open={phase === "open"}
                mine={mine}
                share={raceFacts}
              />

              {/* THE TEAR-OFF STRIP, and the reason it is HERE: the bill is
               * the last thing anybody reads before they decide, and the one
               * thing a visitor who is NOT ready to sign in can still do with
               * this page is hand it to somebody who is. So the event card
               * closes the sheet the way a strip closes a bill on a wall —
               * under the act, quiet, and reachable signed out, which costs
               * nothing: the payload carries no `role`, so the picker holds
               * exactly the one card that claims nothing about the viewer
               * (share/cards.ts gates the rower's own card on `mine`).
               *
               * IT COMES OFF FOR SOMEBODY ALREADY IN THE FIELD, because for
               * them it is the only thing on the sheet printed twice: their
               * own block holds the same event card as the second chip in its
               * picker. The server read is what decides, so opting in or out
               * takes the strip away and gives it back on the refresh the
               * panel already asks for. */}
              {!(mine && mine.withdrewAt === null) && (
                <div className="rd-tear">
                  <span className="mono">Tell somebody</span>
                  <RaceShare facts={raceFacts} label="Share race day" btn="quiet-btn" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* The start list, once it is one (Field.FIELD_SHOWS_AT). */}
        {field.length >= FIELD_SHOWS_AT && (
          <section>
            <div className="wrap">
              <div className="sec-head">
                <h2>The racers</h2>
                <span className="mono">
                  {field.length} IN THE FIELD
                  {watching > 0 ? ` · ${watching} WATCHING` : ""}
                </span>
              </div>

              <Field race={race} field={field} />
            </div>
          </section>
        )}
      </div>

      <RowFooter />
    </div>
  );
}
