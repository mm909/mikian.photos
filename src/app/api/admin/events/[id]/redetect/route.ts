import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventManager } from "@/lib/permissions";
import { r2Configured } from "@/lib/r2";
import { faceRecConfigured } from "@/lib/faceRec";
import {
  eventPhotoWhere,
  rerunStageForEvent,
  type RedetectStage,
} from "@/lib/detection";

/**
 * Owner-only FORCED re-run of a detection stage across ALL of an event's photos.
 *
 *   GET  → { total }                  how many photos the re-run will cover
 *   POST { stage, cursor? }
 *        → { processed, nextCursor }   re-run one batch; client loops on
 *                                      nextCursor until it's null
 *
 * Unlike the dead-photo backfill (/api/photographer/events/[eventId]/backfill),
 * this re-processes already-detected photos — used after enabling color groups,
 * tuning OCR, or fixing a bad run. `stage` ∈ ocr | faces | colors | all.
 *
 * Cost note: `faces`/`all` re-index every face via Rekognition (billed per
 * face) — the UI confirms before running. Honors the event's per-stage toggles.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Photos per POST — bounded so one invocation stays under maxDuration. The
 *  client loops; faces (Rekognition round-trips) is the slowest stage. */
const BATCH = 12;

const STAGES: RedetectStage[] = ["ocr", "faces", "colors", "all"];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const total = await db.photo.count({ where: eventPhotoWhere(params.id) });
  return NextResponse.json({ total });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let body: { stage?: unknown; cursor?: unknown };
  try {
    body = (await req.json()) as { stage?: unknown; cursor?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const stage = body.stage as RedetectStage;
  if (!STAGES.includes(stage)) {
    return NextResponse.json({ error: "stage must be ocr | faces | colors | all" }, { status: 400 });
  }
  const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : null;

  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  if (stage === "faces" && !faceRecConfigured()) {
    return NextResponse.json(
      { error: "Face recognition is not configured on this deploy" },
      { status: 503 }
    );
  }

  // Reject a stage the owner has turned off (so a re-run can't repopulate
  // disabled data). "all" runs whatever is enabled, so it's never blocked.
  const ev = await db.event.findUnique({
    where: { id: params.id },
    select: { ocrEnabled: true, faceRecEnabled: true, colorGroupEnabled: true },
  });
  if (stage === "ocr" && ev?.ocrEnabled === false) {
    return NextResponse.json({ error: "Bib OCR is disabled for this event" }, { status: 409 });
  }
  if (stage === "faces" && ev?.faceRecEnabled === false) {
    return NextResponse.json({ error: "Face recognition is disabled for this event" }, { status: 409 });
  }
  if (stage === "colors" && ev?.colorGroupEnabled !== true) {
    return NextResponse.json({ error: "Color groups are disabled for this event" }, { status: 409 });
  }

  const { processed, nextCursor } = await rerunStageForEvent({
    eventId: params.id,
    stage,
    limit: BATCH,
    cursor,
  });
  return NextResponse.json({ processed, nextCursor });
}
