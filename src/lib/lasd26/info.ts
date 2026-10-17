import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TEAM } from "./team";
import { DEFAULT_ITEMS, NOTE_PREFIX, RETIRED_KEYS, cleanLabel, cleanValue, isNoteKey, slugLabel } from "./infoSheet";

export {
  DEFAULT_ITEMS,
  MAX_LABEL,
  MAX_VALUE,
  NOTE_PREFIX,
  RETIRED_KEYS,
  cleanLabel,
  cleanValue,
  isNoteKey,
  parseKey,
  slugLabel,
  type DefaultItem,
} from "./infoSheet";

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
 * on every read — a line with NO row at all is seeded with its prefill, a
 * line the owner struck off (RETIRED_KEYS) is deleted, and a live built-in
 * line's label, hint and place on the page follow the list — but a VALUE
 * already in the table is never touched here. The values are the owner's:
 * typed on /lasd26/info (updatedById = him), or written by
 * scripts/lasd26-info-fill.ts, which puts the list's text into every line
 * he has NOT edited by hand — his edits win over the list.
 *
 * NOTES AND REMOVAL (owner, 2026-10-16, night: "Allow me to add / remove
 * notes on the info page."). addInfoNote() makes a line of his own — key
 * NOTE_PREFIX + slugLabel(label), "-2" on a collision, sorted after every
 * built-in line, newest last; its label is his to change (updateInfoValue
 * takes one for a note only). removeInfoItem() REMOVES a line, built-in or
 * note alike, by setting removedAt — a soft delete, so the row still
 * stands: ensureInfoItems() sees it and never seeds that built-in again,
 * and the key stays taken. Everything that reads the sheet reads
 * removedAt null only.
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
 * Notes sort from here, after the built-in lines (which count up from 0 in
 * list order and will never reach it).
 */
export const NOTE_SORT_BASE = 1000;

/**
 * Bring the team's rows in line with DEFAULT_ITEMS: delete the retired
 * keys, seed the lines with no row, and move a LIVE built-in row's label /
 * hint / sortOrder to what the list says (the owner, 2026-10-16: "Hotel
 * Friday" became "Hotel after the race"; "Leaving Vegas" moved up the
 * page). A value already in the table is left exactly as it is — nothing
 * the owner typed is ever replaced by a prefill. A row he REMOVED
 * (removedAt set) counts as present — it is not seeded again and not
 * moved — and a note (key "n-…") is never on the list, so never touched.
 */
export async function ensureInfoItems(team: string = TEAM): Promise<void> {
  if (RETIRED_KEYS.length > 0) {
    await db.teamInfoItem.deleteMany({ where: { team, key: { in: [...RETIRED_KEYS] } } });
  }

  const have = await db.teamInfoItem.findMany({
    where: { team },
    select: { id: true, key: true, label: true, hint: true, sortOrder: true, removedAt: true },
  });
  const byKey = new Map(have.map((r) => [r.key, r]));

  const missing: { key: string; label: string; value: string; hint: string; sortOrder: number }[] = [];
  const moves: { id: string; label: string; hint: string; sortOrder: number }[] = [];
  DEFAULT_ITEMS.forEach((d, sortOrder) => {
    const row = byKey.get(d.key);
    if (!row) {
      missing.push({ key: d.key, label: d.label, value: d.value, hint: d.hint, sortOrder });
    } else if (row.removedAt === null && (row.label !== d.label || row.hint !== d.hint || row.sortOrder !== sortOrder)) {
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

/** The whole sheet — the live lines, in order — brought in line with the list first. */
export async function listInfoItems(team: string = TEAM): Promise<InfoItem[]> {
  await ensureInfoItems(team);
  return db.teamInfoItem.findMany({
    where: { team, removedAt: null },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: ITEM_SELECT,
  });
}

/**
 * Save one line's value (the owner, through PATCH /api/lasd26/info), and
 * for a NOTE its label too — a built-in line's label is the list's, and
 * the API answers 400 before this is reached; a label that is not a clean
 * one (cleanLabel null) is ignored here rather than saved blank. Null when
 * the team has no live line by that key — unknown or removed — and the API
 * answers 404.
 */
export async function updateInfoValue(args: { key: string; value: string; label?: string; updatedById: string | null; team?: string }): Promise<InfoItem | null> {
  const team = args.team ?? TEAM;
  const existing = await db.teamInfoItem.findUnique({ where: { team_key: { team, key: args.key } }, select: { id: true, removedAt: true } });
  if (!existing || existing.removedAt !== null) return null;
  const data: Prisma.TeamInfoItemUpdateInput = { value: cleanValue(args.value), updatedById: args.updatedById };
  if (args.label !== undefined && isNoteKey(args.key)) {
    const label = cleanLabel(args.label);
    if (label !== null) data.label = label;
  }
  return db.teamInfoItem.update({ where: { id: existing.id }, data, select: ITEM_SELECT });
}

/**
 * A new note of the owner's (POST /api/lasd26/info). The key is
 * NOTE_PREFIX + slugLabel(label); when a row — live or removed — already
 * holds it, "-2", "-3"… until one is free, so a removed note's name can be
 * used again without reviving the old row. sortOrder = NOTE_SORT_BASE +
 * the number of note rows the team has, removed ones included (rows are
 * never hard-deleted), so a new note always lands after the last one —
 * newest last. Throws on a label cleanLabel() refuses: the API checks
 * first.
 */
export async function addInfoNote(args: { label: string; value?: string; updatedById: string | null; team?: string }): Promise<InfoItem> {
  const team = args.team ?? TEAM;
  const label = cleanLabel(args.label);
  if (label === null) throw new Error("addInfoNote: the label is not usable — check it with cleanLabel() first");
  const value = cleanValue(args.value ?? "");
  const base = NOTE_PREFIX + slugLabel(label);

  // Two notes made at once can pick the same key; the unique index says so
  // (P2002) and the second one picks again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const [taken, noteCount] = await Promise.all([
      db.teamInfoItem.findMany({ where: { team, key: { startsWith: base } }, select: { key: true } }),
      db.teamInfoItem.count({ where: { team, key: { startsWith: NOTE_PREFIX } } }),
    ]);
    const keys = new Set(taken.map((r) => r.key));
    let key = base;
    for (let n = 2; keys.has(key); n++) key = `${base}-${n}`;
    try {
      return await db.teamInfoItem.create({
        data: { team, key, label, value, hint: "", sortOrder: NOTE_SORT_BASE + noteCount, updatedById: args.updatedById, removedAt: null },
        select: ITEM_SELECT,
      });
    } catch (err) {
      const collided = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!collided || attempt === 2) throw err;
    }
  }
  throw new Error("addInfoNote: could not find a free key");
}

/**
 * REMOVE a line from the sheet, built-in or note alike (DELETE
 * /api/lasd26/info): removedAt is set, the row stays. Returns the row as
 * removed, or null when the key is unknown or already removed — the API
 * answers 404. Nothing re-seeds a removed line afterwards.
 */
export async function removeInfoItem(args: { key: string; team?: string }): Promise<InfoItem | null> {
  const team = args.team ?? TEAM;
  const existing = await db.teamInfoItem.findUnique({ where: { team_key: { team, key: args.key } }, select: { id: true, removedAt: true } });
  if (!existing || existing.removedAt !== null) return null;
  return db.teamInfoItem.update({ where: { id: existing.id }, data: { removedAt: new Date() }, select: ITEM_SELECT });
}
