import "server-only";
import { db } from "@/lib/db";
import type { EntrySlotInfo, SlotInfoByEntry } from "./ui";

/**
 * How many runners each entry has on course at once, and what the slots
 * are called (TrackerEntry.slots / slotNames, from events/<slug>.yaml).
 *
 * PAIRS (owner, 2026-10-15: "we are running two by two … it's just the
 * current runner … we just have the roster"): LASD26 is one entry with two
 * slots, A and B. The crew page needs this to show the slot picker and to
 * stamp every tap with its slot; the join page to say so to the runners.
 *
 * The event shell (lib/tracker/eventData.ts) does not carry it yet, so the
 * crew and join pages read it here with one small query and hand it to
 * their client apps as a plain map keyed by entry id. A classic relay
 * (slots 1, no names) renders exactly as before.
 *
 * A parameterised raw read of the two columns rather than a typed select:
 * the generated Prisma client in the worktree predates the columns
 * (2026-10-15) and the orchestrator regenerates after integration — this
 * compiles and runs against either. It may become
 * db.trackerEntry.findMany({ select: { id, slots, slotNames } }) any time
 * after that. If the columns are not there yet (schema not pushed) the
 * query fails, is logged, and the pages fall back to a classic relay —
 * the crew page must never 500 at an exchange.
 */

export type { EntrySlotInfo, SlotInfoByEntry };

type SlotRow = { id: string; slots: number | null; slotNames: string[] | null };

/** Entry id → slot info. The shape is JSON-safe: pages pass it straight to client components. */
export async function loadSlotInfo(slug: string): Promise<SlotInfoByEntry> {
  let rows: SlotRow[];
  try {
    rows = await db.$queryRaw<SlotRow[]>`SELECT "id", "slots", "slotNames" FROM "TrackerEntry" WHERE "eventId" = ${slug}`;
  } catch (err) {
    console.error(`track slots ${slug}: could not read TrackerEntry.slots (schema pushed?)`, err);
    return {};
  }
  const out: SlotInfoByEntry = {};
  for (const r of rows) {
    const n = typeof r.slots === "number" && Number.isFinite(r.slots) ? Math.floor(r.slots) : 1;
    out[r.id] = {
      slots: Math.max(1, n),
      slotNames: Array.isArray(r.slotNames) ? r.slotNames.map((s) => String(s)) : [],
    };
  }
  return out;
}
