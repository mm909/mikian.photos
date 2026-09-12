/* poster/types.ts — THE CONTRACT for the poster studio.
 *
 * Four streams build against this file and nothing else: DATA
 * (poster/data.ts) fills a PosterData on the server; COMMUNITY
 * (poster/community.ts + charts.ts) and ROWER (poster/rower.ts +
 * rowerCharts.ts) each export one PosterLayout — a module registry plus
 * the plans the engine composes from; ENGINE (formats.ts, engine.ts,
 * paint.ts, pdf.ts, posters/PosterStudio.tsx) sizes the canvas, composes a
 * plan, paints, and ships PNG / PDF / share. The prose half of the design
 * is SPEC.md beside this file; when the two disagree, SPEC.md is wrong and
 * this file wins, because every stream compiles against it.
 *
 * The ask (owner, 2026-09-10): "I want to be able to provide posters for
 * rowers and for Rowtember itself ... a pdf or image with a bunch of
 * stats/graphs ... meant as a summary to hang on a 24x36 poster or 18x24
 * ... also shareable in an insta story and insta post."
 *
 * The idiom is the landing page on paper — "running magazine, not sports
 * app" (owner, 2026-09-05): cream, ink, one matte water-blue number, mono
 * datelines, a few thick rules. Everything here crosses the server → client
 * boundary as a prop, so it is plain JSON: no Dates, no Boards/TotalRow
 * (prevRank is the hidden order), and NOTHING a blackout hides exists here
 * as a number. A hidden value arrives as a Figure with a shape and is drawn
 * as ink blocks; the renderer cannot print what it was never handed. */

import type { FontBox, PostFonts } from "../post/slides";

/* ================================================================ formats */

/* Three logical families. W is fixed per family and H = W × (sheet height
 * / sheet width); the canvas is scaled by pixels / W, so 300 ppi is the
 * same drawing at twice the 150 ppi scale and the phone frames are the
 * drawing at 2×. printL = the wall sizes, three columns, read from six
 * feet. printS = the hand-outs (11x17, A3, letter, A4), two columns, read
 * at arm's length, so one logical unit is a bigger share of the sheet.
 * phone = the three Instagram frames. */
export type PosterFamily = "printL" | "printS" | "phone";

export type PosterFormatKey =
  | "24x36"
  | "18x24"
  | "16x20"
  | "11x17"
  | "a3"
  | "letter"
  | "a4"
  | "story"
  | "post"
  | "square";

/* A plan is one fully specified composition (SPEC.md §7). A format names
 * the first plan of its cascade; when a plan cannot fit its rows even
 * after its shrink order, the engine falls through to `next`. */
export type PosterPlanKey = "tall" | "short" | "squat" | "hand" | "story" | "post" | "square" | "core";

export type PosterPpi = 100 | 150 | 200 | 300;

/* Logical units. For the story the Instagram safe bands are folded into
 * top/bottom (125 / 135 → 250 / 270 px of 1920) so a plan never has to
 * know about them; the covered bands stay paper. */
export type PosterMargins = { top: number; right: number; bottom: number; left: number };

export type PosterFormat = {
  key: PosterFormatKey;
  /* "24 × 36 in", "Story 9:16" — the chip label in the studio. */
  label: string;
  kind: "print" | "instagram";
  family: PosterFamily;
  /* First plan of the cascade for this format. */
  plan: PosterPlanKey;
  /* Logical drawing space: w is the family width (1200 | 720 | 540). */
  w: number;
  h: number;
  /* Print only: TRIM size in inches, no bleed — the PDF page is inches × 72
   * points. Bleed is an engine option (RenderTarget.bleedIn) that adds cream
   * around the same drawing; it never re-lays out the sheet. */
  inches?: { w: number; h: number };
  /* Print only: the ppi ladder. `default` is 150 on the wall sizes (plenty
   * at six feet, and it fits an iPhone's canvas budget), 300 on letter/A4
   * (cheap, read in the hand). The engine walks options behind the
   * allocation probe (engine.ts probeCanvas) and says when it fell back. */
  ppi?: { default: PosterPpi; options: PosterPpi[] };
  /* Instagram only: the fixed pixel frame. */
  pixels?: { w: number; h: number };
  margins: PosterMargins;
  /* File stem after the subject: "poster-24x36" | "story" | "post" |
   * "square" → rowtember-2026-poster-24x36.pdf, rower-023-story.png. */
  stem: string;
};

/* The per-family type scale, in logical units (SPEC.md §3 has the table
 * with what each becomes in points on every sheet). One table per family,
 * defined in formats.ts, read by every module through PosterPaint.tk. */
