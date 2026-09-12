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

/* THE HOUSE MARK, at the size the flyer shows it (rdCss .rd-mark clamps it
 * to 112–200px). 1170 source pixels into 172 is 6.8x, so retina is not a
 * question here and there is no second cut to make. */
const MARK_W = 172;
const MARK_PAD = 14;

/* THE FOOT PICTURE: the race day card itself, 1200x630 — the same file the
 * page hands a link preview (raceday/page.tsx metadata), so the picture in
 * the letter and the picture Facebook draws are one file with nothing to
 * keep in step. That coupling is the point, but it cuts both ways: re-cut
 * the OG card and the foot of this mail is re-cut with it. If the two ever
 * have to differ, copy it to raceday/mail-foot.jpg and point this there
 * rather than forking the page's meta. */
const FOOT = { src: "/row100k/raceday/og.jpg", w: 1200, h: 630 };

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

/* ------------------------------------------------------------- the srcs */

/* WHERE THE PICTURES LIVE. A mail has no site under it, so a site-relative
 * path resolves to nothing (or worse, to the mail client's own host): every
 * src here is absolute. An origin handed in by the caller wins — the
 * preview passes its own, which is what lets a picture be looked at on
 * localhost before it is deployed — else the env, else the domain we
 * actually live on. That is the ladder resolveBaseUrl walks for emailed
 * order links, so the sender does not have to pass anything for this to be
 * right in production.
 *
 * NO BASE, NO IMG TAG. A base that is not http(s) returns null and the
 * caller then writes no picture at all: a letter missing a picture reads as
 * a letter, a broken image box reads as a mistake. With the default chain a
 * base always exists, so that path is reachable only when somebody sets the
 * var to nonsense — precisely when you want it to fail quietly.
 *
 * The trim is not theoretical: .env.local ends its base URL with a space.
 * dotenv strips it today, so this is a belt — but a src with a space in it
 * is a dead image, and the belt costs six characters. */
function assetUrl(base: string | undefined, path: string): string | null {
  const b = (base ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://mikianmusser.com")
    .trim()
    .replace(/\/+$/, "");
  return /^https?:\/\//i.test(b) ? `${b}${path}` : null;
}

/* THE HOUSE: the gym's mark and the room, set the way the race day page
 * sets them — mark left, room right, and NO EYEBROW over either (owner,
 * 2026-09-11: "Remove the house on race day ads"). The page and the ads
 * both dropped the label that day, so a label here would split them.
 *
 * WHY THE MARK RIDES AN INK PANEL, which is the whole problem of this
 * change. The file is keyed WHITE ON TRANSPARENT — 130,204 opaque pixels
 * and every one of them pure white, counted rather than guessed — and this
 * paper is cream, so dropped straight on the sheet it is not a faint mark,
 * it is a 172px hole. The panel gives it back the ground it was keyed for,
 * and that ground is INK: the same black the ROWTEMBER slab at the top of
 * this mail already is, and the same black the gym sets its own mark on.
 * bgcolor AND the inline background, because Outlook and some Android
 * clients read only the attribute and nothing reads only the style.
 *
 * WE DO NOT RECOLOUR THEIR LOGO. An ink-on-transparent second key is
 * producible the same way the white one was (scratchpad/tsb-logo.js) and it
 * would sit on cream with no panel — but a sponsor's mark is not ours to
 * restyle, and it would be a second file to keep in step with whatever the
 * gym does to theirs next. The panel presents their asset untouched.
 *
 * BLOCKED, THE PANEL IS STILL THE CREDIT, and that is the argument for it
 * over every other treatment: the alt is styled ON THE IMG, which is what
 * Gmail and Apple Mail draw when they refuse to fetch, so a suppressed mark
 * comes out as THE STRIP BARBELL in white on the same black — their
 * wordmark, near enough. One construction serves both states. The same type
 * is what renders when there is no base URL at all.
 *
 * `venue`, never `venueLine`: the town came off every race surface (owner,
 * 2026-09-11: "we just keep it at the strip barbell engine room"). That
 * rule used to live on the evening paragraph, which is gone; it binds this
 * line now.
 *
 * THE ROOM HERE IS SALVAGE, not restored copy. It was inside the block he
 * cut this morning and it was the one thing in there a rower who has never
 * been to this gym cannot do without. Three words of mono, in the same
 * breath as the branding he asked for. */
function houseBlock(r: RaceDef, base?: string): string {
  const mark = r.venueMark;
  const src = mark ? assetUrl(base, mark.src) : null;
  const h = mark ? Math.round(MARK_W / mark.ratio) : 0;
  /* The wordmark styling is set on the img as well as on the fallback div,
   * so the two states are one design rather than two. text-transform is in
   * there for the IMG: alt text inherits it, and without it a blocked mark
   * reads "The Strip Barbell" in mixed case while the no-base-URL fallback
   * reads THE STRIP BARBELL — two different wordmarks for the same hole. */
  const type = `font-family:${BLACK};font-weight:900;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none;`;
  const inner =
    src && mark
      ? `<a href="${escape(r.venueUrl)}" style="text-decoration:none;"><img src="${escape(src)}" alt="${escape(mark.alt)}" width="${MARK_W}" height="${h}" style="display:block;border:0;width:${MARK_W}px;height:${h}px;${type}"></a>`
      : `<div style="${type}">${escape(r.venue.toUpperCase())}</div>`;
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`,
    `<tr>`,
    `<td bgcolor="${INK}" width="${MARK_W + MARK_PAD * 2}" style="background:${INK};padding:${MARK_PAD}px;">${inner}</td>`,
    `<td align="right" style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${INK_SOFT};padding-left:14px;">${escape(r.room.toUpperCase())}</td>`,
    `</tr>`,
    `</table>`,
  ].join("");
}

