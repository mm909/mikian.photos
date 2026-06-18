/**
 * GET /api/admin/coverage?eventId=...
 *
 * Owner + race director insights endpoint. Returns server-aggregated rollups
 * so the client can render the coverage screen without ever shipping the full
 * photo list. Read-only — it only feeds the roster stat strip.
 *
 * Shape:
 *   {
 *     event: { id, name },
 *     totals: { photos, withBib, withFace, withBoth, withNeither },
 *     bibs:   [{ bib, photoCount, sources[], avgConfidence, faceCount, runner }],
 *     faces:  [{ faceClusterId, photoCount, bibsSeenAlongside[], avgConfidence }],
 *     gaps:   {
 *       unreachable: { count, samplePhotoIds[] },  // no bib, no face
 *       bibOnly:     { count, samplePhotoIds[] },  // bib detected, no face
 *       faceOnly:    { count, samplePhotoIds[] },  // face detected, no bib
 *     }
 *   }
 *
 * Aggregations run in-memory after one wide Prisma query — fine at MVP
 * scale (~hundreds of photos per event). For events that grow past a few
 * thousand photos we'd push counts into SQL `groupBy`s, but the shape of
 * the response is stable either way.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";

export const runtime = "nodejs";

/** Cap on sample photo ids returned per gap bucket — keeps payload small. */
const GAP_SAMPLE_SIZE = 12;

export async function GET(req: Request) {
  // Owner-tier (platform admin). Read-only rollups.
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Unknown eventId" }, { status: 404 });
  }

  const photos = await db.photo.findMany({
    where: { eventId, hidden: false },
    select: {
      id: true,
      bibs: { select: { bib: true, confidence: true, source: true } },
      // Pull face id + photoId too so we can pick a representative crop
      // per cluster (highest-confidence face). Used to render face
      // thumbnails on the coverage "By face" tab.
      faces: {
        select: { id: true, faceClusterId: true, confidence: true },
      },
    },
  });

  // --- Aggregations ---

  // Per-bib: photo count, sources set, summed confidence (for avg), face
  // clusters that appeared in any photo with this bib.
  const bibAgg = new Map<
    number,
    {
      photoCount: number;
      sources: Set<string>;
      confSum: number;
      faceClusters: Set<string>;
    }
  >();

  // Per-face cluster: photo count, summed confidence, bibs seen alongside,
  // plus a sample {photoId, faceId} = the highest-confidence face we've
  // seen for this cluster (so the UI can render a crop thumbnail).
  const faceAgg = new Map<
    string,
    {
      photoCount: number;
      confSum: number;
      bibsSeen: Set<number>;
      sampleFaceId: string;
      samplePhotoId: string;
      sampleConfidence: number;
    }
  >();

  // Gap buckets — sample ids only.
  const gapsUnreachable: string[] = [];
  const gapsBibOnly: string[] = [];
  const gapsFaceOnly: string[] = [];
  let countUnreachable = 0;
  let countBibOnly = 0;
  let countFaceOnly = 0;
  let countWithBoth = 0;

  for (const p of photos) {
    const hasBib = p.bibs.length > 0;
    const hasFace = p.faces.length > 0;
    // Skip null clusterIds — they're possible for manual-source rows and
    // would corrupt the aggregation if we treated them as a single cluster.
    const photoFaceClusters = new Set(
      p.faces.map((f) => f.faceClusterId).filter((c): c is string => !!c)
    );

    for (const b of p.bibs) {
      const slot =
        bibAgg.get(b.bib) ??
        { photoCount: 0, sources: new Set<string>(), confSum: 0, faceClusters: new Set<string>() };
      slot.photoCount += 1;
      slot.sources.add(b.source);
      slot.confSum += b.confidence;
      for (const c of photoFaceClusters) slot.faceClusters.add(c);
      bibAgg.set(b.bib, slot);
    }

    const photoBibs = new Set(p.bibs.map((b) => b.bib));
    for (const f of p.faces) {
      if (!f.faceClusterId) continue; // can't aggregate an unclustered face
      const existing = faceAgg.get(f.faceClusterId);
      const slot = existing ?? {
        photoCount: 0,
        confSum: 0,
        bibsSeen: new Set<number>(),
        sampleFaceId: f.id,
        samplePhotoId: p.id,
        sampleConfidence: f.confidence,
      };
      slot.photoCount += 1;
      slot.confSum += f.confidence;
      for (const bib of photoBibs) slot.bibsSeen.add(bib);
      // Keep the highest-confidence face as the cluster's representative
      // sample for thumbnails.
      if (existing && f.confidence > slot.sampleConfidence) {
        slot.sampleFaceId = f.id;
        slot.samplePhotoId = p.id;
        slot.sampleConfidence = f.confidence;
      }
      faceAgg.set(f.faceClusterId, slot);
    }

    if (hasBib && hasFace) {
      countWithBoth += 1;
    } else if (hasBib && !hasFace) {
      countBibOnly += 1;
      if (gapsBibOnly.length < GAP_SAMPLE_SIZE) gapsBibOnly.push(p.id);
    } else if (!hasBib && hasFace) {
      countFaceOnly += 1;
      if (gapsFaceOnly.length < GAP_SAMPLE_SIZE) gapsFaceOnly.push(p.id);
    } else {
      countUnreachable += 1;
      if (gapsUnreachable.length < GAP_SAMPLE_SIZE) gapsUnreachable.push(p.id);
    }
  }

  // Build the runner lookup. Only Lighthouse is wired today; other events
  // will return null in the `runner` field.
  const runnerByBib = new Map<number, { name: string }>();
  if (eventId === "lighthouse-half-2026") {
    for (const r of LIGHTHOUSE_RACERS) runnerByBib.set(r.bib, { name: r.name });
  }

  const bibsOut = Array.from(bibAgg.entries())
    .map(([bib, slot]) => ({
      bib,
      photoCount: slot.photoCount,
      sources: Array.from(slot.sources).sort(),
      avgConfidence: slot.confSum / slot.photoCount,
      faceCount: slot.faceClusters.size,
      runner: runnerByBib.get(bib)?.name ?? null,
    }))
    .sort((a, b) => b.photoCount - a.photoCount);

  const facesOut = Array.from(faceAgg.entries())
    .map(([faceClusterId, slot]) => ({
      faceClusterId,
      photoCount: slot.photoCount,
      bibsSeenAlongside: Array.from(slot.bibsSeen).sort((a, b) => a - b),
      avgConfidence: slot.confSum / slot.photoCount,
      // {photoId, faceId} for the representative face crop. The UI hits
      // /api/photos/[photoId]/face/[faceId] to render the thumbnail.
      sampleFace: {
        photoId: slot.samplePhotoId,
        faceId: slot.sampleFaceId,
      },
    }))
    .sort((a, b) => b.photoCount - a.photoCount);

  const totalPhotos = photos.length;
  const withBib = countBibOnly + countWithBoth;
  const withFace = countFaceOnly + countWithBoth;

  return NextResponse.json({
    event: { id: event.id, name: event.name },
    totals: {
      photos: totalPhotos,
      withBib,
      withFace,
      withBoth: countWithBoth,
      withNeither: countUnreachable,
    },
    bibs: bibsOut,
    faces: facesOut,
    gaps: {
      unreachable: { count: countUnreachable, samplePhotoIds: gapsUnreachable },
      bibOnly: { count: countBibOnly, samplePhotoIds: gapsBibOnly },
      faceOnly: { count: countFaceOnly, samplePhotoIds: gapsFaceOnly },
    },
  });
}