export type PosterTokens = {
  W: number;
  margin: number;
  gutter: number;
  cols: 1 | 2 | 3;
  /* Archivo Black caps: the nameplate and the headline number are fitted
   * to their measure and never exceed these. */
  nameCap: number;
  headCap: number;
  /* Space Mono lines. */
  datel: number;
  headLabel: number;
  statL: number;
  eye: number;
  row: number;
  rowPitch: number;
  small: number;
  ledger: number;
  ledgerPitch: number;
  axis: number;
  footer: number;
  /* Archivo Black numbers. */
  statN: number;
  recV: number;
  /* Rules and rhythm. */
  thick: number;
  hair: number;
  gap: number;
  /* Set by the ENGINE on the token clone it hands a module once the plan
   * has spent the matching shrink step (SPEC.md §8.4) — never in
   * formats.ts. `step`: the club roll and the log draw at their small type
   * step. `chart`: the curve and the pace are being measured at their
   * minimum (the engine already uses minH for them; the flag is for a
   * module that wants to know). Absent = not spent. */
  step?: boolean;
  chart?: boolean;
};

/* ================================================================== fonts */

/* The hashed next/font families read off the three laid-out probes
 * (PostPack.readFonts + boxOf idiom, copied under a .po- prefix) after
 * `await document.fonts.ready`, plus the DOM line-box ratios. Structurally
 * a cards.ts ShareFonts too, so drawBlockDigits / drawBlockClock accept it
 * as-is. Never hardcode a family: the hash changes with theme.ts. */
export type PosterFonts = PostFonts;
export type { FontBox };

/* What a module asks the paint helper for; the helper turns it into the
 * ctx.font shorthand with the hashed family LAST (boxFor matches the family
 * by substring, Archivo Black checked before Archivo). */
export type PosterFace = "black" | "mono" | "monoBold" | "archivo" | "archivoSemi" | "archivoBold";

/* ================================================================ figures */

/* The ONE hidden-value mechanism (graft from the ledger design). Exactly
 * one of: `text` — a formatted PUBLIC string ("142,300 m", "17:48.3",
 * "7.5 h", "—"); `shape` — its silhouette from blackoutRules shapeOf /
 * clockShape / partialShape ("###,### m", "#:##:##", "##:##.#",
 * "142,###"), one ink block per "#", every other glyph drawn as itself.
 * The run-up rides on the same field: a partialShape is just a shape. */
export type Figure = { text: string; shape?: never } | { shape: string; text?: never };

/* ================================================================== data */

export type Division = "M" | "F";

/* Built server-side from the fixed UTC-7 clock (row100k.ts daysElapsed).
 * `final` is true from END_MS (Oct 1 07:00 UTC): a hung poster reads
 * FINAL; the site's "LATE LOGS THROUGH OCT 3" is a web caveat the studio
 * prints beside the buttons, never on paper. */
export type PosterAsOf = {
  /* "Sep 10" */
  day: string;
  /* "2026-09-10" (Pacific day) */
  iso: string;
  /* 1..30 — 30 after Sep 30 */
  dayNumber: number;
  final: boolean;
  year: number;
  /* The masthead's mono line, built once: community "SEP 10 · DAY 10 OF 30"
   * | "SEP 30 · FINAL"; rower "ROWTEMBER 2026 · MEN’S BOARD · 100K CLUB ·
   * SEP 10 · DAY 10 OF 30" (the rank rides here on the phone post). */
  dateline: string;
};

/* A window is open on the PUBLIC board (forceBlackout under the admin
 * preview cookie counts). `note` is the second masthead line the sheet
 * prints so it explains its own blocks: "BLACKOUT — THE ELITE ARE HIDDEN
 * UNTIL SEP 27 · TIMES ARE SHOWN". */
export type PosterBlackout = {
  active: boolean;
  /* "Sep 27" — fmtPacificDay of endsAt */
  until: string | null;
  note: string | null;
};

/* One board row for a poster — a projection, never a TotalRow. A hidden
 * (elite) row carries a shape in `meters`, `masked`, `unranked` and its
 * paceTag — "I want that average pace to be there like identity" (owner,
 * 2026-09-06), a ratio of two hidden numbers, the one figure of the elite
 * that stays public. The run-up carries a partialShape ("142,###") and
 * keeps its place. Rows arrive in PUBLIC-board order (the elite first, by
 * pace) and the module never re-sorts. */
export type PosterStanding = {
  name: string;
  rowerNumber: number;
  division: Division;
  meters: Figure;
  masked?: true;
  unranked?: true;
  /* "1:52" — fmtPaceTag, floored to the second */
  paceTag?: string;
};

export type PosterRecordKey = "fastest5000" | "fastest10000" | "longest" | "bigday";

/* The record rule is records/defs.ts liteRecords (owner, 2026-09-08):
 * TIME records and their holders stay public under a window; a hidden
 * holder's METERS record ships as a shape ("##,### m"). post/page.tsx add()
 * masks times too and is NOT this surface's rule. */
