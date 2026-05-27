import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Dev cost guardrail: hard-cap how many rows ever come back.
function maxPhotos(): number {
  const envKey = process.env.NODE_ENV === "production" ? "MAX_PHOTOS_PROD" : "MAX_PHOTOS_DEV";
  const v = Number(process.env[envKey]);
  if (Number.isFinite(v) && v > 0) return v;
  return process.env.NODE_ENV === "production" ? 200 : 10;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const bibParam = url.searchParams.get("bib");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  try {
    const bib = bibParam ? Number(bibParam) : null;
    const where: Record<string, unknown> = { eventId, hidden: false };
    if (bib !== null && Number.isFinite(bib)) where.bib = bib;

    const photos = await db.photo.findMany({
      where,
      take: maxPhotos(),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        eventId: true,
        bib: true,
        mile: true,
        gpsLat: true,
        gpsLng: true,
        takenAt: true,
        photographer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        eventId: p.eventId,
        bib: p.bib,
        mile: p.mile,
        gps: p.gpsLat !== null && p.gpsLng !== null ? [p.gpsLat, p.gpsLng] : null,
        takenAt: p.takenAt,
        photographer: p.photographer.name,
        photographerId: p.photographer.id,
        previewUrl: `/api/photos/${p.id}/preview`,
      })),
      cap: maxPhotos(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
