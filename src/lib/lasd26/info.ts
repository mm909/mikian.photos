import "server-only";
import { db } from "@/lib/db";
import { TEAM } from "./team";

/**
 * THE INFO SHEET (owner, 2026-10-16: "make a info page where we can fill
 * out addresses for airbnb, start line, van pick up etc. if you already
 * know any of that please fill it in. I can give the rest. What other info
 * would the runners need."). One sheet per team, a line per thing a runner
 * needs for the weekend — where, when, who to call.
 *
 * The LIST is code: DEFAULT_ITEMS below, in the order the page shows them,
 * with what the site already knew typed in (the race, the day, the start,
 * the weekend, the packing list, the phone tracking) and a hint on every
 * empty line so the owner knows what goes there. ensureInfoItems() seeds
 * the rows that are missing on first read and NEVER overwrites a value —
 * the values are the owner's, typed on /lasd26/info. A new line added
 * here later appears on the sheet on the next read; a line deleted here
 * stays in the table until someone removes it by hand.
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

export type DefaultItem = { key: string; label: string; value: string; hint: string };

/** A value may run a few lines (an address, a door code, three phone numbers) — not an essay. */
export const MAX_VALUE = 4000;

export const DEFAULT_ITEMS: readonly DefaultItem[] = [
  {
    key: "race",
    label: "Race",
    // Measured off the organizer's directions map (scripts/lasd26-route-from-kml.ts):
    // 115.3 miles of running plus a 17.5-mile van ride through Camp Pendleton;
    // the organizer's poster rounds it to 120.
    value: "No Shortcuts Time Trial, 7th edition — Santa Monica → San Diego. 115 miles of running (the poster says 120) with one van ride through Camp Pendleton, two teams of 8 running in pairs. @noshortcutstt",
    hint: "",
  },
  {
    key: "race-day",
    label: "Race day",
    value: "Friday 10.23 · start 5:00 AM PT",
    hint: "the start time, and when the van leaves the Airbnb",
  },
  {
    key: "start-line",
    label: "Start line",
    value: "Santa Monica Pier (the official map's START pin)",
    hint: "exact meeting spot + what time to be there",
  },
  {
    key: "finish",
    label: "Finish",
    value: "",
    hint: "the finish line in San Diego and where the van parks",
  },
  {
    key: "the-weekend",
    label: "The weekend",
    value: "Thu 10.22 Vegas → LA. Fri 10.23 race day. Sat 10.24 breakfast, then the drive home.",
    hint: "the plan, day by day",
  },
  {
    key: "van-pick-up",
    label: "Van pick-up",
    value: "",
    hint: "where and when we get the vans (Thursday)",
  },
  {
    key: "airbnb",
    label: "Airbnb",
    value: "",
    hint: "address, door code, check-in / check-out",
  },
  {
    key: "hotel-friday",
    label: "Hotel Friday",
    value: "",
    hint: "address, which names the rooms are under",
  },
  {
    key: "group-chat",
    label: "Group chat",
    value: "",
    hint: "link",
  },
  {
    key: "crew-phones",
    label: "Crew phones",
    value: "",
    hint: "Mikian, the crew captains",
  },
  {
    key: "what-to-bring",
    label: "What to bring",
    value: "Headlamp + reflective vest (night and dawn legs), 2 pairs of shoes, warm layer for the van, sunscreen, your own bottles, cash for snacks",
    hint: "edit freely",
  },
  {
    key: "food-plan",
    label: "Food plan",
    value: "",
    hint: "what the van carries, where we stop",
  },
  {
    key: "phone-tracking",
    label: "Phone tracking",
    value: "Each runner installs Traccar Client — setup page coming",
    hint: "the tracker's join page when it goes live",
  },
  {
    key: "pairs-rotation",
    label: "Pairs & rotation",
    value: "",
    hint: "the order we run in, who is in A and B",
  },
  {
    key: "parking-at-the-start",
    label: "Parking at the start",
    value: "",
    hint: "where to leave the cars at Santa Monica Pier",
  },
  {
    key: "emergency",
    label: "Emergency",
    value: "",
    hint: "who to call; the nearest hospitals along the route are on the race's official map",
  },
  // Three more a runner asks about (the owner's "what other info would the
  // runners need"): when and where the vans leave Vegas, where the pairs
  // swap, and where the money is.
  {
    key: "leaving-vegas",
    label: "Leaving Vegas",
    value: "",
    hint: "Thursday: what time, where we meet, who rides in which van",
  },
  {
    key: "exchange-points",
    label: "Exchange points",
    value: "",
    hint: "where the pairs swap and roughly how long each leg is",
  },
  {
    key: "money",
    label: "Money",
    value: "Every cost and your share are on the EXPENSES page (the door in the bar). Settle up opens after the race — card only.",
    hint: "",
  },
];

/** A key is a slug: "airbnb", "van-pick-up". Null for anything else. */
export function parseKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = v.trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(k) && k.length <= 40 ? k : null;
}

/**
 * The value as stored: Windows line ends folded, trailing blanks off every
 * line, trimmed at both ends, cut at MAX_VALUE. Never throws.
 */
export function cleanValue(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim()
    .slice(0, MAX_VALUE);
}

/**
 * Seed the lines of DEFAULT_ITEMS that the team does not have yet. Only
 * the MISSING keys are written — an existing row keeps its value, label
 * and order, so nothing the owner typed is ever replaced by a prefill.
 */
export async function ensureInfoItems(team: string = TEAM): Promise<void> {
  const have = await db.teamInfoItem.findMany({ where: { team }, select: { key: true } });
  const haveKeys = new Set(have.map((r) => r.key));
  const missing = DEFAULT_ITEMS.map((d, i) => ({ ...d, sortOrder: i })).filter((d) => !haveKeys.has(d.key));
  if (missing.length === 0) return;
  await db.teamInfoItem.createMany({
    data: missing.map((d) => ({ team, key: d.key, label: d.label, value: d.value, hint: d.hint, sortOrder: d.sortOrder })),
    // Two first readers at once: the second insert of the same key is skipped, not an error.
    skipDuplicates: true,
  });
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

/** The whole sheet, in order, seeded first. */
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
