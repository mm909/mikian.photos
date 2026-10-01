import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE, CHALLENGE_DEMO, nowMs } from "@/lib/row100k";
import { DEFAULT_PALETTE, PALETTE_COOKIE, isPaletteId, type PaletteId } from "@/lib/rowPalette";

/* Site-wide switches for Rowtember (owner, 2026-09-16), read on every
 * /row100k request through the segment layout and written from the admin
 * pages through /api/row100k/settings.
 *
 * Five keys, each its own RowSetting row, each validated both ways:
 *
 *   look             "paper" | "ink" — the colour scheme the whole site
 *                    wears. Ink is white on black, for race week and after.
 *                    An admin can also preview ink on their own browser
 *                    alone through the LOOK_COOKIE (row100k/layout.tsx).
 *   palette          which preset of rowPalette.ts the site wears (owner,
 *                    2026-09-30): the landing's ground and the accent every
 *                    page takes through --water. Previewed on one browser
 *                    through PALETTE_COOKIE, set from ?palette=<id>.
 *   cards.off        the share card ids switched OFF in every picker
 *                    (share/cards.ts CARDS). The code default is the list
 *                    the owner retired on 2026-09-16; the shareables page
 *                    lets him turn any card back on, or others off.
 *   blackout.policy  who the blackout hides: the top `count` of EACH board
 *                    ("division" — the men's ten and the women's ten, the
 *                    rule since 2026-09-08) or the top `count` OVERALL.
 *   mail.wave        the owner's own words for the wave note (owner,
 *                    2026-09-30: "I should be able to edit the emails
 *                    inside of this application ... I should be able to
 *                    swap the order of those on my own"). Three plain
 *                    lines — arrive, waiver, sign-off — each optional;
 *                    an absent or empty one means the letter's built-in
 *                    line (raceEmail.ts WAVE_WORDS). Typed on the Emails
 *                    page.
 *
 * EVERY READ FAILS OPEN TO THE DEFAULTS. The table may not be pushed yet
 * (the owner runs prisma db push on his own say-so), and a settings hiccup
 * must cost the switches, never a page: the defaults are the site exactly
 * as it was before this file existed. Writes do not fail open — a save that
 * did not land has to say so. */

export const SETTINGS_TAG = "row100k-settings";

/* The admin's own-browser preview of a look. Cosmetic, so it is honoured
 * for anyone who carries it; only the settings route ever SETS it, and that
 * route is admin-only. A session cookie: closing the browser ends it. */
export const LOOK_COOKIE = "row100k_look";
/* The same for a palette. Lives in rowPalette.ts, which the middleware can
 * import; re-exported here so the layout reads both names from one place. */
export { PALETTE_COOKIE };

export type Look = "paper" | "ink";
export type BlackoutScope = "division" | "overall";
export type BlackoutPolicy = { scope: BlackoutScope; count: number };

/* The wave note's editable lines. A field that is absent means the
 * built-in line; the parser drops empty ones, so {} is "all defaults". */
export const MAIL_WAVE_FIELDS = ["arrive", "waiver", "signoff"] as const;
export type MailWaveField = (typeof MAIL_WAVE_FIELDS)[number];
export type MailWave = Partial<Record<MailWaveField, string>>;
/* The most a line may run to. */
export const MAIL_WAVE_MAX = 300;

export type SiteSettings = {
  look: Look;
  palette: PaletteId;
  /* Card ids switched off, in no particular order. */
  cardsOff: string[];
  blackout: BlackoutPolicy;
  mailWave: MailWave;
};

export type SettingKey = "look" | "palette" | "cards.off" | "blackout.policy" | "mail.wave";
export const SETTING_KEYS: readonly SettingKey[] = ["look", "palette", "cards.off", "blackout.policy", "mail.wave"];

/* Retired from every picker (owner, 2026-09-16): the profile, the bib, the
 * club card, total + name, and row + name. Off by default; the shareables
 * page can bring any of them back. */
export const DEFAULT_CARDS_OFF: readonly string[] = [
  "rowtember-profile",
  "rowtember-bib",
  "rowtember-club",
  "rowtember-named",
  "rowtember-row-full",
];

/* The rule as it stood before the policy was a setting: ten per board. */
export const DEFAULT_BLACKOUT_POLICY: BlackoutPolicy = { scope: "division", count: 10 };
/* The most rowers a policy may hide, per board or overall. */
export const BLACKOUT_COUNT_MAX = 100;

export const DEFAULT_SETTINGS: SiteSettings = {
  look: "paper",
  palette: DEFAULT_PALETTE,
  cardsOff: [...DEFAULT_CARDS_OFF],
  blackout: { ...DEFAULT_BLACKOUT_POLICY },
  mailWave: {},
};

/* ------------------------------------------------------------ parsing */

export function isSettingKey(v: unknown): v is SettingKey {
  return typeof v === "string" && (SETTING_KEYS as readonly string[]).includes(v);
}

export function parseLook(v: unknown): Look | null {
  return v === "paper" || v === "ink" ? v : null;
}

export function parsePalette(v: unknown): PaletteId | null {
  return isPaletteId(v) ? v : null;
}

const CARD_ID = /^[a-z0-9-]{1,60}$/;

