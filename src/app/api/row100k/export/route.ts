import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  CHALLENGE_DEMO,
  MONTH,
  birthdayInput,
  fmtDuration,
  fmtRowerNumber,
  fmtSplit,
  isRow100kAdmin,
  pacificDay,
} from "@/lib/row100k";
import { FIRST_MONTH_KEY, monthFromKey, type Month } from "@/lib/rowPeriod";
import { llmExport } from "@/app/row100k/llmExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* CSV export of the challenge (owner, 2026-09-16: "give me the ability to
 * download data to a csv — let me download rower data for everyone or a
 * given rower"). Admin only, JSON 401/403 like the blackout route.
 *
 *   GET /api/row100k/export?kind=rows            one line per logged row
 *   GET /api/row100k/export?kind=rowers          one line per rower
 *   GET /api/row100k/export?rower=19             that rower's rows only
 *   GET /api/row100k/export?kind=llm[&rower=19]  JSON for a model to read
 *                                                (row100k/llmExport.ts)
 *   GET /api/row100k/export?kind=llm&m=2026-09   that month's file; this
 *                                                month without m (THE
 *                                                MONTHS, 2026-09-28; llm only)
 *
 * Real numbers always — this is the admin truth table, so the blackout
 * never touches it; that is also why nothing here is public. Namespaced by
 * CHALLENGE like every other Row* read, so a demo server exports the demo
 * board (the filename says so). RFC 4180 quoting, CRLF line ends, a UTF-8
 * BOM so Excel opens it clean. */

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

