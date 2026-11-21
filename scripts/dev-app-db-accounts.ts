/* What the LOCAL sandbox database needs beside the sample board (run by
 * scripts/dev-app-db.mjs --seed, never against anything else: it refuses a
 * database that is not on localhost).
 *
 *   tsx scripts/dev-app-db-accounts.ts accounts a@x b@y   before the seed
 *   tsx scripts/dev-app-db-accounts.ts optin               after it
 *
 * ACCOUNTS. The sample rowers have no accounts behind them, and the
 * sandbox's sign-in takes "an existing account's email". So: the owner's
 * account, as an admin, and plain ones to follow, block and be passed by.
 * The seed script then hands each a rower on the board (--me).
 *
 * OPTIN. The board lists the rowers who opted in to the month, and the seed
 * opts nobody in, so a fresh board is empty. Four in five of the rowers
 * with metres this month are opted in, the accounts above among them. */
import { PrismaClient } from "@prisma/client";
import { CHALLENGE_DEMO } from "../src/lib/row100k";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error("dev-app-db-accounts: POSTGRES_URL is not a local database. Stopping.");
  process.exit(1);
}

const db = new PrismaClient();
const [what, ...rest] = process.argv.slice(2);

async function accounts(emails: string[]) {
  for (const [i, email] of emails.entries()) {
    const owner = i === 0;
    const name = owner ? "Mikian Musser" : `Sandbox Rower ${i}`;
    await db.photographer.upsert({
      where: { email },
      create: { email, name, roles: owner ? ["user", "owner"] : ["user"], isAdmin: owner },
      update: {},
    });
    console.log(`account: ${email}${owner ? " (admin)" : ""}`);
  }
}

async function optin() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rowed = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE_DEMO, day: { startsWith: month } } });
  const ids = new Set(rowed.map((r) => r.participantId));
  const real = new Set((await db.photographer.findMany({ select: { id: true } })).map((p) => p.id));
  const rowers = await db.rowParticipant.findMany({ where: { challenge: CHALLENGE_DEMO }, select: { id: true, rowerNumber: true, userId: true } });
  const inn = rowers.filter((r) => ids.has(r.id) && (real.has(r.userId) || r.rowerNumber % 5 !== 0));
  await db.rowMonthOptIn.deleteMany({ where: { challenge: CHALLENGE_DEMO, month } });
  await db.rowMonthOptIn.createMany({ data: inn.map((r) => ({ challenge: CHALLENGE_DEMO, participantId: r.id, rowerNumber: r.rowerNumber, month })) });
  console.log(`opted in to ${month}: ${inn.length} of ${rowers.length} rowers`);
}

(what === "optin" ? optin() : accounts(what === "accounts" ? rest : [what, ...rest].filter(Boolean))).finally(() => db.$disconnect());