export type PosterRecordLine = {
  /* M / W on the two time records; absent on longest / biggest day */
  division?: Division;
  value: Figure;
  holder: { name: string; rowerNumber: number };
  /* "Sep 4" */
  day: string;
  /* "1:46.2 /500m" — the split of a time record; "3 rows" on a big day */
  meta?: string;
};

export type PosterRecord = {
  key: PosterRecordKey;
  /* RECORD_DEFS title: "Fastest 5k", "Fastest 10k", "Longest row", "Biggest day" */
  label: string;
  lines: PosterRecordLine[];
};

/* Membership is the tier floor (a masked row's meters is its floor, so
 * meters ≥ 100,000 is public); the roll is NAMES ONLY in public-board
 * order — never sorted on real meters, never carrying them. The first to
 * 100k is a name and a day; the claim's running total never ships. */
export type PosterClub = {
  count: number;
  roll: { name: string; rowerNumber: number }[];
  first: { name: string; rowerNumber: number; day: string } | null;
};

/* buildField(...).field.paceKde re-shaped: seconds per 500 m along xs,
 * density normalised to peak 1. null under MIN_KDE (5) timed rows — the
 * module then draws its "NOT ENOUGH TIMED ROWS YET" line, never a frame. */
export type PosterSplit = {
  xs: number[];
  ys: number[];
  median: number;
  mean: number;
  sd: number;
} | null;

/* Pre-formatted ledger lines in PRIORITY order; the print ledger draws the
 * first six, the phone ledgers pick by key (SPEC.md §6 C11). Every value
 * is an aggregate — the blackout never touches this list. */
export type PosterTakeawayKey =
  | "biggestDay"
  | "busiestHour"
  | "medianSplit"
  | "avgRow"
  | "rowsADay"
  | "metersARower"
  | "club";

export type PosterTakeaway = {
  key: PosterTakeawayKey;
  /* "BIGGEST DAY" */
  label: string;
  /* "SEP 30 · 588K" | "7 AM" | "2:07 /500M" | "7,987 M" | "25 ROWERS · FIRST TESS VALE · SEP 8" */
  value: string;
};

/* The partner is an ad box, not a co-brand: bottom-right column on print,
 * one mono footer line on the phone, never in the masthead. The marks are
 * same-origin PNGs (no crossOrigin) and the wordmark is gold + white, so
 * it only ever sits on the Grizzly green plate. */
export type PosterPartner = {
  /* "Grizzly Health" */
  name: string;
  /* "ROWTEMBER" */
  code: string;
  /* "10% OFF MEALS AT GRIZZLYHEALTH.ORG" */
  deal: string;
  /* "https://grizzlyhealth.org" */
  site: string;
  /* "/row100k/partners/grizzly-bear.png" (190×200) */
  bear: string;
  /* "/row100k/partners/grizzly-wordmark.png" (605×88) */
  wordmark: string;
  /* "PARTNER · GRIZZLY HEALTH · CODE ROWTEMBER · 10% OFF" */
  footerLine: string;
};

export type CommunityPoster = {
  kind: "community";
  year: number;
  asOf: PosterAsOf;
  blackout: PosterBlackout;
  /* Aggregates, always numbers. `seconds` is the erg time (fmtHours →
   * "953.1 h"); `club` = boards.community.finished. */
  totals: { meters: number; seconds: number; sessions: number; rowers: number; club: number };
  /* Meters per day, index 0 = Sep 1 … length = asOf.dayNumber, zero-filled
   * from ONE source (boards.daily diffs of the same board read as
   * totals.meters) so the curve's last point equals the headline. */
  byDay: number[];
  /* Ten each, off the PUBLIC board (boardView viewerParticipantId null,
   * admin false, forceBlackout under the preview) through maskStandings
   * ({active, admin: false}). */
  standings: { men: PosterStanding[]; women: PosterStanding[] };
  /* 5k (M, W), 10k (M, W), longest, biggest day — six lines in four records. */
  records: PosterRecord[];
  club: PosterClub;
  /* 24 SESSION counts by Pacific hour (never meters — one rower alone in
   * an hour would be a session's meters); null under 5 sessions. */
  hours: number[] | null;
  split: PosterSplit;
  takeaways: PosterTakeaway[];
  partner: PosterPartner | null;
  /* "MIKIANMUSSER.COM/ROW100K" */
  url: string;
};

/* One logged row. While masked: meters a shape, time a clock shape, and
 * `split` null — "a time over a known distance is the meters by another
 * route" (blackoutRules.ts), so the SPLIT column is REMOVED from the
 * masked log rather than blocked. */
export type RowerLogRow = {
  /* "Sep 10" */
  day: string;
  /* "" allowed */
  title: string;
  meters: Figure;
  time: Figure;
  /* "1:53.0" — null while masked */
  split: string | null;
};