/* THE PICTURE, last of everything — pinned under the sign-off the way a
 * photograph is pasted under a letter.
 *
 * IT IS AT THE BOTTOM FOR A REASON WORTH WRITING DOWN, and not only because
 * he asked for it there. A blocked picture still reserves the box it
 * declares — 560 by 294 of empty cream with a line of alt in it — and
 * anywhere above the wave number that box is a wall between a rower on a
 * gym floor and the two facts they opened the mail for. Below the sign-off
 * it costs nothing: the letter has already ended.
 *
 * WIDTH AND HEIGHT AS ATTRIBUTES, not only as style: Outlook on Windows
 * ignores max-width on an img outright and would print 1200px of picture
 * through the side of a 560px letter. The style is what brings it down on a
 * phone, where the column is narrower than 560 and height:auto has to undo
 * the height attribute.
 *
 * The alt is written off the race rather than typed. The card bakes SUN SEP
 * 27 into its pixels, so if the day ever moves the file has to be recut —
 * and the words under a blocked picture should not be the last thing still
 * telling the truth. NOT LINKED, deliberately: a rower has their wave in
 * the mail, and the plain twin would then owe a third URL. */
function raceGraphic(r: RaceDef, base?: string): string {
  const src = assetUrl(base, FOOT.src);
  if (!src) return "";
  const h = Math.round((COL * FOOT.h) / FOOT.w);
  return [
    `<tr><td style="padding:22px 0 0;">`,
    `<img src="${escape(src)}" alt="${escape(`${r.title} · ${r.when}`)}" width="${COL}" height="${h}" style="display:block;border:0;width:100%;max-width:${COL}px;height:auto;-ms-interpolation-mode:bicubic;font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${INK_SOFT};">`,
    `</td></tr>`,
  ].join("");
}

/* The page: the mark in an ink box (was blue — see the monochrome note at
 * the top), a mono kicker, the blocks, the sign-off on a solid rule, and
 * whatever `foot` carries under all of it. The foot is a row rather than
 * part of the sign-off so that a picture which never loads leaves the
 * letter ending on "See you Sunday." and nothing else. */
function shell(kicker: string, blocks: string[], signoff: string, foot = ""): string {
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
    foot,
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
  /* Where the two pictures are served from. Nobody has to pass it: left
   * off, assetUrl falls through to the env and then to the live domain.
   * The preview passes its own origin so that localhost shows localhost's
   * copies rather than whatever is deployed. */
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
            small(`${r.when} · ${r.venue}`.toUpperCase(), INK) +
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
        block(houseBlock(r, o.baseUrl)),
      ],
      "See you Sunday.",
      raceGraphic(r, o.baseUrl),
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
      /* The house, unlabelled, the way the HTML twin carries it — the mark
       * is a picture and this is the same credit in words. The picture at
       * the foot of the HTML has no line here on purpose: its alt says the
       * day, and the day is already two lines up. */
      `${r.venue} · ${r.room}`,
      r.venueUrl,
      ``,
      `See you Sunday.`,
    ].join("\n"),
  };
}
