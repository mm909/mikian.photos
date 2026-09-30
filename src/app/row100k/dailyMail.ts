import { GOAL_METERS, TIERS, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { monthOf, pacificDayKey } from "@/lib/rowPeriod";
import { buildActive } from "./analysis/active";
import type { RawEntry } from "./analysis/data";
import { metersUnder, milestoneLabel, type Censor } from "./rowMail";

/* THE OWNER'S DAILY SUMMARY (owner, 2026-09-30: "I definitely want a
 * summary email sent to me every day, something that looks good in the
 * email: daily active rowers, meters rowed, number of people who have
 * signed up, stuff like that"). One mail a morning, for ONE day on the
 * challenge clock — yesterday, unless the cron is re-run for a day
 * (api/cron/row100k-daily?day=). His stated goal for the platform is DAILY
 * ACTIVE ROWERS, so that is the first block and the one in water blue.
 *
 * PURE, like rowMail.ts: the rows in (dailyInput), the mail out
 * (dailySummaryMail). No db, no next imports, so every number can be
 * checked without mailing anybody (dailyMail.test.ts). The db read is
 * dailyData.ts, which the cron and the emails page share.
 *
 * THE DAY IS THE ROW'S DAY, never when it was typed: the same `day` string
 * buildActive and every board fold on. A row for the 30th logged on the
 * 2nd is in the 30th's mail only if the 30th is re-run — the morning mail
 * for the 2nd does not carry it, and does not pretend to.
 *
 * The furniture is raceEmail's — cream paper, ink type, mono uppercase
 * eyebrows, one big figure per block, inline styles only, no images, no
 * style block — copied rather than shared, the way that file copied it
 * from the shirt mails: one template two features edit at once is a
 * template nobody dares change. The blue is back for this one (the shirt
 * mails kept it; only race day gave it up), on exactly one figure. */

export type DailyMail = { subject: string; text: string; html: string };

export type Rower = { name: string; rowerNumber: number };

/* The rows the fold reads. createdAt flattened to ms the way the analysis
 * loader does, so a Date never has to cross a cache. */
export type DailyRows = {
  participants: { id: string; rowerNumber: number; displayName: string; createdAtMs: number }[];
  entries: RawEntry[];
};

export type DailyInput = {
  /* "2026-10-01", on the challenge clock */
  day: string;
  /* distinct rowers with a row that day */
  active: number;
  /* trailing seven-day mean of active, ending that day */
  avg7: number;
  /* active on the day before */
  activeBefore: number;
  /* meters and rows logged that day */
  meters: number;
  rows: number;
  /* every rower who opted in that day, in number order; the mail prints ten */
  joined: Rower[];
  /* rowers signed up in all, through that day */
  signedUp: number;
  /* the rungs somebody crossed that day, lowest first, with who; a rung
   * nobody crossed is not here */
  crossed: { meters: number; title: string; rowers: Rower[] }[];
  /* the month the day is in, through that day */
  month: {
    /* "October" */
    word: string;
    dayN: number;
    days: number;
    daysLeft: number;
    meters: number;
    rows: number;
    /* distinct rowers with a row in the month */
    rowers: number;
    /* at or past GOAL_METERS in the month */
    club: number;
  };
  /* the top three by meters on the day */
  top: (Rower & {
    participantId: string;
    meters: number;
    rows: number;
    /* Set by the loader while a blackout has this rower hidden (the
     * owner's inbox is a surface, rowMail.ts): the day's meters print
     * under it. Absent, the real number prints. */
    censor?: Censor;
  })[];
};

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/* Noon on the day, on the challenge's fixed UTC-7 clock — an instant
 * buildActive and monthOf read back as that day. */
export function dayNoonMs(key: string): number {
  return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 19);
}

/* A real "YYYY-MM-DD" (Feb 30 is not one). */
export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && DATE_ONLY.test(v) && new Date(dayNoonMs(v)).toISOString().slice(0, 10) === v;
}

