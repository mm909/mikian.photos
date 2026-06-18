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

  // Test photographers — get the photographer role pre-seeded so they
  // can upload immediately on first Google sign-in. Existing rows will
  // also have their roles updated by the upsert (idempotent).
  const photographerRoles = ["user", "photographer"];
  const pgs = [
    { email: "mara@mikian.photos",  name: "Mara K.",  primaryEventId: event.id, roles: photographerRoles, isAdmin: false },
    { email: "jules@mikian.photos", name: "Jules C.", primaryEventId: event.id, roles: photographerRoles, isAdmin: false },
    { email: "devon@mikian.photos", name: "Devon L.", primaryEventId: event.id, roles: photographerRoles, isAdmin: false },
  ];
  const memberIds: string[] = [];
  for (const p of pgs) {
    const row = await db.photographer.upsert({
      where: { email: p.email },
      update: p,
      create: p,
    });
    memberIds.push(row.id);
    console.log(`✓ photographer: ${row.name} <${row.email}> [${row.roles.join(", ")}]`);
  }

  // Owner row — pre-seed so Mikian gets the owner role even before first
  // Google sign-in. signIn() in src/lib/auth.ts will link this row to the
  // Google subject when mikian.photos@gmail.com logs in for the first time.
  const ownerEmail = (process.env.OWNER_EMAIL || "mikian.photos@gmail.com").toLowerCase();
  const ownerRoles = ["user", "photographer", "owner"];
  const owner = await db.photographer.upsert({
    where: { email: ownerEmail },
    update: { roles: ownerRoles, isAdmin: true },
    create: {
      email: ownerEmail,
      name: "Mikian Musser",
      primaryEventId: event.id,
      roles: ownerRoles,
      isAdmin: true,
    },
  });
  console.log(`✓ owner: ${owner.name} <${owner.email}> [${owner.roles.join(", ")}]`);

  // v2 multi-event: grant each seeded photographer (+ owner) upload access to
  // the event via EventPhotographer. Idempotent on the [eventId, photographerId]
  // unique. Without these rows, enabling upload enforcement would lock the
  // existing photographers out of the live event.
  memberIds.push(owner.id);
  for (const photographerId of memberIds) {
    await db.eventPhotographer.upsert({
      where: { eventId_photographerId: { eventId: event.id, photographerId } },
      update: {},
      create: { eventId: event.id, photographerId, addedBy: "seed" },
    });
  }
  console.log(`✓ event access: ${memberIds.length} photographers → ${event.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
