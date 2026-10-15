import { MI, fmtClock, fmtClockDay, fmtClockRange, fmtPace, secondsBetween } from "@/lib/tracker/format";
import type { EventStatus, Snapshot, SnapshotCheckpoint, SnapshotEta, SnapshotOnCourse, SnapshotParticipant, Units } from "@/lib/tracker/types";
import { countUp, progressAt, type Anim } from "./shareAnim";
import { INNER, PAD, RADIUS, W, fit, glyphs, jfWordmark, line, measure, nsLockup, palette, roundedRect, setFont, signature, type Kit, type Look } from "./shareMarks";

export { W, PAD, INNER, LOOKS, palette, type Kit, type Look, type Fonts } from "./shareMarks";

/* STORY STICKERS FOR THE LIVE TRACKER, second pass (owner, 2026-10-15:
 * "the stickers look terrible, try again … these are stickers to place on
 * stories … make the miles approximate, we definitely don't need the 0.4
 * … I like having the ETA card but not how it looks … what do these
 * numbers mean, leg five, mile zero … the numbers aren't positioned well,
 * there's no white space between them … we don't need the elevation
 * sticker … I like the idea of the mark sticker but it needs to be
 * different … what is the finish supposed to be, 'not yet'?").
 *
 * Seven chunky typographic blocks: one headline per card in Archivo
 * Black, labels in Barlow Condensed, the eyebrow in IBM Plex Mono, the
 * signature line at the foot. No logos — shareMarks.ts draws our own
 * lockup and wordmark as type. Canvas painters only, no React, so a
 * harness can paint every card with a mocked context: a painter is (ctx,
 * look, kit, draw, anim) → height, called once to measure and once to
 * draw, so a sticker is exactly as tall as its content.
 *
 * NUMBERS ARE APPROXIMATE. The route is "about" 142 miles and the crew
 * will run more or less of it, so the cards never print the route length
 * to a decimal: the headline is the mile marker ("MILE 58", whole, from
 * progress_m), what is left is "~84 TO GO", and the total appears only in
 * small type with a tilde. A pace or a time that is not there is left out
 * — never "—", never "0:00". */

/* ----------------------------------------------------------- the facts */

/* What the server page knows before any snapshot: enough for THE MARK. */
export type Shell = { slug: string; name: string; units: Units; timezone: string; start_time: string };

export type Words = {
  /* "SAN DIEGO" — where the ETA points. */
  to: string;
  /* "LA → SD". */
  route: string;
  /* "10.23.26", in the event's zone. */
  date: string;
  /* "FRI 5:00 AM", in the event's zone. */
  start: string;
};

export type Facts = {
  slug: string;
  units: Units;
  tz: string;
  startIso: string;
  /* False when built from the shell alone (no snapshot yet): only THE MARK
   * is offered then. */
  hasData: boolean;
  status: EventStatus;
  started: boolean;
  finished: boolean;
  finishedAt: string | null;
  lengthM: number;
  progressM: number;
  remainingM: number;
  percent: number;
  /* Seconds on the road, carried forward from the snapshot to `now`. */
  elapsedS: number;
  finishTimeS: number | null;
  eta: SnapshotEta;
  slotNames: string[];
  onCourse: SnapshotOnCourse[];
  participants: SnapshotParticipant[];
  legsDone: number;
  /* The highest leg under way, or null when nobody is out. */
  legNow: number | null;
  /* Runners with at least one leg. */
  ranCount: number;
  words: Words;
};

/* Per-event words the data cannot supply: where the ETA points and how
 * the route is said. Other events fall back to their checkpoints. */
const EVENT_WORDS: Record<string, { to: string; route: string }> = {
  lasd26: { to: "SAN DIEGO", route: "LA → SD" },
};

/* "10.23.26" */
function dateStamp(iso: string, tz: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", year: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(d).replace(/\//g, ".");
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(d).replace(/\//g, ".");
  }
}

/* "FRI 5:00 AM" */
function startStamp(iso: string, tz: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  let wd = "";
  try {
    wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(d);
  } catch {
    wd = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  }
  return `${wd} ${fmtClock(iso, tz)}`.toUpperCase();
}