export type RowerBest = {
  key: PosterRecordKey;
  /* "Fastest 5k" */
  label: string;
  /* times are text (public); meters bests a shape while masked; {text: "—"} when not rowed */
  value: Figure;
  /* "Sep 4 · 1:47.9 /500m" | "Sep 5 · one row" | "not yet rowed" */
  sub: string;
  /* The time boards never lose their places (records/defs.ts: times are
   * public, so a place on them is); meters bests carry null while masked,
   * and everything is null when unplaced. */
  place: number | null;
};

export type RowerPoster = {
  kind: "rower";
  year: number;
  asOf: PosterAsOf;
  blackout: PosterBlackout;
  rower: { rowerNumber: number; name: string; instagram: string | null; division: Division | "X" };
  /* masked = blackout.active && maskedIds(PUBLIC board).has(id), fail
   * CLOSED if the board throws while a window is open. Applies to the rower
   * themself and to admins: a poster leaves the site — "I shouldn't be able
   * to know that I'm number three or number four" (owner, 2026-09-05). */
  masked: boolean;
  /* (masked ? floor : meters) >= GOAL_METERS — the tier is public */
  club: boolean;
  totals: {
    /* {text: "128,400"} or {shape: "###,###"} — no unit; the label line carries it */
    meters: Figure;
    /* Dropped WHOLE while masked (null): with the paceTag public, total
     * time + average split is the total by another route, and even a block
     * clock "would cut the range the total's own blocks are allowed to
     * admit" (pieces.tsx coreLedger review, 2026-09-05). */
    seconds: number | null;
    /* "8.0 h" — null while masked */
    hours: string | null;
    sessions: number;
    daysRowed: number;
    /* shape while masked ("##,### m"); null when never rowed */
    longest: Figure | null;
    bigDay: Figure | null;
    /* "1:52" — survives the mask on purpose (fmtPaceTag) */
    paceTag: string | null;
    /* "1:52.8 /500m" — null while masked (the paceTag stands in) */
    avgSplit: string | null;
    /* null while masked (meters by another route over "DAY N OF 30") */
    metersADay: number | null;
  };
  /* divisionRank on the PUBLIC board; "ELITE" while masked; null for
   * division X, a rower without a meter, or an unranked row. */
  rank: { place: number; of: number } | "ELITE" | null;
  /* index 0 = Sep 1 … asOf.dayNumber. `rowed` stays (dates are public);
   * `meters` is null while masked, and the module draws DAYS ROWED dots. */
  month: { rowed: boolean[]; meters: number[] | null };
  /* Running average split per session against cumulative meters, timed
   * rows only, oldest first. null while masked — the site never builds it
   * for a masked view (ProfileView.paceCurve) and neither does the poster;
   * the pace slot then draws the paceTag on its own (SPEC.md §6 R5). */
  pace: { m: number; s: number }[] | null;
  bests: RowerBest[];
  /* EVERY logged row, oldest first; the layout reverses for newest-first. */
  log: RowerLogRow[];
  /* The headline's second phrase: "OF 4,182,400 M BY 96 ROWERS" and the
   * share (0..1) when not masked. */
  community: { meters: number; rowers: number; share: number | null };
  partner: PosterPartner | null;
  /* "MIKIANMUSSER.COM/ROW100K/R/023" */
  url: string;
};

export type PosterData = CommunityPoster | RowerPoster;

/* ================================================================ race day */

/* RACE DAY — the third subject (owner, 2026-09-11: "I also need some race
 * day branding — overlays to put on an insta post, basically ads for the
 * event"). It is not a summary of anything: it is an AD, so its payload is
 * the race itself, flattened out of raceday.ts (RaceDef + RACE_ROLES +
 * waveTime) by poster/raceAssemble.ts and never retyped into a layout —
 * "the ad and the sign-up say the same words" (the judges' rule, and the
 * reason poster/raceday.ts holds no copy of its own).
 *
 * Every string arrives UPPERCASE and print-ready, because the ad sets
 * nothing in sentence case; the assembler is the one place a race's words
 * become an ad's words.
 *
 * It sits OUTSIDE PosterData on purpose. PosterData is what the engine's
 * generics are written against and engine.ts belongs to another stream —
 * its fileName() reaches for data.rower on any payload whose kind is not
 * "community", so a third member of that union would not compile there.
 * PosterSubject is the widened union the layout types take; race day
 * reaches compose() through one documented cast in poster/raceGround.ts,
 * which is also where the ground is painted. */
export type RaceDayRole = {
  /* "RACER" */
  label: string;
  /* "PULL THE 5,000 M. YOU GET A WAVE." — RACE_ROLES verbatim, uppercased.
   * OPTIONAL since 2026-09-11: the spectator's line came off the race
   * ("remove the phrase come watch, no wave, no erg") and the word carries
   * itself, so the ad's TWO WAYS IN table sets a bare label on that row. */
  line?: string;
};

