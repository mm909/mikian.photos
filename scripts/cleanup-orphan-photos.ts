/**
 * Delete Photo rows whose preview no longer exists in R2.
 *
 * Use case: you manually emptied the bucket but kept the DB → every Photo row
 * is now orphaned and breaks the runner-facing browse + the admin Library
 * (rerun-ocr 400s, previews 404, etc.). This walks the DB, HEADs the preview
 * key for each row, and deletes orphans. PhotoBib rows cascade via the FK.
 *
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/cleanup-orphan-photos.ts
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/cleanup-orphan-photos.ts --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2, r2Bucket, r2Configured, r2Keys } from "../src/lib/r2";

const db = new PrismaClient();

async function headExists(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!r2Configured()) {
    console.error("R2 not configured");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  const photos = await db.photo.findMany({
    select: { id: true, r2PreviewKey: true, r2OriginalKey: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`scanning ${photos.length} Photo rows (dryRun=${dryRun})`);

  const orphanIds: string[] = [];
  for (const p of photos) {
    const previewKey = r2Keys.preview(p.id);
    const present = await headExists(previewKey);
    if (!present) {
      orphanIds.push(p.id);
      console.log(`  ✗ ${p.id}  (preview missing)`);
    } else {
      console.log(`  ✓ ${p.id}  (preview present)`);
    }
  }

  console.log(`\n${orphanIds.length} orphan(s) of ${photos.length} total`);
  if (orphanIds.length === 0) return;

  if (dryRun) {
    console.log("\n(dry run — not deleting)");
    return;
  }

  // PhotoBib has onDelete: Cascade on photoId, so it goes with the row.
  const result = await db.photo.deleteMany({ where: { id: { in: orphanIds } } });
  console.log(`\ndeleted ${result.count} orphan Photo row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
