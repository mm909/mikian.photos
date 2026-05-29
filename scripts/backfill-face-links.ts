/**
 * Backfill face↔bib geometric links for an event's existing photos.
 *
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/backfill-face-links.ts
 *
 * The face-above-bib matching (src/lib/faceBibMatch.ts) needs bib bounding
 * boxes, which only get captured at OCR time by the new pipeline. Photos
 * uploaded before that change have PhotoBib rows with null boxes, so their
 * faces never link. This script re-runs OCR (now capturing boxes) and then
 * recomputes the links — exactly what POST /rerun-ocr does, but in bulk and
 * without the HTTP/auth round-trip.
 *
 * For each photo that has at least one detected face:
 *   1. pull the preview from R2
 *   2. re-run extractBibsFromImage (captures normalized boxes)
 *   3. replace the photo's `ocr-*` PhotoBib rows with boxed ones (manual /
 *      user-tag rows are left untouched)
 *   4. linkFacesToBibsForPhoto() — sets PhotoFace.bib from the geometry
 *
 * Idempotent — safe to re-run. Once boxes exist, re-running just re-confirms
 * the same links.
 *
 * Flags:
 *   --event=ID   event to process (default "lighthouse-half-2026")
 *   --limit=N    process at most N photos (default 10000)
 *   --all        process every photo in the event, not just ones with faces
 *                (photos with no face can't link, so the default skips them)
 */
import { PrismaClient } from "@prisma/client";
import { r2GetStream, r2Keys, r2Configured } from "../src/lib/r2";
import { extractBibsFromImage } from "../src/lib/bibOcr";
import { linkFacesToBibsForPhoto } from "../src/lib/faceBibMatch";

const db = new PrismaClient();

function parseFlags() {
  const flags = { event: "lighthouse-half-2026", limit: 10000, all: false };
  for (const a of process.argv.slice(2)) {
    const e = a.match(/^--event=(.+)$/);
    if (e) flags.event = e[1];
    const l = a.match(/^--limit=(\d+)$/);
    if (l) flags.limit = Number(l[1]);
    if (a === "--all") flags.all = true;
  }
  return flags;
}

async function fetchPreviewBytes(photoId: string): Promise<Buffer> {
  const { body } = await r2GetStream(r2Keys.preview(photoId));
  const chunks: Buffer[] = [];
  for await (const c of body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

async function main() {
  const flags = parseFlags();
  if (!r2Configured()) {
    console.error("R2 not configured — populate .env.local first");
    process.exit(1);
  }

  const photos = await db.photo.findMany({
    where: {
      eventId: flags.event,
      hidden: false,
      ...(flags.all ? {} : { faces: { some: {} } }),
    },
    select: { id: true },
    take: flags.limit,
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `processing ${photos.length} photo(s) for event=${flags.event} (all=${flags.all}, limit=${flags.limit})`
  );

  let processed = 0;
  let linked = 0;
  let errored = 0;

  for (const p of photos) {
    processed++;
    try {
      const bytes = await fetchPreviewBytes(p.id);
      const hits = await extractBibsFromImage(bytes);

      // Replace OCR detections with boxed ones; leave manual/user-tag intact.
      await db.photoBib.deleteMany({
        where: { photoId: p.id, source: { startsWith: "ocr-" } },
      });
      if (hits.length > 0) {
        await db.photoBib.createMany({
          data: hits.map((h) => ({
            photoId: p.id,
            bib: h.bib,
            confidence: h.confidence,
            source: "ocr-tesseract",
            x0: h.bbox?.x0 ?? null,
            y0: h.bbox?.y0 ?? null,
            x1: h.bbox?.x1 ?? null,
            y1: h.bbox?.y1 ?? null,
          })),
          skipDuplicates: true,
        });
      }

      await linkFacesToBibsForPhoto(p.id);

      const n = await db.photoFace.count({
        where: { photoId: p.id, bib: { not: null } },
      });
      linked += n;
      console.log(
        `  [${processed}/${photos.length}] ${p.id} — ${hits.length} bib(s), ${n} face link(s)`
      );
    } catch (e) {
      errored++;
      console.warn(
        `  [${processed}/${photos.length}] ${p.id} — error:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  console.log(
    `\nDone. ${linked} face link(s) across ${processed} photo(s); ${errored} errored.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