function wordsOf(shell: Shell, checkpoints?: SnapshotCheckpoint[]): Words {
  const known = EVENT_WORDS[shell.slug];
  const start = checkpoints?.find((c) => c.kind === "start")?.name;
  const finish = checkpoints?.find((c) => c.kind === "finish")?.name;
  return {
    to: (known?.to ?? finish ?? "THE FINISH").toUpperCase(),
    route: known?.route ?? (start && finish ? `${start} → ${finish}` : shell.name).toUpperCase(),
    date: dateStamp(shell.start_time, shell.timezone),
    start: startStamp(shell.start_time, shell.timezone),
  };
}

const NO_ETA: SnapshotEta = { finish: null, earliest: null, latest: null, pace_s_per_km: null };

/* Facts with nothing in them: the page before its first snapshot. */
export function factsFromShell(shell: Shell): Facts {
  return {
    slug: shell.slug,
    units: shell.units,
    tz: shell.timezone,
    startIso: shell.start_time,
    hasData: false,
    status: "upcoming",
    started: false,
    finished: false,
    finishedAt: null,
    lengthM: 0,
    progressM: 0,
    remainingM: 0,
    percent: 0,
    elapsedS: 0,
    finishTimeS: null,
    eta: NO_ETA,
    slotNames: [],
    onCourse: [],
    participants: [],
    legsDone: 0,
    legNow: null,
    ranCount: 0,
    words: wordsOf(shell),
  };
}

/* The facts of one entry (the first, unless `entryId` names another —
 * LASD26 has one: the crew, in pairs). `now` carries the clocks forward
 * from the snapshot's generated_at, so a sticker made a minute after the
 * poll says the minute — and THE CLOCK ticks between polls. */
export function factsOf(snap: Snapshot, entryId: string | null = null, now = Date.now()): Facts {
  const shell: Shell = { slug: snap.event.slug, name: snap.event.name, units: snap.event.units, timezone: snap.event.timezone, start_time: snap.event.start_time };
  const entry = (entryId ? snap.entries.find((e) => e.id === entryId) : undefined) ?? snap.entries[0];
  if (!entry) return factsFromShell(shell);
  const status = snap.event.status;
  const started = status !== "upcoming";
  const finished = entry.finished;
  const gen = Date.parse(snap.generated_at);
  const drift = started && !finished && Number.isFinite(gen) ? Math.max(0, (now - gen) / 1000) : 0;
  const finishTimeS = finished ? (entry.finished_at ? Math.max(0, secondsBetween(snap.event.start_time, entry.finished_at)) : entry.elapsed_s) : null;
  const legNow = entry.on_course.reduce<number | null>((m, o) => (m === null || o.leg_no > m ? o.leg_no : m), null);
  return {
    slug: shell.slug,
    units: shell.units,
    tz: shell.timezone,
    startIso: shell.start_time,
    hasData: true,
    status,
    started,
    finished,
    finishedAt: entry.finished_at,
    lengthM: snap.event.length_m,
    progressM: entry.progress_m,
    remainingM: entry.remaining_m,
    percent: entry.percent,
    elapsedS: started ? entry.elapsed_s + drift : 0,
    finishTimeS,
    eta: entry.eta,
    slotNames: entry.slot_names.length ? entry.slot_names : Array.from({ length: Math.max(1, entry.slots) }, (_, i) => String(i + 1)),
    onCourse: entry.on_course.map((o) => ({ ...o, leg_time_s: o.leg_time_s + drift })),
    participants: entry.participants,
    legsDone: entry.legs.filter((l) => !l.live).length,
    legNow,
    ranCount: entry.participants.filter((p) => p.legs > 0).length,
    words: wordsOf(shell, entry.checkpoints),
  };
}

/* --------------------------------------------------------- the numbers */

