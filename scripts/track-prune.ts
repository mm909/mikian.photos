/**
 * Prune what an event's YAML no longer names:
 *
 *   npx dotenv -e .env.local -- tsx scripts/track-prune.ts --event lasd26 [--dry-run]
 *
 * Run AFTER `npm run track:sync`. sync.ts never deletes (handoffs hang off
 * participants, positions off devices), so a reshaped event — LASD26 went
 * from two entries A/B to one entry with two slots on 2026-10-15 — leaves
 * stray entries (with their participants) and unlinked devices behind,
 * and the public page would show them as extra teams. This removes:
 *   - entries of the event that are not in the file (cascade: their
 *     participants and handoffs; their devices are unlinked, then below);
 *   - participants of a kept entry that are not in the file;
 *   - devices of the event that are bound to nothing (and their positions).
 * Prints what it would do with --dry-run.
 */
import { db } from "@/lib/db";
import { ids, loadEventConfig } from "@/lib/tracker/config";

async function main() {
  const args = process.argv.slice(2);
  const ev = args.indexOf("--event");
  const slug = ev >= 0 ? args[ev + 1] : "";
  const dry = args.includes("--dry-run");
  if (!slug) {
    console.error("usage: track-prune.ts --event <slug> [--dry-run]");
    process.exit(1);
  }
  const cfg = loadEventConfig(slug);
  const keepEntries = new Set(cfg.entries.map((e) => ids.entry(slug, e.short_name)));
  const keepParticipants = new Set(cfg.entries.flatMap((e) => e.participants.map((p, j) => ids.participant(slug, e.short_name, j + 1, p))));

  const entries = await db.trackerEntry.findMany({ where: { eventId: slug }, select: { id: true, name: true, _count: { select: { participants: true, handoffs: true } } } });
  const strayEntries = entries.filter((e) => !keepEntries.has(e.id));
  for (const e of strayEntries) console.log(`entry ${e.id} "${e.name}" — ${e._count.participants} participants, ${e._count.handoffs} handoffs → delete`);

  const participants = await db.trackerParticipant.findMany({
    where: { entryId: { in: [...keepEntries] } },
    select: { id: true, name: true, _count: { select: { handoffs: true } } },
  });
  const strayParticipants = participants.filter((p) => !keepParticipants.has(p.id));
  for (const p of strayParticipants) console.log(`participant ${p.id} "${p.name}" — ${p._count.handoffs} handoffs → delete`);

  if (!dry) {
    if (strayEntries.length) await db.trackerEntry.deleteMany({ where: { id: { in: strayEntries.map((e) => e.id) } } });
    if (strayParticipants.length) await db.trackerParticipant.deleteMany({ where: { id: { in: strayParticipants.map((p) => p.id) } } });
  }

  const unbound = await db.trackerDevice.findMany({
    where: { eventId: slug, participantId: null, entryId: null },
    select: { id: true, externalId: true, _count: { select: { positions: true } } },
  });
  for (const d of unbound) console.log(`device ${d.externalId} — ${d._count.positions} positions → delete`);
  if (!dry && unbound.length) await db.trackerDevice.deleteMany({ where: { id: { in: unbound.map((d) => d.id) } } });

  await db.trackerSnapshot.deleteMany({ where: { eventId: slug } }).catch(() => undefined);
  console.log(dry ? "(dry run — nothing deleted)" : `pruned ${strayEntries.length} entries, ${strayParticipants.length} participants, ${unbound.length} devices; snapshot dropped`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
