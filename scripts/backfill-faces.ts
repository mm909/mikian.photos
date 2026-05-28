/**
 * Backfill Rekognition face indexing for photos that haven't been indexed yet.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx -y dotenv-cli -e .env.local \
 *     -- npx tsx scripts/backfill-faces.ts
 *
 * The `--conditions=react-server` flag is needed because faceRec.ts (rightly)
 * imports `server-only`, which throws when loaded outside Next's RSC context.
 * The flag selects the package's empty stub instead. Same trick works for
 * the other server-only-using scripts.
 *
 * For each photo without a `facesIndexedAt` timestamp, pulls the preview from
 * R2, runs indexFacesForPhoto (which creates the per-event Rekognition
 * collection if missing, runs IndexFaces, then SearchFaces-based clustering),
 * and writes PhotoFace rows.
 *
 * Idempotent via the facesIndexedAt skip in indexFacesForPhoto. Pass --force
 * to reindex everything (drops existing PhotoFace + Rekognition entries first,
 * which costs roughly one extra DeleteFaces call per photo).
 *
 * Flags:
 *   --limit=N        process at most N photos (default 200)
 *   --event=eventId  only process photos in this event
 *   --force          reindex even if facesIndexedAt is set
 *
 * Cost ballpark: $0.001 per IndexFaces call + $0.001 per SearchFaces call
 * (one per detected face for clustering). A 1,200-photo event at ~3 faces
 * each → ~$5. Free tier covers the first 5,000 image-API calls per month.
 */
import { PrismaClient } from "@prisma/client";
import { r2GetStream, r2Keys, r2Configured } from "../src/lib/r2";
import { indexFacesForPhoto, faceRecConfigured } from "../src/lib/faceRec";

const db = new PrismaClient();

function parseFlags() {
  const flags: { limit: number; force: boolean; eventId?: string } = {
    limit: 200,
    force: false,
  };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--limit=(\d+)$/);
    if (m) flags.limit = Number(m[1]);
    if (a === "--force") flags.force = true;
    const e = a.match(/^--event=(.+)$/);
    if (e) flags.eventId = e[1];
  }
  return flags;
}

async function fetchPreviewBytes(photoId: string): Promise<Buffer> {
  const key = r2Keys.preview(photoId);
  const { body } = await r2GetStream(key);
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
  if (!faceRecConfigured()) {
    console.error(
      "Rekognition not configured — set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    );
    process.exit(1);
  }

  const where: Record<string, unknown> = {};
  if (!flags.force) where.facesIndexedAt = null;
  if (flags.eventId) where.eventId = flags.eventId;

  const photos = await db.photo.findMany({
    where,
    select: { id: true, eventId: true, facesIndexedAt: true },
    take: flags.limit,
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `processing ${photos.length} photo(s) (limit=${flags.limit}, force=${flags.force}${flags.eventId ? `, event=${flags.eventId}` : ""})`
  );

  let totalFaces = 0;
  let processed = 0;
  let errored = 0;

  for (const p of photos) {
    processed++;
    try {
      const bytes = await fetchPreviewBytes(p.id);
      const indexed = await indexFacesForPhoto({
        photoId: p.id,
        eventId: p.eventId,
        bytes,
        force: flags.force,
      });
      totalFaces += indexed.length;
      console.log(
        `  [${processed}/${photos.length}] ${p.id} — ${indexed.length} face${indexed.length === 1 ? "" : "s"}`
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
    `\nDone. ${totalFaces} face(s) indexed across ${processed} photo(s); ${errored} errored.`
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
