/**
 * Seed the database for v0.2 launch.
 *
 * Run with:  npx prisma db seed
 * (Configured in package.json under "prisma.seed".)
 *
 * What lands:
 *   - One Event: Lighthouse Half Marathon 2026
 *   - Three test Photographer rows ("Mara K.", "Jules C.", "Devon L.") that
 *     match the demo photographer names already used elsewhere. These rows
 *     have no googleSubject — they'll be claimed by Google sign-in
 *     (via signIn.callbacks in src/lib/auth.ts) when their owners actually
 *     log in for the first time. Until then they're useful as primary keys
 *     for any photos that get hand-uploaded via a seed script.
 *   - No Photos. Photos arrive via /api/photographer/photos.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const event = await db.event.upsert({
    where: { id: "lighthouse-half-2026" },
    update: {},
    create: {
      id: "lighthouse-half-2026",
      name: "Lighthouse Half Marathon",
      date: new Date("2026-05-24T14:00:00Z"),
      city: "Long Beach, CA",
      org: "Elite Sports California",
    },
  });
  console.log(`✓ event: ${event.name} (${event.id})`);

  const pgs = [
    { email: "mara@mikian.photos",  name: "Mara K.",  primaryEventId: event.id, isAdmin: false },
    { email: "jules@mikian.photos", name: "Jules C.", primaryEventId: event.id, isAdmin: false },
    { email: "devon@mikian.photos", name: "Devon L.", primaryEventId: event.id, isAdmin: false },
  ];
  for (const p of pgs) {
    const row = await db.photographer.upsert({
      where: { email: p.email },
      update: p,
      create: p,
    });
    console.log(`✓ photographer: ${row.name} <${row.email}>`);
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
