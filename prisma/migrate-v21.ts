/**
 * v2.1 data migration — production-safe + idempotent.
 *
 *   1. Roles: in every Photographer.roles array, rename "runner" → "user" and
 *      drop "race_director" (folds into platform "owner", which Mikian already
 *      holds). Empty → ["user"]. Re-sync the legacy isAdmin mirror.
 *   2. Event ownership: set ownerId on every event that lacks one to the
 *      platform owner (the owner-role Photographer, preferring OWNER_EMAIL).
 *
 * Run with:  npx dotenv -e .env.local -- tsx prisma/migrate-v21.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "mikian.photos@gmail.com").toLowerCase();

function mapRoles(roles: string[]): string[] {
  const out = new Set<string>();
  for (const r of roles) {
    if (r === "race_director") continue;
    out.add(r === "runner" ? "user" : r);
  }
  if (out.size === 0) out.add("user");
  return Array.from(out);
}

async function main() {
  // 1. Roles
  const people = await db.photographer.findMany({ select: { id: true, roles: true } });
  let roleUpdates = 0;
  for (const p of people) {
    const next = mapRoles(p.roles ?? []);
    await db.photographer.update({
      where: { id: p.id },
      data: { roles: next, isAdmin: next.includes("owner") },
    });
    roleUpdates++;
  }

  // 2. Event ownership — default to the platform owner.
  const ownerByEmail = await db.photographer
    .findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } })
    .catch(() => null);
  const ownerByRole = await db.photographer.findFirst({
    where: { roles: { has: "owner" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const ownerId = ownerByEmail?.id ?? ownerByRole?.id ?? null;

  let eventUpdates = 0;
  if (ownerId) {
    const r = await db.event.updateMany({ where: { ownerId: null }, data: { ownerId } });
    eventUpdates = r.count;
  } else {
    console.warn("No owner-role photographer found — events left without ownerId.");
  }

  console.log(
    `roles synced on ${roleUpdates} user(s); ownerId set on ${eventUpdates} event(s) (owner=${ownerId}).`
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
