/* TIE A SAVED ERG SESSION TO THE ROW IT WAS (2026-11-22; owner: "the
 * September 23rd one ... 5,000 meters, 19:24, does have a real session
 * attached to it. So attach it").
 *
 *   npx dotenv -e .env.local -- tsx scripts/erg-link.ts <rower number>            list
 *   npx dotenv -e .env.local -- tsx scripts/erg-link.ts <rower number> <telemetry id> <entry id>   tie
 *
 * Erg sessions saved before the phone app existed were not tied to a logged
 * row (RowTelemetry.entryId is null), so the row's page has no read to
 * show. LIST prints a rower's untied sessions and, for each, the rows of
 * theirs with the same meters within a day of it. TIE sets entryId on ONE
 * session, and only when the session and the row belong to the same rower
 * and the row has no session yet. It changes nothing else and deletes
 * nothing. */
import { PrismaClient } from "@prisma/client";
import { CHALLENGE_LIVE } from "../src/lib/row100k";

const db = new PrismaClient();
const [numRaw, telemetryId, entryId] = process.argv.slice(2);

async function main() {
  const num = Number(numRaw);
  const p = await db.rowParticipant.findFirst({ where: { challenge: CHALLENGE_LIVE, rowerNumber: num }, select: { id: true, displayName: true } });
  if (!p) throw new Error(`no rower ${numRaw}`);
  if (telemetryId && entryId) {
    const t = await db.rowTelemetry.findFirst({ where: { id: telemetryId, participantId: p.id }, select: { id: true, entryId: true, meters: true } });
    const e = await db.rowEntry.findFirst({ where: { id: entryId, participantId: p.id }, select: { id: true, meters: true, day: true } });
    if (!t || !e) throw new Error("that session or that row is not this rower's");
    if (t.entryId) throw new Error(`that session is already tied to ${t.entryId}`);
    if (await db.rowTelemetry.findFirst({ where: { entryId: e.id }, select: { id: true } })) throw new Error("that row already has a session");
    await db.rowTelemetry.update({ where: { id: t.id }, data: { entryId: e.id } });
    console.log(`tied session ${t.id} (${t.meters} m) to row ${e.id} (${e.day}, ${e.meters} m)`);
    return;
  }
  const sessions = await db.rowTelemetry.findMany({ where: { participantId: p.id, entryId: null }, orderBy: { startedAt: "asc" }, select: { id: true, startedAt: true, meters: true, tenths: true, simulated: true, device: true } });
  console.log(`${p.displayName}: ${sessions.length} untied sessions`);
  for (const s of sessions) {
    const day = new Date(s.startedAt.getTime() - 7 * 3600_000).toISOString().slice(0, 10);
    const near = [-1, 0, 1].map((d) => new Date(Date.parse(`${day}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10));
    const rows = await db.rowEntry.findMany({ where: { participantId: p.id, day: { in: near }, meters: { gte: s.meters - 60, lte: s.meters + 60 } }, select: { id: true, day: true, meters: true, seconds: true, title: true } });
    console.log(`\n${s.id}  ${day}  ${s.meters} m  ${(s.tenths / 10).toFixed(1)} s  ${s.simulated ? "SIMULATED" : s.device}`);
    for (const r of rows) console.log(`   row ${r.id}  ${r.day}  ${r.meters} m  ${r.seconds} s  "${r.title}"`);
  }
}

main()
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  })
  .finally(() => db.$disconnect());
