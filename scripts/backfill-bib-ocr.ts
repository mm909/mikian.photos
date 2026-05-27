/**
 * Backfill bib OCR for photos that don't yet have PhotoBib rows.
 *
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/backfill-bib-ocr.ts
 *
 * For each photo with zero PhotoBib entries, pulls the preview from R2, runs
 * extractBibsFromImage, and writes whatever it detects with source="ocr-tesseract".
 *
 * Idempotent — skips photos that already have any PhotoBib rows. Re-run any
 * time you upgrade the OCR provider (delete the prior source's rows first,
 * then run).
 *
 * Flags:
 *   --limit=N    process at most N photos (default 200)
 *   --source=S   filter to rows produced by a specific source ("manual",
 *                "ocr-tesseract", etc.) — useful for re-running just OCR
 *                rows after a model upgrade
 *   --force      ignore "already has bibs" check and reprocess everything
 *                under the limit
 */
import { PrismaClient } from "@prisma/client";
import { r2GetStream, r2Keys, r2Configured } from "../src/lib/r2";
import { extractBibsFromImage } from "../src/lib/bibOcr";

const db = new PrismaClient();

function parseFlags() {
  const flags: { limit: number; force: boolean; source?: string } = {
    limit: 200,
    force: false,
  };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--limit=(\d+)$/);
    if (m) flags.limit = Number(m[1]);
    if (a === "--force") flags.force = true;
    const s = a.match(/^--source=(.+)$/);
    if (s) flags.source = s[1];
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

  const where = flags.force
    ? {}
    : { bibs: { none: {} } };

  const photos = await db.photo.findMany({
    where,
    select: { id: true, r2PreviewKey: true },
    take: flags.limit,
    orderBy: { createdAt: "asc" },
  });

  console.log(`processing ${photos.length} photo(s) (limit=${flags.limit}, force=${flags.force})`);

  let detected = 0;
  let processed = 0;
  let errored = 0;

  for (const p of photos) {
    processed++;
    try {
      const bytes = await fetchPreviewBytes(p.id);
      const hits = await extractBibsFromImage(bytes);
      if (hits.length === 0) {
        console.log(`  [${processed}/${photos.length}] ${p.id} — no bibs`);
        continue;
      }
      // upsert each — skip duplicates (composite unique on (photoId, bib))
      await db.photoBib.createMany({
        data: hits.map((h) => ({
          photoId: p.id,
          bib: h.bib,
          confidence: h.confidence,
          source: "ocr-tesseract",
        })),
        skipDuplicates: true,
      });
      detected += hits.length;
      console.log(
        `  [${processed}/${photos.length}] ${p.id} — ${hits.length} bibs: ${hits.map((h) => `${h.bib}(${(h.confidence * 100).toFixed(0)}%)`).join(", ")}`
      );
    } catch (e) {
      errored++;
      console.warn(`  [${processed}/${photos.length}] ${p.id} — error:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nDone. ${detected} total bibs detected across ${processed} photo(s); ${errored} errored.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
