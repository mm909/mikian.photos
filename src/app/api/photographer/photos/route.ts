import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processUpload } from "@/lib/imagePipeline";
import { r2Configured, r2Put, r2Keys } from "@/lib/r2";
import { getEffectivePhotographerId } from "@/lib/photographerLock";

// Upload one photo. Multipart form with:
//   file: the image
//   eventId: which event this photo belongs to
//   bib (optional): manual tag
//   mile (optional)
//
// Returns the created Photo row (without the R2 keys — server-only).
export const runtime = "nodejs";
// Vercel limit is 4.5MB on the default body parser. Bumping the route's
// expected body so multipart photos go through. (Vercel respects this hint.)
export const maxDuration = 60;

export async function POST(req: Request) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json(
      { error: "Photographer access required — sign in or unlock first" },
      { status: 401 }
    );
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read upload" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const eventId = String(form.get("eventId") ?? "");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "unknown eventId" }, { status: 404 });

  const bib = parseIntOrNull(form.get("bib"));
  const mile = parseIntOrNull(form.get("mile"));

  let original: Buffer;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    original = buf;
  } catch {
    return NextResponse.json({ error: "could not read file bytes" }, { status: 400 });
  }

  let processed;
  try {
    processed = await processUpload(original);
  } catch (e) {
    return NextResponse.json(
      { error: `image-processing failed: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  // Insert row first to get the photo ID (used in R2 keys).
  const created = await db.photo.create({
    data: {
      eventId,
      photographerId,
      bib,
      mile,
      gpsLat: processed.gpsLat,
      gpsLng: processed.gpsLng,
      takenAt: processed.takenAt,
      r2OriginalKey: "pending", // overwritten below
      r2PreviewKey: "pending",
    },
  });

  const originalKey = r2Keys.original(created.id);
  const previewKey = r2Keys.preview(created.id);

  try {
    await Promise.all([
      r2Put(originalKey, processed.originalBytes, file.type || "image/jpeg"),
      r2Put(previewKey, processed.previewBytes, "image/jpeg"),
    ]);
  } catch (e) {
    // Roll back the row if uploads failed
    await db.photo.delete({ where: { id: created.id } }).catch(() => undefined);
    return NextResponse.json(
      { error: `R2 upload failed: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  // Update the row with real keys
  const finalRow = await db.photo.update({
    where: { id: created.id },
    data: { r2OriginalKey: originalKey, r2PreviewKey: previewKey },
    select: {
      id: true, eventId: true, bib: true, mile: true, takenAt: true,
      gpsLat: true, gpsLng: true,
    },
  });

  return NextResponse.json({
    photo: {
      ...finalRow,
      previewUrl: `/api/photos/${finalRow.id}/preview`,
    },
  });
}

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
