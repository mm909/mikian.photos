import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { eventBySlug } from "@/app/hyrox/events";
import { ROW, refreshRecord } from "@/app/hyrox/row";

/* POST /api/hyrox/<event>/refresh — the owner reads entries from hyresult
 * again (record.ts): the prior races and the PR, the published wave
 * once the start list is out, the finish once the race is run (owner,
 * 2026-10-15: "later on, it should update with their time ... whenever
 * it's over").
 *   { id }          one entry
 *   { all: true }   a batch of the least recently looked up — BATCH at a
 *                   time, a few names in flight, so a long list fits a
 *                   serverless function; the list page calls again
 *                   while `remaining` is more than 0.
 * Owner only: 404 for anyone else, the way the list is. */
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH = 12;
const IN_FLIGHT = 4;

export async function POST(req: Request, { params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) return new NextResponse(null, { status: 404 });
  const actor = await getEffectiveActor();
  if (!actor || !isAdmin(actor)) return new NextResponse(null, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    const b = (await req.json()) as unknown;
    if (b && typeof b === "object") body = b as Record<string, unknown>;
  } catch {
    /* no body: nothing to do */
  }
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 64) : "";
  if (!id && body.all !== true) return NextResponse.json({ ok: false, error: "Which entry?" }, { status: 400 });

  let rows;
  try {
    rows = id
      ? await db.hyroxEntry.findMany({ where: { id, event: ev.slug }, select: ROW })
      : await db.hyroxEntry.findMany({ where: { event: ev.slug }, select: ROW, orderBy: [{ recordAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], take: BATCH });
  } catch (err) {
    console.error("hyrox: refresh could not read the rows", err);
    return NextResponse.json({ ok: false, error: "Couldn't read the list — has the table been pushed?" }, { status: 503 });
  }
  if (id && rows.length === 0) return NextResponse.json({ ok: false, error: "No such entry." }, { status: 404 });

  const since = Date.now();
  let looked = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += IN_FLIGHT) {
    const done = await Promise.all(rows.slice(i, i + IN_FLIGHT).map((r) => refreshRecord(ev, r)));
    for (const d of done) d ? looked++ : failed++;
  }

  /* What is still older than this call started (or never looked up). */
  let remaining = 0;
  if (!id) {
    try {
      remaining = await db.hyroxEntry.count({ where: { event: ev.slug, OR: [{ recordAt: null }, { recordAt: { lt: new Date(since) } }] } });
    } catch {
      remaining = 0;
    }
    /* Names hyresult could not be reached for stay old; do not loop on them. */
    if (failed > 0 && looked === 0) remaining = 0;
  }
  return NextResponse.json({ ok: true, looked, failed, remaining });
}
