import { fmtRaceClock, waveTime, type RaceDef } from "./raceday";

/* THE WAVE NOTE (owner, 2026-09-10: "we should email them what wave they
 * are whenever we assign them"). One email, sent from the wave console:
 * which wave a rower is in and when it goes off, the day, the place, and
 * when to be in the door. Plain text with a Rowtember-styled HTML twin,
 * built the way the shirt mails are (shirtEmail.ts) — cream paper, ink type,
 * mono uppercase eyebrows, the ROWTEMBER mark white in an ink box.
 *
 * WHAT HE CUT, 2026-09-12: the distance SENTENCE ("One piece, one clock — men
 * and women scored apart"), the tail of the arrival line ("so you can warm
 * up, find your erg and set your monitor"), THE EVENING block and WHAT TO
 * BRING. The distance did NOT go with the first — he struck the copy and
 * not the number, so the eyebrow and the 5,000 m figure stand; the doors,
 * the hours and the wave cadence went with the third, and the note now
 * gives a rower their own minute instead of the room's. THE ROOM survived,
 * down in the house credit: it was the one thing in that paragraph a rower
 * who has never been to this gym cannot do without — which door. The waiver
 * stays. He did not ask, and the gym needs it signed.
 *
 * MONOCHROME, like the rest of race day (owner, 2026-09-11: "on the race
 * day sign up, let us stick with monochromatic — just black and whites,
 * whites on black"). He said it of the page, and this note is the only
 * other thing a rower reads with race day on it — the one they read on
 * their phone ON THE 27TH — so it wears the same palette rather than
 * arriving in the site's water blue. The shirt mails keep the blue; only
 * this one gives it up. TO PUT IT BACK is one line: restore
 * const WATER = "#0077B6" and swap it in at the four INK uses marked
 * below (the mark, the clock, the venue line, the waiver link). The house
 * panel is a FIFTH ink surface and is NOT one of them: it is ink because
 * the gym's mark is white, not because this mail gave up blue.
 *
 * What carries the emphasis instead is the ink ladder the mail already
 * had: INK is the loud one, INK_SOFT a step under it, GRAY the quiet
 * furniture — the same trick the page plays with greys of white.
 *
 * The furniture is copied from shirtEmail rather than shared: that file
 * keeps its pieces to itself, and one template two features edit at once
 * is a template nobody dares change. Inline styles only and no style block
 * — mail clients strip both. Server only.
 *
 * TWO PICTURES NOW, AND THEY CARRY NOTHING (owner, 2026-09-12: "include the
 * Strip Barbell branding and logo ... include the Rowtember race day graphic
 * at the bottom"). This header said NO IMAGES until that line, and the
 * reason it said so is still true — every client blocks pictures from a
 * sender a rower has never had mail from, and this is the note they open in
 * a gym minutes before they pull. So the ban became a RULE, and it is the
 * rule that replaces it: the wave, the clock, the day, the gym, the room
 * and the arrival time are TYPE, and a picture may only say again what type
 * has already said. Nothing load bearing is ever a pixel. Do not take that
 * on trust — the preview route serves ?images=blocked, which is the mail
 * most rowers will actually get. */

export type RaceMail = { subject: string; text: string; html: string };

/* ---------------------------------------------------------------- tokens */

const PAPER = "#F4F3EE";
const INK = "#15171A";
const INK_SOFT = "#3B3E42";
const GRAY = "#8A8A85";
const LINE = "#C9C8C0";

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";
const BLACK = "'Arial Black',Arial,Helvetica,sans-serif";
const SANS = "Arial,Helvetica,sans-serif";

const NUM = (n: number) => String(n).padStart(3, "0");
const M = (n: number) => Math.round(n).toLocaleString("en-US");

/* THE COLUMN. The shell's table is max-width 560 and its rows carry no side
 * padding, so 560 is the whole measure — what a picture has to be cut to,
 * not 600. */
const COL = 560;

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------------------------------------------------------------- pieces */

const eyebrow = (t: string) =>
  `<div style="font-family:${MONO};font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${GRAY};margin:0 0 8px;">${escape(t)}</div>`;

const body = (t: string) =>
  `<p style="margin:10px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK_SOFT};">${escape(t)}</p>`;

const small = (t: string, color = GRAY) =>
  `<div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${color};line-height:1.7;margin:8px 0 0;">${escape(t)}</div>`;

/* The big figure: Archivo Black on the site, Arial Black in the mail. */
const big = (inner: string, color = INK, size = 40) =>
  `<div style="font-family:${BLACK};font-weight:900;font-size:${size}px;line-height:1.05;letter-spacing:-.02em;color:${color};">${inner}</div>`;

/* One block: a hairline, an eyebrow, whatever follows. */
const block = (inner: string, first = false) =>
  `<tr><td style="padding:18px 0 20px;border-top:${first ? `2px solid ${INK}` : `1px dashed ${LINE}`};">${inner}</td></tr>`;


/* The page: the mark in an ink box (was blue — see the monochrome note at
 * the top), a mono kicker, the blocks, and the sign-off on a solid rule.
 * There is no foot any more: it existed to carry a picture under the
 * sign-off, and the owner took every picture back off this letter on
 * 2026-09-12, so the letter ends on "See you Sunday." and nothing else. */
