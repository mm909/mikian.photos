import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  CHALLENGE_DEMO,
  fmtDuration,
  fmtRowerNumber,
  fmtSplit,
  isRow100kAdmin,
  pacificDay,
} from "@/lib/row100k";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* CSV export of the challenge (owner, 2026-09-16: "give me the ability to
 * download data to a csv — let me download rower data for everyone or a
 * given rower"). Admin only, JSON 401/403 like the blackout route.
 *
 *   GET /api/row100k/export?kind=rows            one line per logged row
 *   GET /api/row100k/export?kind=rowers          one line per rower
 *   GET /api/row100k/export?rower=19             that rower's rows only
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
};

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
  if (participants.length === 0) return { participants, entriesOf: new Map(), emailOf: new Map() };

  const [entries, users] = await Promise.all([
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
  ]);

  const entriesOf = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = entriesOf.get(e.participantId);
    if (list) list.push(e);
    else entriesOf.set(e.participantId, [e]);
  }
  return { participants, entriesOf, emailOf: new Map(users.map((u) => [u.id, u.email])) };
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

export async function GET(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "rows";
  if (kind !== "rows" && kind !== "rowers") return bad("kind is rows or rowers.");

  const rowerRaw = url.searchParams.get("rower");
  let rower: number | null = null;
  if (rowerRaw !== null && rowerRaw !== "") {
    const n = Number(rowerRaw);
    if (!Number.isInteger(n) || n < 1 || n > 999999) return bad("Which rower?");
    rower = n;
  }

  try {
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