export type RaceDayPoster = {
  kind: "raceday";
  year: number;
  race: {
    /* "raceday-2026-09-27" — the file stem's subject */
    slug: string;
    /* ["RACE", "DAY"] — the headline, one word a line on a tall frame and
     * joined with a space on a short one. */
    head: string[];
    /* "A TIMED 5,000 M TRIAL" (RaceDef.sub) */
    piece: string;
    /* "FIRST WAVE 6:15 PM" — waveTime(race, 1), never typed out. The wave
     * SIZE sentence that used to sit above it is gone (owner, 2026-09-11:
     * "remove rowed in waves of eight" — entirely). */
    firstWave: string;
    /* The bracket strip: three values with a mono sub each. */
    date: string;
    dayWord: string;
    hours: string;
    every: string;
    entry: string;
    entrySub: string;
    /* "SUN SEP 27" — the masthead's clock, which a crop never eats */
    stamp: string;
    waveSize: number;
    /* "8 ERGS A WAVE · EVERY 30 MIN" — the print sheets' wave picture, the
     * one place the grid is still described. */
    waveLabel: string;
    /* "ON WODIFY" — null when the race has no waiver */
    waiver: string | null;
    /* RaceDef.venueMark: white on transparent, so it needs no treatment on
     * ink or over a photograph. `ratio` is width over height, which is what
     * lets the module measure the host block before the image loads. */
    venueMark: { src: string; alt: string; ratio: number } | null;
    venue: string;
    /* "THE ENGINE ROOM", and it is the WHOLE address line now. There was a
     * `city` beside it, drawn under the room in the house block, and it is
     * gone with the town itself (owner, 2026-09-11: "remove Las Vegas
     * whenever we are saying the strip barbell engine room"). The note that
     * used to ride here went earlier the same day ("remove the phrase new
     * this September"), so this block has lost its second line twice; the
     * height it draws is the venue MARK's, not the type's, so neither loss
     * opened a hole under it. */
    room: string;
    roles: RaceDayRole[];
  };
  /* The field so far, for the one line of social proof the ad may print —
   * null when nobody has entered, when the count is under the floor, or
   * when the read failed (poster/raceData.ts). */
  field: { racers: number; spectators: number } | null;
  /* THE PICTURE THE AD IS FOR (RaceDef.photo, resolved to a URL by
   * poster/racePhoto.ts): the owner's chosen gallery shot, or the newest
   * one when he has chosen none, and whether it is shown black and white
   * (owner, 2026-09-11: "allow me to change that photo and have it be
   * black and white most likely").
   *
   * TWO GROUNDS READ IT. On "overlay" no frame draws it: that design is a
   * transparent PNG whose alpha IS the bill, so the picture belongs to the
   * wall and the studio only lays it BEHIND the preview — which is why the
   * overlay's own note says the switch and the pick are a preview of a
   * photograph supplied at post time. On "photo" the window DRAWS it, black
   * and white when he asked for that, and the PNG that downloads is the
   * finished ad. Null when R2 cannot serve (the preview falls back to the
   * chequer and the photo ground is not offered). */
  photo: { url: string | null; bw: boolean };
  /* "MIKIANMUSSER.COM/ROW100K/RACEDAY" */
  url: string;
  /* The caption that ships WITH the artwork: the waiver and the closing
   * time live here rather than on a frame, and the studio prints it under
   * the preview so the art and its words are written together. */
  caption: string;
};

/* Every payload a layout may be written against. The engine still only
 * knows PosterData (above); see the RaceDayPoster note. */
export type PosterSubject = PosterData | RaceDayPoster;

/* THE GROUND a sheet is painted on. Every other subject is cream paper and
 * says nothing; race day is monochrome and ships three ways — "ink" is the
 * solid ad, "overlay" is the same bill with a window cut through it (a
 * transparent PNG to lay over a photograph at post time), and "photo" is
 * that same bill with the owner's own picture DRAWN into the window, which
 * is the one file that is finished when it downloads. Which plans a ground
 * uses is poster/raceday.ts; who paints, who cuts and who fills is
 * poster/raceGround.ts and the `window` module.
 *
 * The third ground exists because the black-and-white switch has to be TRUE
 * OF A FILE (review, 2026-09-11): on an overlay the picture is a preview and
 * the owner could approve a grey frame and post a colour one.
 *
 * A GROUND IS NOT A STOCK. All three of these fill RACE_INK and then differ
 * only in what the `window` row does — they are three files of one ad, not
 * three colours. The black-and-white paper sheets are PosterStock below,
 * which is an orthogonal axis: race day has a ground and no stock, the two
 * paper subjects have a stock and no ground. */
export type PosterGround = "ink" | "overlay" | "photo";