const up = (s: string): string => s.toUpperCase();
const per = (f: Facts): number => (f.units === "imperial" ? MI : 1000);
/* "MILE" / "KM" for the headline, "MI" / "KM" after a count. */
const unitWord = (f: Facts): string => (f.units === "imperial" ? "MILE" : "KM");
const unitAbbr = (f: Facts): string => (f.units === "imperial" ? "MI" : "KM");
const unitPlural = (f: Facts): string => (f.units === "imperial" ? "MILES" : "KM");

/* The mile marker: whole, rounded DOWN like the signs on the road. */
export const marker = (f: Facts, m: number): number => Math.max(0, Math.floor((Number.isFinite(m) ? m : 0) / per(f)));
/* "~84": whole with a tilde, for what is left and for the total. */
export const approx = (f: Facts, m: number): string => `~${Math.max(0, Math.round((Number.isFinite(m) ? m : 0) / per(f)))}`;
/* A runner's own distance: "~11", or "0.4" under a mile, where "~0" would
 * be a joke. */
export const runnerDist = (f: Facts, m: number): string => {
  const v = (Number.isFinite(m) ? Math.max(0, m) : 0) / per(f);
  return v < 0.95 ? v.toFixed(1) : `~${Math.round(v)}`;
};
const pct = (f: Facts): string => `${Math.round(Math.max(0, Math.min(100, Number.isFinite(f.percent) ? f.percent : 0)))}%`;

/* Always h:mm:ss, so a sticker's clock reads as a clock. "" when there is
 * nothing to say — the caller leaves the row out. */