/* The day the morning mail is about: the one before the clock's. */
export function yesterdayKey(atMs: number): string {
  return pacificDayKey(atMs - DAY_MS);
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* "Wed Oct 1" */
export function fmtDayShort(key: string): string {
  const d = new Date(dayNoonMs(key));
  return `${DOW[d.getUTCDay()].slice(0, 3)} ${MON[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

/* "Wednesday, October 1" */
export function fmtDayLong(key: string): string {
  const d = new Date(dayNoonMs(key));
  return `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/* ---------------------------------------------------------------- the fold */

export function dailyInput(rows: DailyRows, day: string): DailyInput {
  const at = dayNoonMs(day);
  const month = monthOf(at);
  const byId = new Map(rows.participants.map((p) => [p.id, p]));
  const known = rows.entries.filter((e) => byId.has(e.participantId));
  const rower = (p: { displayName: string; rowerNumber: number }): Rower => ({ name: p.displayName, rowerNumber: p.rowerNumber });
  const byName = (a: Rower, b: Rower) => a.name.localeCompare(b.name) || a.rowerNumber - b.rowerNumber;

  /* Active, the seven-day mean and the day before: buildActive read as of
   * the day's own noon, so its "today" is this day. */
  const a = buildActive(known, at);
  const n = a.days.length;

  /* The day. */
  const perRower = new Map<string, { meters: number; rows: number }>();
  let meters = 0;
  let nRows = 0;
  for (const e of known) {
    if (e.day !== day) continue;
    meters += e.meters;
    nRows += 1;
    const r = perRower.get(e.participantId) ?? { meters: 0, rows: 0 };
    r.meters += e.meters;
    r.rows += 1;
    perRower.set(e.participantId, r);
  }
  const top = [...perRower]
    .map(([id, r]) => ({ participantId: id, ...rower(byId.get(id) as DailyRows["participants"][number]), ...r }))
    .sort((x, y) => y.meters - x.meters || byName(x, y))
    .slice(0, 3);

  /* Who opted in. */
  const joined = rows.participants
    .filter((p) => pacificDayKey(p.createdAtMs) === day)
    .sort((x, y) => x.rowerNumber - y.rowerNumber)
    .map(rower);
  const signedUp = rows.participants.filter((p) => pacificDayKey(p.createdAtMs) <= day).length;

  /* The month through the day, and each rower's total before it and
   * through it — a rung is crossed when the first is under and the second
   * is not. */
  const before = new Map<string, number>();
  const through = new Map<string, number>();
  let monthMeters = 0;
  let monthRows = 0;
  for (const e of known) {
    if (e.day < month.firstDay || e.day > day) continue;
    monthMeters += e.meters;
    monthRows += 1;
    through.set(e.participantId, (through.get(e.participantId) ?? 0) + e.meters);
    if (e.day < day) before.set(e.participantId, (before.get(e.participantId) ?? 0) + e.meters);
  }
  const crossed: DailyInput["crossed"] = [];
  for (const t of TIERS) {
    const who: Rower[] = [];
    for (const [id, m] of through) {
      if ((before.get(id) ?? 0) < t.meters && m >= t.meters) who.push(rower(byId.get(id) as DailyRows["participants"][number]));
    }
    if (who.length) crossed.push({ meters: t.meters, title: t.title, rowers: who.sort(byName) });
  }
  let club = 0;
  for (const m of through.values()) if (m >= GOAL_METERS) club += 1;
  const dayN = Number(day.slice(8, 10));

  return {
    day,
    active: n ? a.days[n - 1].active : 0,
    avg7: a.avg7Now,
    activeBefore: n > 1 ? a.days[n - 2].active : 0,
    meters,
    rows: nRows,
    joined,
    signedUp,
    crossed,
    month: {
      word: month.label.split(" ")[0],
      dayN,
      days: month.days,
      daysLeft: Math.max(0, month.days - dayN),
      meters: monthMeters,
      rows: monthRows,
      rowers: through.size,
      club,
    },
    top,
  };
}

/* A day with nothing in it, for the emails page when yesterday could not
 * be read. */
export function emptyDailyInput(day: string): DailyInput {
  return dailyInput({ participants: [], entries: [] }, day);
}

/* ---------------------------------------------------------------- tokens */

const PAPER = "#F4F3EE";
const INK = "#15171A";
const INK_SOFT = "#3B3E42";
const GRAY = "#8A8A85";
const LINE = "#C9C8C0";
const WATER = "#0077B6";

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";
const BLACK = "'Arial Black',Arial,Helvetica,sans-serif";
const SANS = "Arial,Helvetica,sans-serif";

const N = (n: number) => Math.round(n).toLocaleString("en-US");
const NUM = fmtRowerNumber;
/* The mail prints this many of the day's new rowers by name. */
export const JOINED_SHOWN = 10;

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

/* The meters figure with a small grey unit, the way the stat tiles print it. */
const metersBig = (n: number, color = INK, size = 34) =>
  big(`${escape(N(n))}<span style="font-family:${SANS};font-weight:700;font-size:.5em;color:${GRAY};"> m</span>`, color, size);

/* One block: a hairline, an eyebrow, whatever follows. */
const block = (inner: string, first = false) =>
  `<tr><td style="padding:18px 0 20px;border-top:${first ? `2px solid ${INK}` : `1px dashed ${LINE}`};">${inner}</td></tr>`;

/* A ruled list — the top three, the new rowers: a mono number, a name,
 * and a figure on the right when there is one. */
const ruled = (lines: { lead: string; name: string; right?: string }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;">` +
  lines
    .map(
      (l) =>
        `<tr>` +
        `<td style="padding:7px 10px 7px 0;border-bottom:1px dashed ${LINE};font-family:${MONO};font-size:11px;letter-spacing:.12em;color:${GRAY};white-space:nowrap;width:1%;">${escape(l.lead)}</td>` +
        `<td style="padding:7px 0;border-bottom:1px dashed ${LINE};font-family:${SANS};font-size:15px;color:${INK};">${escape(l.name)}</td>` +
        (l.right !== undefined
          ? `<td style="padding:7px 0 7px 10px;border-bottom:1px dashed ${LINE};font-family:${BLACK};font-weight:900;font-size:14px;color:${INK};text-align:right;white-space:nowrap;">${escape(l.right)}</td>`
          : ``) +
        `</tr>`,
    )
    .join("") +
  `</table>`;

/* The page: the mark in a blue box, a mono kicker, the blocks, the
 * sign-off on a solid rule. */
function shell(kicker: string, blocks: string[], signoff: string): string {
  return [
    `<div style="background:${PAPER};padding:28px 16px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">`,
    `<tr><td style="padding:0 0 16px;">`,
    `<span style="display:inline-block;background:${WATER};color:#ffffff;font-family:${BLACK};font-weight:900;font-size:13px;letter-spacing:.14em;padding:7px 10px 6px;vertical-align:middle;">ROWTEMBER</span>`,
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

/* ------------------------------------------------------------- the words */

/* "+4", "-2", "±0" — the day against the day before. */
export function fmtDelta(now: number, before: number): string {
  const d = now - before;
  return d > 0 ? `+${d}` : d < 0 ? `-${-d}` : "±0";
}

/* "100K · The 100K Club"; a rung whose title is its own number says it once. */
export function rungLabel(r: { meters: number; title: string }): string {
  const k = milestoneLabel(r.meters);
  return r.title.toLowerCase() === k.toLowerCase() ? k : `${k} · ${r.title}`;
}

const who = (r: Rower) => `${NUM(r.rowerNumber)} · ${r.name}`;
const plural = (n: number, one: string, many = `${one}s`) => `${N(n)} ${n === 1 ? one : many}`;

/* -------------------------------------------------------------- the mail */

export function dailySummaryMail(i: DailyInput): DailyMail {
  const dateShort = fmtDayShort(i.day);
  const dateLong = fmtDayLong(i.day);
  const activeLine = `${i.avg7.toFixed(1)} avg over 7 days · ${fmtDelta(i.active, i.activeBefore)} on the day before`;
  const joinedLine = `${N(i.signedUp)} signed up in all`;
  const shown = i.joined.slice(0, JOINED_SHOWN);
  const more = i.joined.length - shown.length;
  const monthEyebrow = `${i.month.word} so far · day ${i.month.dayN} of ${i.month.days}`;
  const monthLine = [
    plural(i.month.rows, "row"),
    `${plural(i.month.rowers, "rower")} rowed`,
    `${N(i.month.club)} in the 100K club`,
    i.month.daysLeft === 0 ? "last day" : plural(i.month.daysLeft, "day left", "days left"),
  ].join(" · ");
  const topMeters = (t: DailyInput["top"][number]) => (t.censor ? metersUnder(t.meters, t.censor) : fmtMeters(t.meters));

  /* The subject is the whole story, the way the row-logged note's is: the
   * day, who rowed, how far, who joined — nothing joined says nothing. */
  const subject = [`Rowtember`, dateShort, `${N(i.active)} rowed`, fmtMeters(i.meters), ...(i.joined.length ? [`+${N(i.joined.length)} joined`] : [])].join(" · ");

  const html = shell(
    `Daily · ${dateLong}`,
    [
      block(eyebrow("Daily active rowers") + big(escape(N(i.active)), WATER, 44) + small(activeLine, INK), true),
      block(eyebrow("Meters on the day") + metersBig(i.meters) + small(plural(i.rows, "row"), INK)),
      block(
        eyebrow("Joined") +
          big(escape(i.joined.length ? `+${N(i.joined.length)}` : "0")) +
          small(joinedLine, INK) +
          (shown.length ? ruled(shown.map((r) => ({ lead: NUM(r.rowerNumber), name: r.name }))) : ``) +
          (more > 0 ? small(`+${N(more)} more`) : ``),
      ),
      ...(i.crossed.length
        ? [
            block(
              eyebrow("Crossed a rung") +
                i.crossed.map((c) => small(rungLabel(c), INK) + body(c.rowers.map((r) => r.name).join(" · "))).join(""),
            ),
          ]
        : []),
      block(eyebrow(monthEyebrow) + metersBig(i.month.meters) + small(monthLine, INK)),
      block(
        eyebrow("Top three on the day") +
          (i.top.length
            ? ruled(i.top.map((t, k) => ({ lead: `${k + 1} · ${NUM(t.rowerNumber)}`, name: t.name, right: topMeters(t) })))
            : small("nobody rowed", INK)),
      ),
    ],
    "Row on.",
  );

  const text = [
    `ROWTEMBER — ${dateLong.toUpperCase()}`,
    ``,
    `DAILY ACTIVE ROWERS`,
    `${N(i.active)} · ${activeLine}`,
    ``,
    `METERS ON THE DAY`,
    `${fmtMeters(i.meters)} · ${plural(i.rows, "row")}`,
    ``,
    `JOINED`,
    `${i.joined.length ? `+${N(i.joined.length)}` : "0"} · ${joinedLine}`,
    ...shown.map(who),
    ...(more > 0 ? [`+${N(more)} more`] : []),
    ``,
    ...(i.crossed.length
      ? [`CROSSED A RUNG`, ...i.crossed.map((c) => `${rungLabel(c)}: ${c.rowers.map((r) => r.name).join(", ")}`), ``]
      : []),
    monthEyebrow.toUpperCase(),
    `${fmtMeters(i.month.meters)} · ${monthLine}`,
    ``,
    `TOP THREE ON THE DAY`,
    ...(i.top.length ? i.top.map((t, k) => `${k + 1} · ${who(t)} · ${topMeters(t)}`) : [`nobody rowed`]),
    ``,
    `Row on.`,
  ].join("\n");

  return { subject, text, html };
}