function shell(kicker: string, blocks: string[], signoff: string): string {
  return [
    `<div style="background:${PAPER};padding:28px 16px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">`,
    `<tr><td style="padding:0 0 16px;">`,
    `<span style="display:inline-block;background:${INK};color:#ffffff;font-family:${BLACK};font-weight:900;font-size:13px;letter-spacing:.14em;padding:7px 10px 6px;vertical-align:middle;">ROWTEMBER</span>`,
    `<span style="display:inline-block;font-family:${MONO};font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${GRAY};padding-left:12px;vertical-align:middle;">${escape(kicker)}</span>`,
    `</td></tr>`,
    ...blocks,
    `<tr><td style="padding:18px 0 0;border-top:2px solid ${INK};">`,
    `<div style="font-family:${BLACK};font-weight:900;font-size:18px;color:${INK};">${escape(signoff)}</div>`,
    small("Rowtember 2026 · Mikian Musser"),
    `</td></tr>`,
    `</table>`,
    `</div>`,
  ].join("\n");
}

/* ------------------------------------------------------------- the clock */

/* Show up this many minutes before your own wave (owner, 2026-09-10:
 * "arrive fifteen minutes before your wave — say it plainly"). */
export const ARRIVE_EARLY_MIN = 15;

/* When to be in the door for wave n. The clock itself is raceday.ts's
 * fmtRaceClock — this file used to carry its own six-line copy of it, back
 * when raceday.ts only formatted WHOLE waves; the moment the doors became
 * instants that every surface has to print, one Pacific clock became the
 * only sane arrangement. */
export function arriveTime(r: RaceDef, wave: number): string {
  const off = r.firstWaveAt + (Math.max(1, wave) - 1) * r.waveMinutes * 60_000;
  return fmtRaceClock(off - ARRIVE_EARLY_MIN * 60_000);
}

/* -------------------------------------------------------------- the mail */

/* Their wave, and everything they need to turn up for it. Sent when a wave
 * is first assigned and again whenever it changes — the console forgets
 * the telling on every change, so a moved rower is always told again. */
export function waveEmail(o: {
  race: RaceDef;
  name: string;
  rowerNumber: number;
  wave: number;
  /* They have already told us the gym's waiver is signed, so the note does
   * not ask again (owner sent the link 2026-09-11). */
  waiverSigned?: boolean;
  /* Kept, though nothing in the letter reads it today: it was where the
   * two pictures were served from, and the owner took both off on
   * 2026-09-12. The preview route still passes its own origin, and the
   * next thing that needs an absolute address will want exactly this. */
  baseUrl?: string;
}): RaceMail {
  const r = o.race;
  const go = waveTime(r, o.wave);
  const arrive = arriveTime(r, o.wave);
  const who = `${o.name} · rower ${NUM(o.rowerNumber)}`;
  /* THE TAIL CAME OFF THIS, 2026-09-12 ("we can remove the rest of it, so
   * you can warm up, find your erg and set your monitor. Remove that last
   * part"). He kept the instruction and cut the reasoning: a rower does not
   * need to be told why fifteen minutes is fifteen minutes. */
  const arriveLine = `Be here by ${arrive} — fifteen minutes before your wave.`;
  /* The waiver: the gym's, signed on the gym's own system. Only in the note
   * when it is still owed, and never a threat — it takes a minute. */
  const waiver = r.waiver && !o.waiverSigned ? r.waiver : null;
  const waiverLine = waiver
    ? `The gym needs a signed waiver before you pull. It takes a minute: ${waiver.url}`
    : null;

  return {
    /* The subject names the wave and when it goes off — the two things a
     * rower reads off a lock screen and acts on. */
    subject: `${r.title} — wave ${o.wave} at ${go}, ${r.when}`,
    html: shell(
      `${r.title} · Your wave`,
      [
        block(
          eyebrow("Your wave") +
            /* A hard space inside the clock so a narrow phone never leaves
             * the AM stranded on a line of its own. The clock was blue;
             * monochrome, it is one step down the ink ladder, so the WAVE
             * is still the thing and the time still rides with it. */
            big(`Wave ${o.wave}<span style="color:${INK_SOFT};"> · ${escape(go.replace(" ", " "))}</span>`, INK, 34) +
            small(`${r.when} · ${r.venue} · ${r.room}`.toUpperCase(), INK) +
            small(who) +
            body(arriveLine),
          true,
        ),
        /* THE FIGURE WITHOUT THE SENTENCE. He struck the copy under it and
         * not the number, and a race note that never says how far would be
         * a strange thing to send. It stands alone now, as a stamp. */
        block(eyebrow("The distance") + big(`${escape(M(r.meters))} m`, INK, 34)),
        ...(waiver
          ? [
              block(
                eyebrow("One thing first") +
                  body("The gym needs a signed waiver before you pull. It takes a minute.") +
                  `<p style="margin:14px 0 0;"><a href="${escape(waiver.url)}" style="color:${INK};font-weight:700;text-decoration:underline;">Sign the waiver</a></p>`,
              ),
            ]
          : []),
      ],
      "See you Sunday.",
    ),
    text: [
      `ROWTEMBER 2026 — ${r.title.toUpperCase()}`,
      ``,
      `YOUR WAVE`,
      `Wave ${o.wave} at ${go} · ${r.when} · ${r.venue}`,
      who,
      arriveLine,
      ``,
      `THE DISTANCE`,
      `${M(r.meters)} m`,
      ``,
      ...(waiverLine ? [`ONE THING FIRST`, waiverLine, ``] : []),
      /* No house credit and no picture line. Both twins carried the gym
       * and the room for about an hour; the owner took the graphics off
       * and the room went up into the venue line with the day, which is
       * the lockup he asked to keep. Nothing here is missing a fact. */
      `See you Sunday.`,
    ].join("\n"),
  };
}