export function hms(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "";
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* "9:15" on the road; under an hour, "15 MIN". */
export function hm(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "";
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} MIN`;
}

/* "16 MIN", "1 H 05 MIN", "UNDER A MINUTE". */
function mins(s: number): string {
  const m = Math.max(0, Math.round((Number.isFinite(s) ? s : 0) / 60));
  if (m < 1) return "UNDER A MINUTE";
  if (m < 60) return `${m} MIN`;
  return `${Math.floor(m / 60)} H ${String(m % 60).padStart(2, "0")} MIN`;
}

/* "3:40 PM", or "" when the instant is missing. */
function clockOf(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const s = fmtClock(iso, tz);
  return s === "—" ? "" : up(s);
}

/* "SAT" when `iso` falls on another day than the start, else "". */
function otherDay(iso: string | null | undefined, f: Facts): string {
  if (!iso) return "";
  const m = /^([A-Za-z]{3}) /.exec(fmtClockDay(iso, f.tz, f.startIso));
  return m ? up(m[1]) : "";
}

/* "7:40 /MI", or "" when there is no pace worth printing. */
function paceOf(sPerKm: number | null | undefined, f: Facts): string {
  if (sPerKm === null || sPerKm === undefined || !Number.isFinite(sPerKm) || sPerKm <= 0) return "";
  const s = fmtPace(sPerKm, f.units);
  return s === "—" ? "" : up(s);
}

/* ------------------------------------------------------ the card pieces */

/* The rhythm: the eyebrow, the headline, a gap, what sits under it, the
 * signature. Measured from glyph bounds, so the gaps are real whitespace. */
const EYE = 26;
const EYE_TRACK = 6;
const HEAD_MAX = 168;
const HEAD_MIN = 64;
const LINE_MAX = 40;
const LINE_MIN = 24;
const GAP_EYE = 22;
const GAP_HEAD = 36;
const GAP_BAR = 24;
const GAP_FOOT = 56;
const BAR_H = 20;

function eyebrow(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number, text: string): number {
  const { dim } = palette(look);
  const size = fit(ctx, text, kit.fonts.mono, EYE, 18, INNER, 500, EYE_TRACK);
  return line(ctx, draw, y, text, kit.fonts.mono, 500, size, dim, GAP_EYE, { track: EYE_TRACK });
}

/* The one headline: Archivo Black, as big as fits. `as` is the string the
 * size and height come from, so a number counting up holds still. */
function headline(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number, text: string, as = text, max = HEAD_MAX, min = HEAD_MIN): number {
  const { ink } = palette(look);
  const size = fit(ctx, as, kit.fonts.display, max, min, INNER);
  return line(ctx, draw, y, text, kit.fonts.display, 400, size, ink, 0, { as });
}

/* The line under a headline: condensed caps, one sentence. */
function under(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number, text: string, color?: string): number {
  const size = fit(ctx, text, kit.fonts.cond, LINE_MAX, LINE_MIN, INNER, 600, 1);
  return line(ctx, draw, y, text, kit.fonts.cond, 600, size, color ?? palette(look).ink, 0, { track: 1 });
}

/* Type from a top edge at any x; returns the y under it. */
function textAt(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  x: number,
  y: number,
  text: string,
  family: string,
  weight: number,
  size: number,
  color: string,
  track = 0,
): number {
  setFont(ctx, family, weight, size, track);
  const run = measure(ctx, text, size);
  glyphs(ctx, draw, x, y + run.asc, text, family, weight, size, color, { track });
  return y + run.asc + run.desc;
}

function foot(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number): number {
  return signature(ctx, look, kit, draw, y + GAP_FOOT);
}

/* A thin bar across the card: the done part in the accent. */
function bar(ctx: CanvasRenderingContext2D, look: Look, draw: boolean, y: number, frac: number): number {
  const { accent, track } = palette(look);
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  if (draw) {
    ctx.fillStyle = track;
    ctx.fillRect(PAD, y, INNER, BAR_H);
    if (f > 0) {
      ctx.fillStyle = accent;
      ctx.fillRect(PAD, y, Math.max(BAR_H, Math.round(INNER * f)), BAR_H);
    }
  }
  return y + BAR_H;
}

/* A letter in a filled square — the slot a runner holds (A / B). */
function square(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, x: number, y: number, s: number, label: string): void {
  if (!draw) return;
  const { accent, onAccent } = palette(look);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, s, s);
  const size = Math.round(s * 0.6);
  setFont(ctx, kit.fonts.cond, 700, size);
  const m = measure(ctx, label, size);
  glyphs(ctx, true, x + s / 2, y + (s + m.asc) / 2, label, kit.fonts.cond, 700, size, onAccent, { align: "center" });
}

/* ------------------------------------------------------------ the cards */

export type Painter = (ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, anim?: Anim) => number;
/* A card lays out from `y0`, paints when `draw`, returns the y it ended at. */
export type CardPainter = (ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y0: number, anim?: Anim) => number;

/* 1 MILE — "MILE 58", the bar, "~84 TO GO · 41% · 9:15 ON THE ROAD".
 * Animated: the number counts up from 0 and the bar fills with it. Before
 * the start: "MILE 0" and when it starts. */
export const mileCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0, anim) => {
    const { dim } = palette(look);
    const mile = f.finished ? Math.round(f.lengthM / per(f)) : marker(f, f.progressM);
    const shown = countUp(mile, anim);
    let y = eyebrow(ctx, look, kit, draw, y0, f.words.route);
    y = headline(ctx, look, kit, draw, y, `${unitWord(f)} ${shown}`, `${unitWord(f)} ${mile}`);
    y += GAP_HEAD;
    const frac = f.finished ? 1 : f.lengthM > 0 ? f.progressM / f.lengthM : 0;
    y = bar(ctx, look, draw, y, frac * progressAt(anim));
    y += GAP_BAR;
    const time = hms(f.finishTimeS ?? f.elapsedS);
    const text = f.finished
      ? `DONE${time ? ` · ${time} ON THE ROAD` : ""}`
      : f.started
        ? `${approx(f, f.remainingM)} TO GO · ${pct(f)} · ${hm(f.elapsedS)} ON THE ROAD`
        : `STARTS ${f.words.start}`.trim();
    y = under(ctx, look, kit, draw, y, text, f.started ? undefined : dim);
    return foot(ctx, look, kit, draw, y);
  };

/* 2 ETA — "ETA · SAN DIEGO", "~3:40 PM", "BETWEEN 3:25 AND 3:55 PM · ~84
 * MI TO GO". No pace yet: "SOON." Finished: the time they got in. */
export const etaCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { dim } = palette(look);
    let eye: string;
    let head: string;
    let text: string;
    let color: string | undefined;
    if (f.finished) {
      const day = otherDay(f.finishedAt, f);
      eye = `FINISHED · ${f.words.to}${day ? ` · ${day}` : ""}`;
      head = clockOf(f.finishedAt, f.tz) || "DONE.";
      const time = hms(f.finishTimeS);
      text = [time ? `${time} ON THE ROAD` : "", `${approx(f, f.lengthM)} ${unitAbbr(f)}`].filter(Boolean).join(" · ");
    } else if (!f.started) {
      eye = `ETA · ${f.words.to}`;
      head = "SOON.";
      text = `STARTS ${f.words.start}`.trim();
      color = dim;
    } else if (f.eta.finish) {
      const day = otherDay(f.eta.finish, f);
      eye = `ETA · ${f.words.to}${day ? ` · ${day}` : ""}`;
      head = `~${clockOf(f.eta.finish, f.tz)}`;
      const win = fmtClockRange(f.eta.earliest, f.eta.latest, f.tz);
      const between = win !== "—" && f.eta.earliest !== f.eta.latest ? `BETWEEN ${up(win).replace("–", " AND ")}` : "";
      text = [between, `${approx(f, f.remainingM)} ${unitAbbr(f)} TO GO`].filter(Boolean).join(" · ");
    } else {
      eye = `ETA · ${f.words.to}`;
      head = "SOON.";
      text = "NO PACE YET · FIRST MILES COMING";
      color = dim;
    }
    let y = eyebrow(ctx, look, kit, draw, y0, eye);
    y = headline(ctx, look, kit, draw, y, head);
    y += GAP_HEAD;
    y = under(ctx, look, kit, draw, y, text, color);
    return foot(ctx, look, kit, draw, y);
  };

/* 3 THE CLOCK — "ON THE ROAD", "9:15:20", "MILE 58 · LEG 23". Ticks: the
 * seconds come from the facts, which carry the drift since the poll, so
 * every repaint is a tick. */
export const clockCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { dim } = palette(look);
    let eye: string;
    let head: string;
    let text: string;
    let color: string | undefined;
    if (!f.started) {
      eye = "STARTS";
      head = f.words.start || "SOON.";
      /* The length only once a snapshot has said it. */
      text = f.lengthM > 0 ? `${f.words.route} · ${approx(f, f.lengthM)} ${unitAbbr(f)}` : f.words.route;
      color = dim;
    } else if (f.finished) {
      eye = "FINAL TIME";
      head = hms(f.finishTimeS ?? f.elapsedS) || "DONE.";
      text = `${approx(f, f.lengthM)} ${unitAbbr(f)} · ${f.legsDone} ${f.legsDone === 1 ? "LEG" : "LEGS"}`;
    } else {
      eye = "ON THE ROAD";
      head = hms(f.elapsedS) || "SOON.";
      text = `${unitWord(f)} ${marker(f, f.progressM)} · ${f.legNow ? `LEG ${f.legNow}` : `${f.legsDone} ${f.legsDone === 1 ? "LEG" : "LEGS"} DONE`}`;
    }
    let y = eyebrow(ctx, look, kit, draw, y0, eye);
    /* The widest the clock gets, so it holds still as the digits change. */
    y = headline(ctx, look, kit, draw, y, head, head.replace(/\d/g, "0"));
    y += GAP_HEAD;
    y = under(ctx, look, kit, draw, y, text, color);
    return foot(ctx, look, kit, draw, y);
  };

/* "2.1 MI INTO LEG 7 · 16 MIN" — one plain sentence about a runner's leg
 * (owner: "what do these numbers mean, leg five, mile zero, and what's
 * the time there? I don't understand"). */
export function legSentence(f: Facts, oc: SnapshotOnCourse): string {
  const d = Math.max(0, Number.isFinite(oc.leg_distance_m) ? oc.leg_distance_m : 0) / per(f);
  const m = Math.round((Number.isFinite(oc.leg_time_s) ? oc.leg_time_s : 0) / 60);
  if (d < 0.05) return `JUST TAPPED IN · LEG ${oc.leg_no}${m >= 1 ? ` · ${mins(oc.leg_time_s)}` : ""}`;
  return `${d.toFixed(1)} ${unitAbbr(f)} INTO LEG ${oc.leg_no} · ${mins(oc.leg_time_s)}`;
}

/* 4 RUNNING NOW — one block per slot: a square with the slot letter, the
 * runner's name big, one plain sentence under it. A slot nobody holds says
 * so. A one-slot event has no squares. */
export const nowCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, dim } = palette(look);
    const { display, cond } = kit.fonts;
    let y = eyebrow(ctx, look, kit, draw, y0, f.finished ? `DONE · ${f.words.to}` : "RUNNING NOW");
    if (!f.started) {
      y = under(ctx, look, kit, draw, y, `STARTS ${f.words.start}`.trim(), dim);
      return foot(ctx, look, kit, draw, y);
    }
    if (f.finished) {
      const time = hms(f.finishTimeS);
      y = under(ctx, look, kit, draw, y, `EVERYBODY'S IN${time ? ` · ${time}` : ""}`);
      return foot(ctx, look, kit, draw, y);
    }
    const slots = Math.max(1, f.slotNames.length);
    const squares = slots > 1;
    const s = squares ? 72 : 0;
    const x = PAD + (squares ? s + 24 : 0);
    for (let i = 0; i < slots; i++) {
      const oc = f.onCourse.find((o) => o.slot === i + 1);
      const label = f.slotNames[i] ?? String(i + 1);
      if (oc) {
        const name = up(oc.name);
        /* Down to 36 px: a double-barrelled name still fits beside its square. */
        const size = fit(ctx, name, display, 96, 36, INNER - (x - PAD));
        setFont(ctx, display, 400, size);
        const run = measure(ctx, name, size);
        const rowH = Math.max(run.asc, s);
        if (squares) square(ctx, look, kit, draw, PAD, y + (rowH - s) / 2, s, label);
        glyphs(ctx, draw, x, y + (rowH - run.asc) / 2 + run.asc, name, display, 400, size, ink);
        y += rowH + run.desc + 14;
        const sentence = legSentence(f, oc);
        const ss = fit(ctx, sentence, cond, 34, 22, INNER - (x - PAD), 600, 1);
        y = textAt(ctx, draw, x, y, sentence, cond, 600, ss, dim, 1);
      } else {
        const text = "NOBODY TAPPED IN YET";
        const size = fit(ctx, text, cond, 44, 24, INNER - (x - PAD), 600, 1);
        setFont(ctx, cond, 600, size, 1);
        const run = measure(ctx, text, size);
        const rowH = Math.max(run.asc, s);
        if (squares) square(ctx, look, kit, draw, PAD, y + (rowH - s) / 2, s, label);
        glyphs(ctx, draw, x, y + (rowH - run.asc) / 2 + run.asc, text, cond, 600, size, dim, { track: 1 });
        y += rowH + run.desc;
      }
      if (i < slots - 1) y += 40;
    }
    return foot(ctx, look, kit, draw, y);
  };