/* THE STOCK a paper sheet is printed on (owner, 2026-09-12: "we also need
 * black and white shareable versions of all the posters to match the race
 * day aesthetic"). "cream" is the sheet the site is — #F4F3EE, ink type,
 * water blue. "bw" is race day's own #15171A with race day's own grey
 * ladder, so a Rowtember sheet and a race day ad hang together on a wall
 * and share the same phone feed.
 *
 * It is NOT a fourth PosterGround: see the note above. Race day is offered
 * no stock at all — it is the thing being matched, and a cream race day ad
 * would invent an idiom the owner closed on 2026-09-11. */
export type PosterStock = "cream" | "bw";

/* The roster handed to the studio's subject picker — the looks/view.ts
 * RosterRower guard: the two things that are ALWAYS public plus the board
 * a rower is on. It must never grow a number field. */
export type PosterRosterRower = { rowerNumber: number; displayName: string; division: Division | "X" };

/* ================================================================ drawing */

/* `venue` is race day's host mark (RaceDef.venueMark, white on
 * transparent). `photo` is the picture the owner picked, loaded with
 * crossOrigin so the canvas it is drawn into can still be encoded — it is
 * what the "photo" ground draws into the window, and it is null on every
 * other ground and whenever the bucket refused the CORS fetch. Both
 * optional so the two paper subjects build their assets exactly as they
 * did. */
export type PosterAssets = {
  bear: HTMLImageElement | null;
  wordmark: HTMLImageElement | null;
  venue?: HTMLImageElement | null;
  photo?: HTMLImageElement | null;
};

/* A module's box in logical units. `h` is the BUDGET on the way in (the
 * row's height once the engine has composed the plan); a module draws
 * inside it and returns the height it used. */
export type PosterBox = { x: number; y: number; w: number; h: number };

/* Line-box metrics per the slides.ts idiom: asc/desc from the DOM FontBox
 * ratios read off the probes (fallback fontBoundingBox), lh the CSS
 * line-height:normal box. */
export type PosterMetrics = { asc: number; desc: number; lh: number };

/* Block options mirror cards.ts drawBlockDigits / drawBlockShape: matte
 * ink by default, no shadow, real comma / colon / unit glyphs. */
export type PosterBlockOpts = { align?: "left" | "right" | "center"; fill?: string; paint?: boolean };

/* Medal chips are the site's .dtag idiom — FILLED gold / silver / bronze
 * with ink text, LEFT of the name ("chips LEFT + bold", owner 2026-09-05);
 * "outline" is the gray #4+ chip on a rower's bests; "pace" is the ink
 * chip with paper text an elite row wears where its place would go. */
export type PosterChipKind = "gold" | "silver" | "bronze" | "outline" | "pace";

/* ONE STEP OF THE CALENDAR RAMP — the cell fill AND the colour a letter
 * takes ON it, carried as a pair. The label colour is a property of its
 * step and can never drift from it: both files used to decide it with an
 * anonymous `b === 3 ? WHITE : INK`, which is a fact about the CREAM ramp
 * and not about the number 3. Cream flips its label once, at the top; bw
 * flips in the MIDDLE, where the cells go light. */
export type PosterHeatStep = { fill: string; on: string };

/* A chip's three colours. `fill: null` is the hollow chip — chip() strokes
 * `edge` instead of filling. It is a type rather than three fields because
 * the PACE chip changes IDIOM and not only colour between stocks: filled
 * on cream (where a medal is a hue and cannot be confused with it), hollow
 * on bw (where a filled chip in the type colour IS a medal chip). */
export type PosterChipPaint = { fill: string | null; edge: string; text: string };

/* THE PALETTE a sheet is drawn in — every colour either stock puts on the
 * canvas, resolved once per render (paint.ts paletteOf) and carried on the
 * paint helper as `c`. A module-level constant cannot be two things at
 * once, which is the whole reason this type exists.
 *
 * The field names are rowerCharts.ts PAL's, verbatim, so the rower modules
 * convert by shadowing one name rather than by editing 65 call sites.
 *
 * The measured ladders live with the values in paint.ts; the one structural
 * fact worth repeating here is that `water` is the ACCENT and on bw it is
 * the BRIGHTEST thing on the sheet while `ink` steps down a rung. On cream
 * the accent wins by hue (ink 16.16:1, water 4.38:1); take the hue away and
 * contrast is all that is left to carry it. */
export type PosterPalette = {
  paper: string;
  ink: string;
  inkSoft: string;
  gray: string;
  line: string;
  grid: string;
  water: string;
  waterArea: string;
  waterBar: string;
  waterBand: string;
  waterBandSoft: string;
  /* Lightest bucket first; [3] is the biggest day. */
  ramp: readonly [PosterHeatStep, PosterHeatStep, PosterHeatStep, PosterHeatStep];
  /* The keyline around a rowed calendar cell, or null for none. Cream
   * strokes every cell so bucket 0 survives matte stock; bw does not,
   * because there the rule would be brighter than the fill it holds. */
  cellEdge: string | null;
  gold: string;
  silver: string;
  bronze: string;
  /* The letter ON a filled medal chip. Ink on cream (the .dtag idiom: ink
   * text on a metal); the GROUND on bw, because there the chip is a light
   * slab and only the ground reads on it. */
  chipInk: string;
  paceChip: PosterChipPaint;
  /* OUR rule around the partner plate. Their own edge on cream; on bw
   * their #06130c is 1.06:1 against the ground and the plate would read as
   * a hole punched in the sheet, so we draw our own boundary there. */
  plateEdge: string;
  /* GRIZZLY'S COLOURS, the same five values on both stocks. A partner who
   * wants a mono lockup supplies one; we never derive one. */
  gzGreen: string;
  gzDark: string;
  gzCream: string;
  gzSage: string;
  gzGold: string;
};

