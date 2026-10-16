import "server-only";
import { db } from "@/lib/db";
import { TEAM } from "./team";
import { DEFAULT_ITEMS, RETIRED_KEYS, cleanValue } from "./infoSheet";

export { DEFAULT_ITEMS, MAX_VALUE, RETIRED_KEYS, cleanValue, parseKey, type DefaultItem } from "./infoSheet";

/**
 * THE INFO SHEET (owner, 2026-10-16: "make a info page where we can fill
 * out addresses for airbnb, start line, van pick up etc. if you already
 * know any of that please fill it in. I can give the rest. What other info
 * would the runners need."). One sheet per team, a line per thing a runner
 * needs for the weekend — where, when, who to call.
 *
 * The LIST is code — DEFAULT_ITEMS in infoSheet.ts, in the order the page
 * shows them, with the owner's own text (the vans, the pairs, the hotel
 * rooms, the Airbnb) and the site's prefills typed in. This file is the
 * database side: ensureInfoItems() brings the table in line with the list
 * on every read — a MISSING line is seeded with its prefill, a line the
 * owner struck off (RETIRED_KEYS) is deleted, and an existing line's label,
 * hint and place on the page follow the list — but a VALUE already in the
 * table is never touched here. The values are the owner's: typed on
 * /lasd26/info (updatedById = him), or written by
 * scripts/lasd26-info-fill.ts, which puts the list's text into every line
 * he has NOT edited by hand — his edits win over the list.
 */

export type InfoItem = {
  id: string;
  key: string;
  label: string;
  value: string;
  hint: string;
  sortOrder: number;
  updatedAt: Date;
  updatedById: string | null;
};

/**
 * Bring the team's rows in line with DEFAULT_ITEMS: delete the retired
 * keys, seed the missing ones, and move an existing row's label / hint /
 * sortOrder to what the list says (the owner, 2026-10-16: "Hotel Friday"
 * became "Hotel after the race"; "Leaving Vegas" moved up the page). A
 * value already in the table is left exactly as it is — nothing the owner
 * typed is ever replaced by a prefill.
 */
export async function ensureInfoItems(team: string = TEAM): Promise<void> {
  if (RETIRED_KEYS.length > 0) {
    await db.teamInfoItem.deleteMany({ where: { team, key: { in: [...RETIRED_KEYS] } } });
  }

  const have = await db.teamInfoItem.findMany({ where: { team }, select: { id: true, key: true, label: true, hint: true, sortOrder: true } });
  const byKey = new Map(have.map((r) => [r.key, r]));

  const missing: { key: string; label: string; value: string; hint: string; sortOrder: number }[] = [];
  const moves: { id: string; label: string; hint: string; sortOrder: number }[] = [];
  DEFAULT_ITEMS.forEach((d, sortOrder) => {
    const row = byKey.get(d.key);
    if (!row) {
      missing.push({ key: d.key, label: d.label, value: d.value, hint: d.hint, sortOrder });
    } else if (row.label !== d.label || row.hint !== d.hint || row.sortOrder !== sortOrder) {
      moves.push({ id: row.id, label: d.label, hint: d.hint, sortOrder });
    }
  });

  if (missing.length > 0) {
    await db.teamInfoItem.createMany({
      data: missing.map((d) => ({ team, ...d })),
      // Two first readers at once: the second insert of the same key is skipped, not an error.
      skipDuplicates: true,
    });
  }
  for (const m of moves) {
    await db.teamInfoItem.update({ where: { id: m.id }, data: { label: m.label, hint: m.hint, sortOrder: m.sortOrder } });
  }
}

const ITEM_SELECT = {
  id: true,
  key: true,
  label: true,
  value: true,
  hint: true,
  sortOrder: true,
  updatedAt: true,
  updatedById: true,
} as const;

/** The whole sheet, in order, brought in line with the list first. */
export async function listInfoItems(team: string = TEAM): Promise<InfoItem[]> {
  await ensureInfoItems(team);
  return db.teamInfoItem.findMany({ where: { team }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: ITEM_SELECT });
}

/**
 * Save one line's value (the owner, through PATCH /api/lasd26/info). Null
 * when the team has no line by that key — the API answers 404.
 */
export async function updateInfoValue(args: { key: string; value: string; updatedById: string | null; team?: string }): Promise<InfoItem | null> {
  const team = args.team ?? TEAM;
  const existing = await db.teamInfoItem.findUnique({ where: { team_key: { team, key: args.key } }, select: { id: true } });
  if (!existing) return null;
  return db.teamInfoItem.update({
    where: { id: existing.id },
    data: { value: cleanValue(args.value), updatedById: args.updatedById },
    select: ITEM_SELECT,
  });
}