/* 5 A RUNNER — the name, then a two-column grid of label-over-value cells:
 * LEGS · MILES · PACE (only when known) · ON COURSE (only when > 0). A
 * runner with no legs yet: "HASN'T RUN YET". */
export const runnerCard =
  (f: Facts, participantId: string | null): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, dim } = palette(look);
    const { display, mono } = kit.fonts;
    const p = (participantId ? f.participants.find((x) => x.id === participantId) : undefined) ?? f.participants[0];
    if (!p) {
      let y = eyebrow(ctx, look, kit, draw, y0, "RUNNER");
      y = under(ctx, look, kit, draw, y, "NO ROSTER YET", dim);
      return foot(ctx, look, kit, draw, y);
    }
    let y = eyebrow(ctx, look, kit, draw, y0, p.on_course ? "ON COURSE NOW" : "RUNNER");
    /* Down to 40 px: a long double-barrelled name still fits the card. */
    y = headline(ctx, look, kit, draw, y, up(p.name), up(p.name), 128, 40);
    y += GAP_HEAD;
    if (p.legs < 1) {
      const text = p.on_course ? `OUT ON THEIR FIRST LEG${f.legNow ? ` · LEG ${f.legNow}` : ""}` : f.started && !f.finished ? "HASN'T RUN YET · UP SOON" : "HASN'T RUN YET";
      y = under(ctx, look, kit, draw, y, text, dim);
      return foot(ctx, look, kit, draw, y);
    }
    const cells: [string, string][] = [
      [p.legs === 1 ? "LEG" : "LEGS", String(p.legs)],
      [unitPlural(f), runnerDist(f, p.distance_m)],
    ];
    const pace = paceOf(p.avg_pace_s_per_km, f);
    if (pace) cells.push(["PACE", pace]);
    /* Minutes, not m:ss — "55:00" reads as a clock. */
    if (Number.isFinite(p.time_s) && p.time_s >= 30) cells.push(["ON COURSE", mins(p.time_s)]);
    const gutter = 40;
    const colW = (INNER - gutter) / 2;
    /* One size for every value, so the cells line up across the grid. */
    const vs = Math.min(...cells.map(([, v]) => fit(ctx, v, display, 112, 40, colW)));
    for (let r = 0; r < cells.length; r += 2) {
      let bottom = y;
      cells.slice(r, r + 2).forEach(([label, value], c) => {
        const x = PAD + c * (colW + gutter);
        const ly = textAt(ctx, draw, x, y, label, mono, 500, 24, dim, 5);
        bottom = Math.max(bottom, textAt(ctx, draw, x, ly + 12, value, display, 400, vs, ink));
      });
      y = bottom + (r + 2 < cells.length ? 40 : 0);
    }
    return foot(ctx, look, kit, draw, y);
  };