/* THE PAINT HELPER — implemented once in poster/paint.ts (the slides.ts
 * text engine and the cards.ts block helpers copied with attribution,
 * re-coloured for paper), handed to every module. Stateless: each call
 * takes the ctx, so a module can measure on the preview and draw on the
 * full-res canvas with the same object. Text is positioned by
 * metricsOf/baselineOf, tracked through ctx.letterSpacing (per-glyph
 * fallback), and NEVER through fillText's maxWidth (it condenses glyphs). */
export type PosterPaint = {
  tk: PosterTokens;
  /* THE PALETTE this sheet is drawn in (PosterStock). It rides where the
   * tokens ride, so not one drawing signature in this subsystem changes:
   * every function already takes `paint`, and compose() already clones it.
   * Reach for `paint.c.ink`, never for an imported colour constant. */
  c: PosterPalette;
  format: PosterFormat;
  fonts: PosterFonts;
  assets: PosterAssets;
  /* "700 14px __Space_Mono_xxx, __Space_Mono_Fallback_xxx" */
  font(face: PosterFace, size: number): string;
  metricsOf(ctx: CanvasRenderingContext2D, font: string, size: number): PosterMetrics;
  /* top + (lh − (asc + desc)) / 2 + asc — half-leading centring */
  baselineOf(top: number, lh: number, m: PosterMetrics): number;
  /* tracking in logical px, added after every glyph like CSS letter-spacing */
  measure(ctx: CanvasRenderingContext2D, text: string, font: string, tracking?: number): number;
  drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    baseline: number,
    font: string,
    color: string,
    tracking?: number,
  ): number;
  drawCentered(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    baseline: number,
    font: string,
    color: string,
    tracking?: number,
  ): number;
  drawRight(
    ctx: CanvasRenderingContext2D,
    text: string,
    right: number,
    baseline: number,
    font: string,
    color: string,
    tracking?: number,
  ): number;
  /* Tracking-aware: measures with the same tracking it will be drawn with,
   * so a tracked eyebrow descriptor never runs into its neighbour. */
  ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string, tracking?: number): string;
  /* Shrink-to-fit: the largest size in [minSize, maxSize] (stepping by
   * `step`, default 1) at which `text` fits `maxW`; the nameplate and the
   * headline number use it, names never wrap. */
  fitSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    face: PosterFace,
    maxSize: number,
    minSize: number,
    maxW: number,
    tracking?: number,
  ): number;
  /* Greedy word wrap at the given font; used by the blackout note and the
   * partner deal line only — poster copy is short by design. */
  wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string, tracking?: number): string[];
  /* Solid rule (fillRect), ink by default. */
  rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color?: string): void;
  /* 1-unit dashed hairline in --line (#c9c8c0) [3,3] — table rows. */
  dashedRule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color?: string, weight?: number): void;
  /* 2-unit dotted leader in gray — the .bl ledger. */
  dottedRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color?: string): void;
  /* drawBlockShape: '#' → block (0.54 × 0.92 of size, 0.6 cell), other
   * glyphs as the mono glyph; returns the width; paint:false measures. */
  blocks(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseline: number,
    shape: string,
    size: number,
    opts?: PosterBlockOpts,
  ): number;
  /* cards.ts drawBlockDigits — one block per digit with real commas. */
  blockDigits(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseline: number,
    digits: number,
    size: number,
    opts?: PosterBlockOpts,
  ): number;
  /* cards.ts drawBlockClock, or a ready clock shape. */
  blockClock(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseline: number,
    secondsOrShape: number | string,
    size: number,
    opts?: PosterBlockOpts,
  ): number;
  /* One call for a Figure: text in `font`/`color`, or blocks at `size`
   * (matte ink, whatever the colour of the text would have been — blocks
   * are never water). Returns the width. */
  figure(
    ctx: CanvasRenderingContext2D,
    f: Figure,
    x: number,
    baseline: number,
    font: string,
    size: number,
    color: string,
    opts?: PosterBlockOpts & { tracking?: number },
  ): number;
  /* The .pf-eye line: bold mono uppercase left, gray descriptor right
   * (ellipsized with its tracking; `rightShort` is tried before the
   * ellipsis), hairline under, 1.1 × eye of air. Returns the y under it. */
  eyebrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    left: string,
    right?: string,
    rightShort?: string,
  ): number;
  /* A filled .dtag chip; returns its width (so the name can start after it). */
  chip(ctx: CanvasRenderingContext2D, x: number, baseline: number, text: string, kind: PosterChipKind): number;
  /* drawImage guarded for a null asset (draws nothing). */
  image(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
};

