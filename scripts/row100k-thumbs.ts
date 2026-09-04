/**
 * Backfill the grid-sized thumbnails for row100k photos already in R2.
 *
 *   npm run row100k:thumbs              # make every missing thumb
 *   DRY=1 npm run row100k:thumbs        # list what would be made, write nothing
 *
 * (Use the DRY env var, not a --dry flag: npm on Windows swallows flags
 * after `--` before they reach the script. The run prints its mode on the
 * first line either way, so there is never a doubt about which one ran.)
 *
 * WHY: the feed and the log show photos as 64px squares, but every photo
 * uploaded before the thumbnail convention landed only exists at full size
 * (~350 KB each), so a page of 60 rows pulled tens of megabytes to paint
 * postage stamps. Uploads have written a `.thumb.jpg` beside each new photo
 * since then; this script does the same for the back catalogue, so
 * resolvePhotoMedia can start handing thumbs to every row.
 *
 * The naming convention is thumbKey() in src/app/row100k/photoUrls.ts —
 * "a/b/uuid.jpg" becomes "a/b/uuid.thumb.jpg". Thumbs are always JPEG
 * regardless of the source format, matching what the browser uploader writes.
 *
 * Safe to rerun: it lists the bucket first and only fills in what is missing,
 * so a half-finished run just picks up where it stopped. It never deletes,
 * never overwrites an existing thumb, and never touches the main photos.
 */
import sharp from "sharp";
import { r2Configured, r2GetStream, r2List, r2Put } from "../src/lib/r2";
import { thumbKey } from "../src/app/row100k/photoUrls";
import { CHALLENGE_LIVE } from "../src/lib/row100k";

/* Matches the browser uploader: 320px on the long edge at q70 — sharp enough
 * for a 64px square on a 3x phone screen, ~15 KB on the wire. */
const EDGE = 320;
const QUALITY = 70;
/* Gentle on R2 and on a laptop: six images in flight at a time. */
const CONCURRENCY = 6;

const THUMB_RE = /\.thumb\.[a-z0-9]+$/i;
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

const dry = process.env.DRY === "1" || process.argv.includes("--dry");

async function toBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function main() {
  if (!r2Configured()) {
    console.error("R2 is not configured — check R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.");
    process.exit(1);
  }

  const prefix = `row100k/${CHALLENGE_LIVE}/`;
  console.log(`\n${dry ? "DRY RUN — nothing will be written." : "WRITING missing thumbs."}`);
  console.log(`Listing ${prefix} ...`);
  const objects = await r2List(prefix);

  const thumbs = new Set(objects.filter((o) => THUMB_RE.test(o.key)).map((o) => o.key));
  const mains = objects.filter((o) => !THUMB_RE.test(o.key) && IMAGE_RE.test(o.key));
  const todo = mains.filter((o) => !thumbs.has(thumbKey(o.key)));

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  console.log(
    `  ${mains.length} photos, ${thumbs.size} thumbs already there, ${todo.length} to make` +
      ` (${mb(todo.reduce((t, o) => t + o.size, 0))} MB to read)\n`,
  );
  if (todo.length === 0) {
    console.log("Nothing to do.\n");
    return;
  }
  if (dry) {
    for (const o of todo.slice(0, 10)) console.log(`  would make ${thumbKey(o.key)}`);
    if (todo.length > 10) console.log(`  ... and ${todo.length - 10} more`);
    console.log("\nDry run — nothing written.\n");
    return;
  }

  let done = 0;
  let failed = 0;
  let bytesOut = 0;
  const queue = [...todo];

  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      try {
        const { body } = await r2GetStream(item.key);
        const source = await toBuffer(body);
        const thumb = await sharp(source)
          .rotate() // honour EXIF orientation before resizing
          .resize(EDGE, EDGE, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: QUALITY })
          .toBuffer();
        await r2Put(thumbKey(item.key), thumb, "image/jpeg");
        bytesOut += thumb.length;
        done += 1;
      } catch (err) {
        failed += 1;
        console.error(`  ✖ ${item.key}: ${(err as Error).message}`);
      }
      const n = done + failed;
      if (n % 25 === 0 || n === todo.length) {
        console.log(`  ${n} / ${todo.length} (${done} written, ${failed} failed)`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const avg = done > 0 ? Math.round(bytesOut / done / 1024) : 0;
  console.log(`\nDone: ${done} thumbs written (~${avg} KB each), ${failed} failed.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