/* 6 THE MARK — our lockup big: "NO SHORTCUTS →" on one line, "×
 * justfriends." on the next, then "LA → SD · 10.23.26" small, and nothing
 * else. Needs no snapshot. */
export const markCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, dim, word, dot } = palette(look);
    const { display, cond } = kit.fonts;
    /* One size for both lines: the longer of the two sets it. */
    const l1 = "NO SHORTCUTS →";
    const l2 = "× justfriends.";
    const size = Math.min(fit(ctx, l1, display, 150, 60, INNER, 400, -2), fit(ctx, l2, display, 150, 60, INNER, 400, -2));
    setFont(ctx, display, 400, size);
    const r1 = measure(ctx, "NO SHORTCUTS", size);
    let y = y0;
    nsLockup(ctx, draw, PAD, y + r1.asc, size, kit.fonts, ink);
    y += r1.asc + r1.desc + Math.round(size * 0.16);
    setFont(ctx, display, 400, size);
    const r2 = measure(ctx, "justfriends", size);
    const base2 = y + r2.asc;
    const cross = glyphs(ctx, draw, PAD, base2, "×", display, 400, Math.round(size * 0.86), dim);
    jfWordmark(ctx, draw, PAD + cross.w + Math.round(size * 0.22), base2, size, kit.fonts, word, dot);
    y = base2 + r2.desc + 40;
    const tail = [f.words.route, f.words.date].filter(Boolean).join(" · ");
    const ts = fit(ctx, tail, cond, 44, 28, INNER, 600, 3);
    return line(ctx, draw, y, tail, cond, 600, ts, dim, 0, { track: 3 });
  };

