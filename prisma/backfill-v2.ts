/**
 * v2 multi-event backfill — production-safe.
 *
 * Derives EventPhotographer membership rows from existing Photo rows so that
 * every photographer who has already uploaded into an event keeps upload access
 * once per-event upload enforcement turns on. Unlike `prisma db seed`, this
 * creates NO synthetic photographer rows — it only links photographers that
 * already exist (via their uploaded photos) to the events they uploaded to.
 *
 * Idempotent (upsert on the [eventId, photographerId] unique). Safe to re-run.
 *
 * Run with:  npx dotenv -e .env.local -- tsx prisma/backfill-v2.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const events = await db.event.findMany({ select: { id: true, name: true } });
  let total = 0;
  for (const ev of events) {
    const rows = await db.photo.findMany({
      where: { eventId: ev.id },
      select: { photographerId: true },
      distinct: ["photographerId"],
    });
    for (const { photographerId } of rows) {
      await db.eventPhotographer.upsert({
        where: { eventId_photographerId: { eventId: ev.id, photographerId } },
        update: {},
        create: { eventId: ev.id, photographerId, addedBy: "backfill-v2" },
      });
      total++;
    }
    console.log(`✓ ${ev.name} (${ev.id}): ${rows.length} photographer membership(s)`);
  }
  console.log(`Done — ${total} membership row(s) ensured across ${events.length} event(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