/* An array of card ids — deduped, capped, each one id-shaped. The ids are
 * not checked against the registry here (this file must stay free of the
 * canvas-drawing module); the settings route does that. */
export function parseCardsOff(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !CARD_ID.test(x)) return null;
    if (!out.includes(x)) out.push(x);
    if (out.length > 100) return null;
  }
  return out;
}

export function parseBlackoutPolicy(v: unknown): BlackoutPolicy | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { scope?: unknown; count?: unknown };
  const scope = o.scope === "division" || o.scope === "overall" ? o.scope : null;
  const count = typeof o.count === "number" && Number.isInteger(o.count) ? o.count : null;
  if (!scope || count === null || count < 1 || count > BLACKOUT_COUNT_MAX) return null;
  return { scope, count };
}

/* Three optional strings, each trimmed, at most MAIL_WAVE_MAX long, with
 * no angle brackets (plain text only — the letter escapes on render, this
 * just keeps a stray tag from ever being typed in). An empty string means
 * "the default" and is dropped, so the row only ever holds real changes.
 * Placeholders ({first_wave} and the rest) are the letter's business
 * (raceEmail.ts fillWords); an unknown one is left as typed. */
export function parseMailWave(v: unknown): MailWave | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: MailWave = {};
  for (const k of MAIL_WAVE_FIELDS) {
    const s = o[k];
    if (s === undefined || s === null) continue;
    if (typeof s !== "string") return null;
    const t = s.replace(/\r\n?/g, "\n").trim();
    if (t.length > MAIL_WAVE_MAX || /[<>]/.test(t)) return null;
    if (t) out[k] = t;
  }
  return out;
}

/* The validated value for a key, or null when it is not one. */
export function parseSetting(
  key: SettingKey,
  value: unknown,
): Look | PaletteId | string[] | BlackoutPolicy | MailWave | null {
  if (key === "look") return parseLook(value);
  if (key === "palette") return parsePalette(value);
  if (key === "cards.off") return parseCardsOff(value);
  if (key === "mail.wave") return parseMailWave(value);
  return parseBlackoutPolicy(value);
}

/* ------------------------------------------------------------- reading */

function fold(rows: { key: string; value: string }[]): SiteSettings {
  const out: SiteSettings = {
    look: DEFAULT_SETTINGS.look,
    palette: DEFAULT_SETTINGS.palette,
    cardsOff: [...DEFAULT_SETTINGS.cardsOff],
    blackout: { ...DEFAULT_SETTINGS.blackout },
    mailWave: {},
  };
  for (const r of rows) {
    if (!isSettingKey(r.key)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.value);
    } catch {
      continue;
    }
    const v = parseSetting(r.key, parsed);
    if (v === null) continue;
    if (r.key === "look") out.look = v as Look;
    else if (r.key === "palette") out.palette = v as PaletteId;
    else if (r.key === "cards.off") out.cardsOff = v as string[];
    else if (r.key === "mail.wave") out.mailWave = v as MailWave;
    else out.blackout = v as BlackoutPolicy;
  }
  return out;
}

const loadSettings = async (): Promise<SiteSettings> => {
  const rows = await db.rowSetting.findMany({
    where: { challenge: CHALLENGE },
    select: { key: true, value: true },
  });
  return fold(rows);
};

const getSettings = unstable_cache(loadSettings, [SETTINGS_TAG], {
  revalidate: 300,
  tags: [SETTINGS_TAG],
});

/* After a failed lookup, stop asking for a minute — before the table is
 * pushed this would otherwise be a failing query and a logged error on
 * every request (the same backstop blackout.ts keeps). */
const QUIET_MS = 60_000;
let quietUntil = 0;

/* The switches as they stand. Never throws. */
export async function siteSettings(): Promise<SiteSettings> {
  const at = nowMs();
  if (at < quietUntil) return DEFAULT_SETTINGS;
  try {
    return await (CHALLENGE === CHALLENGE_DEMO ? loadSettings() : getSettings());
  } catch (err) {
    quietUntil = at + QUIET_MS;
    console.error("row100k: settings read failed, using the defaults", err);
    return DEFAULT_SETTINGS;
  }
}

/* The raw rows, uncached, for an admin page that wants the truth right
 * after a write. Throws — the page says the table is missing. */
export async function listSettings(): Promise<{ key: string; value: string; updatedBy: string; updatedAt: string }[]> {
  const rows = await db.rowSetting.findMany({
    where: { challenge: CHALLENGE },
    select: { key: true, value: true, updatedBy: true, updatedAt: true },
    orderBy: { key: "asc" },
  });
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

/* ------------------------------------------------------------- writing */

/* Validates, upserts, and busts the cache. Throws on a bad value (an
 * Error whose message is fit to print) and on a database failure. */
export async function writeSetting(key: SettingKey, value: unknown, who: string): Promise<void> {
  const v = parseSetting(key, value);
  if (v === null) throw new Error(`That is not a valid value for ${key}.`);
  const text = JSON.stringify(v);
  await db.rowSetting.upsert({
    where: { challenge_key: { challenge: CHALLENGE, key } },
    create: { challenge: CHALLENGE, key, value: text, updatedBy: who.slice(0, 200) },
    update: { value: text, updatedBy: who.slice(0, 200) },
  });
  revalidateTag(SETTINGS_TAG);
}