/* 7 FINISH — only offered once the entry is finished: "DONE." then "~142 MI
 * · 19:12:33 · 16 RUNNERS · 38 LEGS". Painted early anyway (a harness, a
 * stale chip), it says what is left rather than "not yet". */
export const finishCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { dim } = palette(look);
    if (!f.finished) {
      let y = eyebrow(ctx, look, kit, draw, y0, `THE FINISH · ${f.words.to}`);
      y = headline(ctx, look, kit, draw, y, "SOON.");
      y += GAP_HEAD;
      y = under(ctx, look, kit, draw, y, f.started ? `${approx(f, f.remainingM)} ${unitAbbr(f)} TO GO` : `STARTS ${f.words.start}`.trim(), dim);
      return foot(ctx, look, kit, draw, y);
    }
    const day = otherDay(f.finishedAt, f);
    let y = eyebrow(ctx, look, kit, draw, y0, `FINISHED · ${f.words.to}${day ? ` · ${day}` : ""}`);
    y = headline(ctx, look, kit, draw, y, "DONE.");
    y += GAP_HEAD;
    const runners = f.ranCount || f.participants.length;
    const parts = [
      `${approx(f, f.lengthM)} ${unitAbbr(f)}`,
      hms(f.finishTimeS),
      runners ? `${runners} ${runners === 1 ? "RUNNER" : "RUNNERS"}` : "",
      f.legsDone ? `${f.legsDone} ${f.legsDone === 1 ? "LEG" : "LEGS"}` : "",
    ].filter(Boolean);
    y = under(ctx, look, kit, draw, y, parts.join(" · "));
    return foot(ctx, look, kit, draw, y);
  };