async function guard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) {
    return {
      res: NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 }),
    };
  }
  if (!isRow100kAdmin(actor.email, actor.roles)) {
    return { res: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  }
  // Light: a download is a full table scan, and an admin hitting reload is
  // the only caller.
  const limit = await rateLimit({
    key: `row100k-export:${actor.photographerId}`,
    limit: 60,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return {
      res: NextResponse.json(
        { ok: false, error: "Too many downloads at once — try again in a bit." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }
  return { actor };
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/* ------------------------------------------------------------------ csv */

/* One field, RFC 4180: quoted when it holds a comma, a quote or a line
 * break, with inner quotes doubled. A leading =, +, @ or tab gets an
 * apostrophe in front so a rower's note can never run as a formula in the
 * owner's spreadsheet; the numbers are ours and never start that way. */
function csvField(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(fields: unknown[]): string {
  return fields.map(csvField).join(",");
}

/* The whole file: BOM, header, lines, CRLF after every line including the
 * last. */
function csvDocument(header: string[], lines: unknown[][]): string {
  return "﻿" + [header, ...lines].map(csvLine).join("\r\n") + "\r\n";
}

function csvResponse(name: string, body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/* ----------------------------------------------------------------- data */

const ROWS_HEADER = [
  "rowerNumber",
  "name",
  "instagram",
  "division",
  "email",
  "day",
  "title",
  "meters",
  "seconds",
  "time",
  "split",
  "note",
  "photos",
  "entryId",
  "createdAt",
];

/* The four About you columns ride at the END (owner, 2026-09-30, the
 * details block on /row100k/signups): birthday as YYYY-MM-DD, height and
 * weight metric as stored, home gym as typed — blank when not entered. */
const ROWERS_HEADER = [
  "rowerNumber",
  "name",
  "instagram",
  "division",
  "email",
  "joinedAt",
  "sessions",
  "meters",
  "seconds",
  "avgSplit",
  "longest",
  "lastDay",
  "birthday",
  "heightCm",
  "weightKg",
  "homeGym",
];

type Participant = {
  id: string;
  userId: string;
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: string;
  createdAt: Date;
};

type About = {
  birthday: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  homeGym: string | null;
};

type Entry = {
  id: string;
  participantId: string;
  day: string;
  meters: number;
  seconds: number;
  title: string;
  note: string;
  photos: string[];
  createdAt: Date;
};

type Loaded = {
  participants: Participant[];
  entriesOf: Map<string, Entry[]>;
  emailOf: Map<string, string>;
  /* Empty when the About you columns could not be read (see readAbout). */
  aboutOf: Map<string, About>;
};

/* The About you columns in their own query and CAUGHT, the way
 * settings/page.tsx and /row100k/signups read them: if they cannot be read
 * the four columns export blank and the file still comes. */
async function readAbout(ids: string[]): Promise<Map<string, About>> {
  try {
    const rows = await db.rowParticipant.findMany({
      where: { id: { in: ids } },
      select: { id: true, birthday: true, heightCm: true, weightKg: true, homeGym: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  } catch (err) {
    console.error("row100k export: the About you columns could not be read (not pushed yet?)", err);
    return new Map();
  }
}

/* Everyone (or the one rower), by number, with their rows by day then by
 * when they were logged, and the address behind each Google sign-in —
 * RowParticipant.userId is the Photographer id, no relation declared, the
 * way /row100k/signups resolves it. */
async function load(rower: number | null): Promise<Loaded> {
  const participants = await db.rowParticipant.findMany({
    where: { challenge: CHALLENGE, ...(rower ? { rowerNumber: rower } : {}) },
    select: {
      id: true,
      userId: true,
      rowerNumber: true,
      displayName: true,
      instagram: true,
      division: true,
      createdAt: true,
    },
    orderBy: { rowerNumber: "asc" },
  });
  if (participants.length === 0) {
    return { participants, entriesOf: new Map(), emailOf: new Map(), aboutOf: new Map() };
  }

  const [entries, users, aboutOf] = await Promise.all([
    db.rowEntry.findMany({
      where: {
        challenge: CHALLENGE,
        ...(rower ? { participantId: participants[0].id } : {}),
      },
      select: {
        id: true,
        participantId: true,
        day: true,
        meters: true,
        seconds: true,
        title: true,
        note: true,
        photos: true,
        createdAt: true,
      },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
    db.photographer.findMany({
      where: { id: { in: participants.map((p) => p.userId) } },
      select: { id: true, email: true },
    }),
    readAbout(participants.map((p) => p.id)),
  ]);

  const entriesOf = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = entriesOf.get(e.participantId);
    if (list) list.push(e);
    else entriesOf.set(e.participantId, [e]);
  }
  return { participants, entriesOf, emailOf: new Map(users.map((u) => [u.id, u.email])), aboutOf };
}

const split = (meters: number, seconds: number) => (meters > 0 && seconds > 0 ? fmtSplit(meters, seconds) : "");

/* Participants come by number and their rows by day then createdAt, so
 * walking them in order is the sort. */
function rowsLines(data: Loaded): unknown[][] {
  const out: unknown[][] = [];
  for (const p of data.participants) {
    const email = data.emailOf.get(p.userId) ?? "";
    for (const e of data.entriesOf.get(p.id) ?? []) {
      out.push([
        p.rowerNumber,
        p.displayName,
        p.instagram,
        p.division,
        email,
        e.day,
        e.title,
        e.meters,
        e.seconds,
        fmtDuration(e.seconds),
        split(e.meters, e.seconds),
        e.note,
        e.photos.length,
        e.id,
        e.createdAt.toISOString(),
      ]);
    }
  }
  return out;
}

function rowersLines(data: Loaded): unknown[][] {
  return data.participants.map((p) => {
    const rows = data.entriesOf.get(p.id) ?? [];
    const meters = rows.reduce((s, r) => s + r.meters, 0);
    const seconds = rows.reduce((s, r) => s + r.seconds, 0);
    const longest = rows.reduce((m, r) => Math.max(m, r.meters), 0);
    // Rows come sorted by day ascending, so the last one is the latest day.
    const lastDay = rows.length ? rows[rows.length - 1].day : "";
    const about = data.aboutOf.get(p.id);
    return [
      p.rowerNumber,
      p.displayName,
      p.instagram,
      p.division,
      data.emailOf.get(p.userId) ?? "",
      p.createdAt.toISOString(),
      rows.length,
      meters,
      seconds,
      split(meters, seconds),
      longest,
      lastDay,
      birthdayInput(about?.birthday),
      about?.heightCm ?? "",
      about?.weightKg ?? "",
      about?.homeGym ?? "",
    ];
  });
}

/* rowtember-rows-2026-09-16.csv, rowtember-rowers-2026-09-16.csv,
 * rowtember-rower-019-rows.csv (one rower). A demo export says -demo so it
 * can never be mistaken for the live board on the desktop. */
function fileName(kind: "rows" | "rowers", rower: number | null): string {
  const demo = CHALLENGE === CHALLENGE_DEMO ? "-demo" : "";
  if (rower) return `rowtember-rower-${fmtRowerNumber(rower)}${kind === "rows" ? "-rows" : ""}${demo}.csv`;
  return `rowtember-${kind}-${pacificDay(Date.now())}${demo}.csv`;
}

/* ----------------------------------------------------------------- llm */

/* kind=llm (owner, 2026-09-16: "export my rows data to a json for eval from
 * an LLM"): rowtember-rower-019-llm-2026-09.json for one rower,
 * pretty-printed so it pastes clean into a chat;
 * rowtember-field-llm-2026-09.json for everyone, compact, because a
 * hundred rowers indented ran to ~2 MB (owner review, 2026-09-16) and that
 * file is for attaching, not pasting. The month is in the name since the
 * file is one month (2026-09-28). */
async function llmResponse(rower: number | null, month: Month): Promise<NextResponse> {
  const demo = CHALLENGE === CHALLENGE_DEMO ? "-demo" : "";
  const data = rower === null ? await llmExport(null, month) : await llmExport(rower, month);
  if (!data) return bad("No such rower.", 404);
  const name = rower
    ? `rowtember-rower-${fmtRowerNumber(rower)}-llm-${month.key}${demo}.json`
    : `rowtember-field-llm-${month.key}${demo}.json`;
  const body = rower === null ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "rows";
  if (kind !== "rows" && kind !== "rowers" && kind !== "llm") return bad("kind is rows, rowers or llm.");

  const rowerRaw = url.searchParams.get("rower");
  let rower: number | null = null;
  if (rowerRaw !== null && rowerRaw !== "") {
    const n = Number(rowerRaw);
    if (!Number.isInteger(n) || n < 1 || n > 999999) return bad("Which rower?");
    rower = n;
  }

  /* ?m=2026-09: a month from the first one through this one, llm only —
   * the CSVs stay the whole challenge. */
  const mRaw = url.searchParams.get("m");
  let month: Month = MONTH;
  if (mRaw !== null && mRaw !== "") {
    if (kind !== "llm") return bad("m is for kind=llm.");
    const m = monthFromKey(mRaw.trim());
    if (!m || m.key < FIRST_MONTH_KEY || m.key > MONTH.key) return bad("m is a month like 2026-09, the first one through this one.");
    month = m;
  }

  try {
    if (kind === "llm") return await llmResponse(rower, month);
    const data = await load(rower);
    if (rower && data.participants.length === 0) return bad("No such rower.", 404);
    const lines = kind === "rows" ? rowsLines(data) : rowersLines(data);
    const header = kind === "rows" ? ROWS_HEADER : ROWERS_HEADER;
    return csvResponse(fileName(kind, rower), csvDocument(header, lines));
  } catch (err) {
    console.error("row100k export: read failed", err);
    return bad("Couldn't read the rows just now — try again.", 503);
  }
}