/* THE MODULE. A module owns one block of the sheet (its eyebrow included),
 * draws inside `box` and returns the height it used, so plans stack
 * heights and the engine can pin the footer. `scale` is pixels per logical
 * unit (a hairline may snap to it). `measure` reports the height the module
 * WANTS at box.w (box.h is the budget it may be asked to live within);
 * absent, the engine uses minH. Modules with a cap ("+ N MORE") or a line
 * count fit whatever height the engine hands them and return exactly it. */
export type PosterModule<D extends PosterSubject = PosterData> = {
  id: string;
  minH: number;
  measure?(
    ctx: CanvasRenderingContext2D,
    box: PosterBox,
    data: D,
    fonts: PosterFonts,
    paint: PosterPaint,
    scale: number,
  ): number;
  draw(
    ctx: CanvasRenderingContext2D,
    box: PosterBox,
    data: D,
    fonts: PosterFonts,
    paint: PosterPaint,
    scale: number,
  ): number;
};

/* ================================================================= layout */

/* A slot is one module (or a stack of modules drawn top-down with the
 * family gap) spanning `span` columns of the row. `fit` says how the slot
 * behaves when the engine hands it a height: "all" — it must show
 * everything (a club roll on the 24x36: every name is on the wall, so the
 * plan cascades before the roll caps); "cap" — it may cut with "+ N MORE";
 * "lines" — it draws the lines that fit (≥ its minimum) or nothing.
 * `grow` on a stack names the member that absorbs the row's height. */
export type PosterSlot =
  | { module: string; span: 1 | 2 | 3; fit?: "all" | "cap" | "lines" }
  | { stack: string[]; span: 1 | 2 | 3; grow?: string; fit?: "all" | "cap" | "lines" };

/* A row's height is the tallest of its slots. `grow` orders the rows that
 * absorb slack (1 first), up to `maxH`; a row without it is fixed at its
 * measured height. */
export type PosterRow = { id: string; slots: PosterSlot[]; grow?: number; maxH?: number };

/* Shrink steps a plan may spend, in order, before it cascades: "gap"
 * (module gap → 0.8×), "pitch" (board / log row pitch → 0.9×), "chart"
 * (the curve / pace to their minimum), "step" (the club roll and the log
 * one type step down), "cap" (cap slots cut to what remains). */
export type PosterShrink = "gap" | "pitch" | "chart" | "step" | "cap";

export type PosterPlan = {
  key: PosterPlanKey;
  cols: 1 | 2 | 3;
  rows: PosterRow[];
  /* The module pinned to the bottom margin; its height comes off the budget first. */
  footer: string;
  /* Module ids dropped (in this order) before shrinking — the optional
   * plate on a rower's side stack, the ledger lines under a short month. */
  drop?: string[];
  shrink: PosterShrink[];
  /* The next plan of the cascade when this one cannot fit. */
  next?: PosterPlanKey;
};

/* What community.ts and rower.ts export. The engine knows modules by id
 * and plans by key — it never knows what a module draws. */
export type PosterLayout<D extends PosterSubject = PosterData> = {
  subject: D["kind"];
  modules: Record<string, PosterModule<D>>;
  plans: Partial<Record<PosterPlanKey, PosterPlan>>;
};

/* ================================================================= engine */

/* One render: the format at a ppi (null for Instagram), optional bleed
 * (inches of extra cream per edge; the drawing is offset by it), the
 * canvas size and the single ctx.scale. `fellBack` is true when the
 * allocation probe refused the requested ppi and the ladder stepped down —
 * the studio then says "RENDERED AT 150 PPI — THIS DEVICE CANNOT MAKE 300". */
export type PosterRenderTarget = {
  format: PosterFormat;
  ppi: PosterPpi | null;
  bleedIn: number;
  pxW: number;
  pxH: number;
  scale: number;
  offset: { x: number; y: number };
  fellBack: boolean;
};

export type PosterFile = {
  name: string;
  type: "image/png" | "application/pdf";
  blob: Blob;
  ppi?: PosterPpi;
  fellBack?: boolean;
};

/* What compose() reports — printed under every preview on dev/posters so
 * dead air, drops and cascades are measured, not eyeballed. */
export type PosterLayoutLog = {
  plan: PosterPlanKey;
  rows: { id: string; h: number; slots: string[] }[];
  dropped: string[];
  shrinks: PosterShrink[];
  /* paper left above the footer after every elastic part is spent */
  slack: number;
};
