/**
 * Roster import API — event manager only (platform owner OR the event's owner).
 *
 *   POST /api/admin/roster-import
 *     body: { eventId, input, dryRun? }
 *     - dryRun:true  → parse only; return a PREVIEW (detected source, first ~25
 *                      rows, total count, warnings). NO writes.
 *     - dryRun:false → detect + parse + upsert; return counts.
 *     Missing RosterEntry table → 503 with a "run npm run prisma:push" hint.
 *
 *   GET /api/admin/roster-import?eventId=…
 *     → { count, sample } for the review UI (fail-open: count 0 when unmigrated).
 *
 * Auth mirrors the other event-scoped admin APIs: requireEventManager(eventId).
 */
import { NextResponse } from "next/server";
import { requireEventManager } from "@/lib/permissions";
import { importRoster, parseInput, SOURCE_LABELS } from "@/lib/rosterImport";
import { getRosterCount } from "@/lib/roster";
import { db } from "@/lib/db";

// Node runtime: the URL adapter uses server-side fetch (RunSignup API / page
// scrape) which needs the Node fetch/AbortController, and DB access.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_ROWS = 25;
const MAX_INPUT_CHARS = 5_000_000; // ~5 MB of pasted text; guards memory.

const PUSH_HINT =
  "The roster table isn't in the database yet. Run `npm run prisma:push` to create it, then import again.";

export async function POST(req: Request) {
  let body: { eventId?: unknown; input?: unknown; dryRun?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const input = typeof body.input === "string" ? body.input : "";
  const dryRun = body.dryRun === true;

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  if (!input.trim()) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }
  if (input.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: "Input is too large — paste up to ~5 MB, or upload the .csv." },
      { status: 413 }
    );
  }

  const actor = await requireEventManager(eventId);
  if (!actor) {
    // Distinguish "no such event" from "not allowed" the way other routes
    // don't need to — here a 403 is the safe default for both.
    return NextResponse.json(
      { error: "You don't have permission to manage this event." },
      { status: 403 }
    );
  }

  // --- DRY RUN: parse + preview, no writes ---
  if (dryRun) {
    const parsed = await parseInput(input);
    return NextResponse.json({
      dryRun: true,
      eventId,
      source: parsed.source,
      sourceLabel: parsed.sourceLabel,
      isUrl: parsed.isUrl,
      total: parsed.entries.length,
      warnings: parsed.warnings,
      preview: parsed.entries.slice(0, PREVIEW_ROWS),
      previewTruncated: parsed.entries.length > PREVIEW_ROWS,
    });
  }

  // --- REAL IMPORT ---
  const result = await importRoster(eventId, input);
  if (result.tableMissing) {
    return NextResponse.json(
      {
        error: PUSH_HINT,
        needsPush: true,
        source: result.source,
        sourceLabel: result.sourceLabel,
      },
      { status: 503 }
    );
  }

  const count = await getRosterCount(eventId);
  return NextResponse.json({
    ok: result.ok,
    eventId,
    source: result.source,
    sourceLabel: result.sourceLabel,
    imported: result.imported,
    updated: result.updated,
    skipped: result.skipped,
    total: result.total,
    warnings: result.warnings,
    rosterCount: count,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId")?.trim() || "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const actor = await requireEventManager(eventId);
  if (!actor) {
    return NextResponse.json(
      { error: "You don't have permission to manage this event." },
      { status: 403 }
    );
  }

  const count = await getRosterCount(eventId);
  let sample: {
    bib: number;
    name: string;
    distance: string | null;
    finishTime: string | null;
    gender: string | null;
    ageGroup: string | null;
    city: string | null;
  }[] = [];
  try {
    sample = await db.rosterEntry.findMany({
      where: { eventId },
      orderBy: { bib: "asc" },
      take: 50,
      select: {
        bib: true,
        name: true,
        distance: true,
        finishTime: true,
        gender: true,
        ageGroup: true,
        city: true,
      },
    });
  } catch {
    // Unmigrated / read error → empty sample (count already fail-open to 0).
    sample = [];
  }

  return NextResponse.json({
    eventId,
    count,
    sample,
    sourceLabels: SOURCE_LABELS,
  });
}
