/* REAL PHOTOS ON THE SAMPLE ROWS, in the LOCAL sandbox database only
 * (owner, 2026-11-22, of a sandbox feed of grey squares: "give me the
 * photos in these sample images ... how am I supposed to envision what
 * it's going to be like").
 *
 *   node scripts/dev-app-db.mjs --photos        (the local database up)
 *
 * It READS the live database and WRITES the local one, and nothing the
 * other way: from the real board, the photo pairs of the newest rows by
 * rowers whose accounts are public (the same photos the site already
 * shows to anybody); into the sandbox, those pairs onto its newest rows,
 * in place of the flat colour squares the sample seed leaves. Only the
 * addresses of the photos are copied. The sandbox server then shows them
 * off the public photo address in .env.local, as the site does.
 *
 * It refuses to run unless SANDBOX_DB_URL is a database on localhost. */
import { PrismaClient } from "@prisma/client";
import { CHALLENGE_DEMO } from "../src/lib/row100k";

const sandboxUrl = process.env.SANDBOX_DB_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):/.test(sandboxUrl)) {
  console.error("dev-app-photos-seed: SANDBOX_DB_URL is not a local database. Stopping.");
  process.exit(1);
}
if (/@(localhost|127\.0\.0\.1):/.test(process.env.POSTGRES_URL ?? "")) {
  console.error("dev-app-photos-seed: POSTGRES_URL is the local database; the photos are read from the live one. Stopping.");
  process.exit(1);
}

const REAL = CHALLENGE_DEMO.replace(/-demo$/, "");
const live = new PrismaClient();
const sandbox = new PrismaClient({ datasources: { db: { url: sandboxUrl } } });
const HOW_MANY = 240;

async function main() {
  const hidden = new Set((await live.rowSocialSetting.findMany({ where: { isPrivate: true }, select: { participantId: true } }).catch(() => [])).map((s) => s.participantId));
  const rows = await live.rowEntry.findMany({ where: { challenge: REAL, NOT: { photos: { isEmpty: true } } }, orderBy: { createdAt: "desc" }, take: 600, select: { participantId: true, photos: true } });
  const pairs = rows.filter((r) => !hidden.has(r.participantId) && r.photos.length >= 2 && r.photos.every((k) => !k.startsWith("demo:"))).map((r) => r.photos.slice(0, 2));
  if (!pairs.length) throw new Error("No photo pairs were read from the live board.");

  const mine = await sandbox.rowEntry.findMany({ where: { challenge: CHALLENGE_DEMO }, orderBy: { createdAt: "desc" }, take: HOW_MANY, select: { id: true } });
  let n = 0;
  for (const [i, e] of mine.entries()) {
    await sandbox.rowEntry.update({ where: { id: e.id }, data: { photos: pairs[i % pairs.length] } });
    n++;
  }
  console.log(`photo seed: ${n} sample rows now carry real photos (${pairs.length} pairs read).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await live.$disconnect();
    await sandbox.$disconnect();
  });