/* ---------------------------------------------------------- the deck */

export type CardId = "mile" | "eta" | "clock" | "now" | "runner" | "mark" | "finish";

/* In the owner's order. `data`: needs a snapshot (THE MARK does not).
 * `finished`: only offered once the entry is in. */
export const CARDS: { id: CardId; label: string; data: boolean; finished?: boolean; animated?: boolean }[] = [
  { id: "mile", label: "Mile", data: true, animated: true },
  { id: "eta", label: "ETA", data: true },
  { id: "clock", label: "The clock", data: true, animated: true },
  { id: "now", label: "Running now", data: true },
  { id: "runner", label: "A runner", data: true },
  { id: "mark", label: "The mark", data: false },
  { id: "finish", label: "Finish", data: true, finished: true },
];

export const isAnimated = (id: CardId): boolean => CARDS.some((c) => c.id === id && c.animated === true);

export function cardPainter(id: CardId, f: Facts, runnerId: string | null): CardPainter {
  switch (id) {
    case "mile":
      return mileCard(f);
    case "eta":
      return etaCard(f);
    case "clock":
      return clockCard(f);
    case "now":
      return nowCard(f);
    case "runner":
      return runnerCard(f, runnerId);
    case "mark":
      return markCard(f);
    case "finish":
      return finishCard(f);
  }
}

export type Format = "sticker" | "story" | "post";
export const FORMATS: { id: Format; label: string }[] = [
  { id: "sticker", label: "Sticker" },
  { id: "story", label: "Story" },
  { id: "post", label: "Post" },
];
/* The canvas height of each format; null = as tall as the card. */
export const FRAME: Record<Format, number | null> = { sticker: null, story: 1920, post: 1350 };

/* Paints a card at its own height (frame = null: a rounded block exactly
 * as tall as the card plus the padding) or centred in a frame of a fixed
 * height (a story or a post, full bleed). The ground is painted here, so
 * the frame only clears. Returns the canvas height. */
export function placeCard(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, frame: number | null, card: CardPainter, anim?: Anim): number {
  const h = Math.ceil(card(ctx, look, kit, false, 0, anim));
  const total = frame === null ? h + PAD * 2 : frame;
  if (!draw) return total;
  const { ground } = palette(look);
  if (ground) {
    ctx.fillStyle = ground;
    /* A video has no transparent corners to keep. */
    if (frame === null && !anim?.video) {
      roundedRect(ctx, 0, 0, W, total, RADIUS);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, W, total);
    }
  }
  card(ctx, look, kit, true, frame === null ? PAD : Math.max(PAD, Math.round((frame - h) / 2)), anim);
  return total;
}

/* The file a sticker saves as: lasd26-mile-story-ink.png — or, with no
 * `ext`, the bare name the frame finishes with .png, .mp4 or .webm. */
export function stickerFile(slug: string, id: CardId, format: Format, look: Look, ext?: string): string {
  const base = `${slug}-${id}-${format}-${look}`;
  return ext ? `${base}.${ext}` : base;
}
