/**
 * Fill the LASD26 info sheet (/lasd26/info) with the owner's text — the
 * notes he sent from his phone on 2026-10-16: the vans, the running pairs
 * and the rotation, Thursday's two vans out of Vegas and the two flights,
 * the hotel rooms with their codes, the Airbnb and its house rules.
 *
 *   npx dotenv -e .env.local -- tsx scripts/lasd26-info-fill.ts [--force]
 *
 * The text lives in ONE place, src/lib/lasd26/infoSheet.ts (DEFAULT_ITEMS;
 * no "server-only" there, so this plain Node process can read it — the
 * server lib info.ts refuses to load here). What this does, in order:
 *
 *   1. deletes the lines the owner struck off (RETIRED_KEYS — "no Group
 *      chat, no Food plan, no Phone tracking, no What to bring, no Parking
 *      at the start, no Exchange points, no Money"); they were the site's
 *      prefills, nothing of his;
 *   2. writes every line of the list into the table — a missing line is
 *      made, an existing one gets the list's text — EXCEPT a line the owner
 *      has edited by hand on /lasd26/info since (updatedById is his): that
 *      one is kept, his edit wins over the list (review, 2026-10-16: an
 *      earlier version overwrote it). `--force` writes those too.
 *   3. every existing row's label, hint and place on the page follow the
 *      list ("Hotel Friday" → "Hotel after the race", same key).
 *
 * Prints what it did per key and, at the end, what it wrote and what it
 * kept. Idempotent: a rerun writes the same text again and says so.
 *
 * Team slug is spelled out here rather than imported from
 * src/lib/lasd26/team.ts, which is "server-only" (the seed script does the
 * same).
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ITEMS, RETIRED_KEYS, cleanValue } from "../src/lib/lasd26/infoSheet";

const db = new PrismaClient();
const TEAM = "lasd26";

async function main() {
  console.log(`LASD26 info fill — team ${TEAM}, ${DEFAULT_ITEMS.length} lines on the list, ${RETIRED_KEYS.length} retired`);

  // 1. The struck-off lines go.
  const gone = await db.teamInfoItem.findMany({ where: { team: TEAM, key: { in: [...RETIRED_KEYS] } }, select: { key: true } });
  if (gone.length > 0) {
    await db.teamInfoItem.deleteMany({ where: { team: TEAM, key: { in: gone.map((r) => r.key) } } });
    for (const r of gone) console.log(`  drop  ${r.key}`);
  } else {
    console.log("  drop  (none of the retired keys were in the table)");
  }

  // 2 + 3. Every line of the list, in page order.
  const force = process.argv.includes("--force");
  const wrote: string[] = [];
  const kept: string[] = [];
  for (const [sortOrder, item] of DEFAULT_ITEMS.entries()) {
    const value = cleanValue(item.value);
    const existing = await db.teamInfoItem.findUnique({
      where: { team_key: { team: TEAM, key: item.key } },
      select: { id: true, label: true, value: true, updatedById: true, updatedAt: true },
    });
    if (!existing) {
      await db.teamInfoItem.create({
        data: { team: TEAM, key: item.key, label: item.label, value, hint: item.hint, sortOrder, updatedById: null },
      });
      wrote.push(item.key);
      console.log(`  seed  ${item.key.padEnd(16)} "${item.label}"${value ? `  (${value.length} chars)` : "  (empty)"}`);
      continue;
    }
    const relabel = existing.label !== item.label ? `  label "${existing.label}" → "${item.label}"` : "";
    const byHand = existing.updatedById !== null;
    if (byHand && !force) {
      // His edit on the page wins over the list; only the label / hint / place follow it.
      await db.teamInfoItem.update({
        where: { id: existing.id },
        data: { label: item.label, hint: item.hint, sortOrder },
      });
      kept.push(item.key);
      console.log(`  keep  ${item.key.padEnd(16)} edited by hand ${existing.updatedAt.toISOString().slice(0, 10)} — not touched (--force overwrites)${relabel}`);
      continue;
    }
    const same = existing.value === value;
    await db.teamInfoItem.update({
      where: { id: existing.id },
      data: { label: item.label, hint: item.hint, sortOrder, value, updatedById: null },
    });
    wrote.push(item.key);
    console.log(`  ${same ? "same " : "write"} ${item.key.padEnd(16)} ${value.length} chars${byHand ? " (forced over a hand edit)" : ""}${relabel}`);
  }

  const rows = await db.teamInfoItem.findMany({ where: { team: TEAM }, orderBy: { sortOrder: "asc" }, select: { key: true, value: true } });
  const filled = rows.filter((r) => r.value.trim() !== "").length;
  console.log(`done — wrote ${wrote.length} lines: ${wrote.join(", ")}`);
  if (kept.length > 0) console.log(`      kept ${kept.length} edited by hand: ${kept.join(", ")}`);
  console.log(`      sheet: ${rows.map((r) => r.key).join(" · ")} (${filled} of ${rows.length} filled in)`);
}

main()
  .catch((err) => {
    console.error("fill failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
