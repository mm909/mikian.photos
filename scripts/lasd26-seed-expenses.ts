/**
 * Seed the LASD26 expenses from the cost sheet the owner pasted on
 * 2026-10-15, and make sure the split is 18 ways.
 *
 *   npx dotenv -e .env.local -- tsx scripts/lasd26-seed-expenses.ts
 *
 * Idempotent: a line whose TITLE already exists on the team (deleted or
 * not — if the owner removed "Gas", rerunning must not bring it back) is
 * skipped and said so. The seeded lines have no addedBy, so only the owner
 * can edit them on the page. TeamSettings is created with splitCount 18
 * when missing and left alone when it exists (the owner may have changed
 * it in the meantime); the script prints what it found.
 *
 * Team slug is spelled out here rather than imported from
 * src/lib/lasd26/team.ts, which is "server-only" and refuses to load in a
 * plain Node script.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const TEAM = "lasd26";
const SPLIT = 18;

type Line = { title: string; amountCents: number; note: string; estimate: boolean };

/* The sheet: $2,000 + $1,415 + $1,112 + $505 + $550 + $600 + $500 = $6,682;
 * 18 people → $371.25 each. Gas and food are round numbers nobody has a
 * receipt for yet. */
const LINES: Line[] = [
  { title: "Race entry", amountCents: 200_000, note: "2 teams × $1,000", estimate: false },
  { title: "Hotel Friday", amountCents: 141_500, note: "5 rooms × $283, 1 night", estimate: false },
  { title: "Airbnb", amountCents: 111_200, note: "", estimate: false },
  { title: "Sprinter van 1", amountCents: 50_500, note: "Van 1", estimate: false },
  { title: "Sprinter van 2", amountCents: 55_000, note: "Van 2", estimate: false },
  { title: "Gas", amountCents: 60_000, note: "Estimate — vans, there and back", estimate: true },
  { title: "Race day food", amountCents: 50_000, note: "Estimate", estimate: true },
];

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const expected = LINES.reduce((s, l) => s + l.amountCents, 0);
  console.log(`LASD26 expenses seed — ${LINES.length} lines, ${usd(expected)} on the sheet, ${SPLIT} ways = ${usd(Math.ceil(expected / SPLIT))}`);

  let added = 0;
  for (const line of LINES) {
    const exists = await db.teamExpense.findFirst({ where: { team: TEAM, title: line.title }, select: { id: true, deletedAt: true } });
    if (exists) {
      console.log(`  skip  ${line.title.padEnd(16)} ${usd(line.amountCents).padStart(10)}  (exists${exists.deletedAt ? ", deleted" : ""})`);
      continue;
    }
    await db.teamExpense.create({
      data: { team: TEAM, title: line.title, amountCents: line.amountCents, note: line.note, estimate: line.estimate, addedById: null },
    });
    added++;
    console.log(`  add   ${line.title.padEnd(16)} ${usd(line.amountCents).padStart(10)}${line.estimate ? "  (estimate)" : ""}`);
  }

  const settings = await db.teamSettings.upsert({
    where: { team: TEAM },
    create: { team: TEAM, splitCount: SPLIT, settleOpen: false },
    update: {},
    select: { splitCount: true, settleOpen: true },
  });
  if (settings.splitCount !== SPLIT) {
    console.log(`  settings: splitCount is ${settings.splitCount} (left as is; the sheet says ${SPLIT})`);
  } else {
    console.log(`  settings: splitCount ${settings.splitCount}, settleOpen ${settings.settleOpen}`);
  }

  const live = await db.teamExpense.findMany({ where: { team: TEAM, deletedAt: null }, select: { amountCents: true } });
  const total = live.reduce((s: number, e: { amountCents: number }) => s + e.amountCents, 0);
  console.log(`done — ${added} added, ${live.length} live lines, ${usd(total)} total, ${usd(Math.ceil(total / settings.splitCount))} per person`);
}

main()
  .catch((err) => {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
