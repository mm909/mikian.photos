/**
 * GET /api/admin/coverage/photos
 *
 * Owner-only. Resolves "show me the photos for X" where X is one of:
 *   - ?bib=<n>            — every visible photo in the event with this bib
 *   - ?faceClusterId=<id> — every visible photo with this face cluster
 *   - ?gap=unreachable    — no bib AND no face
 *   - ?gap=bibOnly        — bib detected, no face
 *   - ?gap=faceOnly       — face detected, no bib
 *
 * Always scoped by eventId. Paginated via ?page (1-based) and ?pageSize
 * (default 24, max 96). Returns total + page metadata.
 *
 * The response shape matches DetailPhoto (same as the photographer photos
 * catalog) so the coverage UI can hand the rows straight to PhotoDetailModal
 * for the click-to-preview flow with arrow-key nav + library actions.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 96;

type Gap = "unreachable" | "bibOnly" | "faceOnly";

function isGap(v: string | null): v is Gap {
  return v === "unreachable" || v === "bibOnly" || v === "faceOnly";
}

export async function GET(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const bibParam = url.searchParams.get("bib");
  const faceClusterId = url.searchParams.get("faceClusterId");
  const gapParam = url.searchParams.get("gap");

  const filtersSet = [bibParam, faceClusterId, gapParam].filter((v) => v != null).length;
  if (filtersSet !== 1) {
    return NextResponse.json(
      { error: "Provide exactly one of bib, faceClusterId, gap" },
      { status: 400 }
    );
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE)
  );

  const baseWhere: Prisma.PhotoWhereInput = { eventId, hidden: false };
  let where: Prisma.PhotoWhereInput;

  if (bibParam != null) {
    const bib = Number(bibParam);
    if (!Number.isFinite(bib)) {
      return NextResponse.json({ error: "bib must be a number" }, { status: 400 });
    }
    where = { ...baseWhere, bibs: { some: { bib } } };
  } else if (faceClusterId != null) {
    where = { ...baseWhere, faces: { some: { faceClusterId } } };
  } else if (isGap(gapParam)) {
    if (gapParam === "unreachable") {
      where = { ...baseWhere, bibs: { none: {} }, faces: { none: {} } };
    } else if (gapParam === "bibOnly") {
      where = { ...baseWhere, bibs: { some: {} }, faces: { none: {} } };
    } else {
      where = { ...baseWhere, bibs: { none: {} }, faces: { some: {} } };
    }
  } else {
    return NextResponse.json({ error: "Unknown gap value" }, { status: 400 });
  }

  const [total, rows] = await Promise.all([
    db.photo.count({ where }),
    db.photo.findMany({
      where,
      orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        eventId: true,
        mile: true,
        gpsLat: true,
        gpsLng: true,
        takenAt: true,
        r2OriginalKey: true,
        r2PreviewKey: true,
        hidden: true,
        createdAt: true,
        photographer: { select: { id: true, name: true, email: true } },
        bibs: {
          select: { id: true, bib: true, confidence: true, source: true, createdAt: true },
          orderBy: { confidence: "desc" },
        },
        faces: {
          select: {
            id: true,
            rekognitionFaceId: true,
            faceClusterId: true,
            confidence: true,
            x0: true,
            y0: true,
            x1: true,
            y1: true,
            source: true,
            createdAt: true,
          },
          orderBy: { confidence: "desc" },
        },
      },
    }),
  ]);

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const previewFor = (id: string) =>
    publicBase ? `${publicBase}/previews/${id}.jpg` : `/api/photos/${id}/preview`;

  return NextResponse.json({
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    photos: rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      mile: r.mile,
      gps: r.gpsLat != null && r.gpsLng != null ? [r.gpsLat, r.gpsLng] : null,
      takenAt: r.takenAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      hidden: r.hidden,
      photographer: r.photographer,
      bibs: r.bibs.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
      })),
      faces: r.faces.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
      previewUrl: previewFor(r.id),
      r2OriginalKey: r.r2OriginalKey,
      r2PreviewKey: r.r2PreviewKey,
    })),
  });
}
