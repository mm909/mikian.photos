/**
 * Diagnose a single photo end-to-end:
 *  - DB row state (r2 keys, bibs, hidden)
 *  - whether the original/preview actually exist in R2
 *
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/diag-photo.ts <photoId>
 */
import { PrismaClient } from "@prisma/client";
import { r2, r2Bucket, r2Configured, r2Keys } from "../src/lib/r2";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

const db = new PrismaClient();

async function exists(key: string): Promise<{ exists: boolean; size?: number; err?: string }> {
  try {
    const r = await r2().send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }));
    return { exists: true, size: r.ContentLength };
  } catch (e) {
    return { exists: false, err: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: ... diag-photo.ts <photoId>");
    process.exit(1);
  }
  if (!r2Configured()) {
    console.error("R2 not configured");
    process.exit(1);
  }

  const photo = await db.photo.findUnique({
    where: { id },
    include: { bibs: true, photographer: { select: { id: true, email: true } } },
  });
  if (!photo) {
    console.log(`no photo with id ${id}`);
    return;
  }
  console.log(`--- DB row ---`);
  console.log(`  id:              ${photo.id}`);
  console.log(`  eventId:         ${photo.eventId}`);
  console.log(`  photographer:    ${photo.photographer.email}`);
  console.log(`  createdAt:       ${photo.createdAt.toISOString()}`);
  console.log(`  takenAt:         ${photo.takenAt?.toISOString() ?? "—"}`);
  console.log(`  gps:             ${photo.gpsLat != null ? `${photo.gpsLat}, ${photo.gpsLng}` : "—"}`);
  console.log(`  hidden:          ${photo.hidden}`);
  console.log(`  r2OriginalKey:   ${photo.r2OriginalKey}`);
  console.log(`  r2PreviewKey:    ${photo.r2PreviewKey}`);
  console.log(`  bibs:            ${photo.bibs.length === 0 ? "none" : photo.bibs.map((b) => `#${b.bib} (${b.source}, conf=${(b.confidence * 100).toFixed(1)}%)`).join(", ")}`);

  console.log(`\n--- R2 ---`);
  const expectedOriginal = r2Keys.original(photo.id);
  const expectedPreview = r2Keys.preview(photo.id);
  for (const [label, key] of [
    ["expected original", expectedOriginal],
    ["row r2OriginalKey", photo.r2OriginalKey],
    ["expected preview ", expectedPreview],
    ["row r2PreviewKey ", photo.r2PreviewKey],
  ]) {
    const r = await exists(key);
    console.log(`  ${label} (${key}): ${r.exists ? `✓ ${r.size}b` : `✗ ${r.err}`}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
