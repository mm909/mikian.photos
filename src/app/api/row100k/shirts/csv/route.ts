import { NextResponse } from "next/server";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, CHALLENGE_DEMO, fmtRowerNumber, isRow100kAdmin } from "@/lib/row100k";
import { SIZES } from "@/app/row100k/shirtPreorder";
import { listPreorders } from "@/app/row100k/shirtPreorders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* THE PRE-ORDERS AS A CSV (owner, 2026-09-30): one line per live
 * reservation, the list the shirts get ordered from. Admin only, JSON
 * 401/403 like the export route, and the same RFC 4180 quoting, CRLF
 * line ends and UTF-8 BOM so Excel opens it clean (the three helpers are
 * the export route's; a route file cannot export them). Namespaced by
 * CHALLENGE like every other Row* read, so a demo server exports the demo
 * list and the filename says so. */

function csvField(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(fields: unknown[]): string {
  return fields.map(csvField).join(",");
}

function csvDocument(header: string[], lines: unknown[][]): string {
  return "﻿" + [header, ...lines].map(csvLine).join("\r\n") + "\r\n";
}

const HEADER = ["rowerNumber", "name", "email", "color", "size", "reservedAt", "updatedAt"];

export async function GET() {
  const actor = await getEffectiveActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!isRow100kAdmin(actor.email, actor.roles)) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }
  try {
    /* Black first, then cream, each S to 2XL then by rower, so the file
     * reads as the order sheet. */
    const sz = (s: string) => (SIZES as readonly string[]).indexOf(s);
    const rows = (await listPreorders()).sort(
      (a, b) => a.color.localeCompare(b.color) || sz(a.size) - sz(b.size) || a.rowerNumber - b.rowerNumber,
    );
    const body = csvDocument(
      HEADER,
      rows.map((r) => [fmtRowerNumber(r.rowerNumber), r.name, r.email, r.color, r.size, r.createdAt, r.updatedAt]),
    );
    const name = `rowtember-shirt-preorders${CHALLENGE === CHALLENGE_DEMO ? "-demo" : ""}.csv`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("row100k shirts csv: read failed (table pushed?)", err);
    return NextResponse.json({ ok: false, error: "Couldn't read the list just now." }, { status: 503 });
  }
}
