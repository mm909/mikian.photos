import { readFileSync } from "node:fs";
import { analyseSession } from "@/lib/pm5/analysis";
import { validateTelemetryDoc } from "@/lib/pm5/session";
import path from "node:path";
import { GlobalFonts, createCanvas } from "@napi-rs/canvas";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { accentOn, capsOn, paletteOf } from "@/lib/rowPalette";
import { siteSettings } from "@/lib/rowSettings";
import type { Viewer } from "@/lib/row100kViewer";
import { buildProfile } from "../r/[num]/profileData";
import { setCardAccent } from "./accent";
import { RACE_CARD_IDS, RACE_TIME_CARD_IDS, availableCards, type ShareCard, type ShareData, type ShareFonts } from "./cards";

/* A SHARE CARD, DRAWN ON THE SERVER (2026-11-20). The cards are canvases
 * (cards.ts), and until now only a browser drew them. The phone app has no
 * browser canvas, so the same draw functions run here on a canvas of the
 * server's (@napi-rs/canvas: Skia, the engine Chrome draws with) and the
 * answer is the PNG. One set of drawing code for the site's share dialog
 * and the app's stickers; nothing is drawn twice.
 *
 * The faces are the site's three, read off the font files beside this file
 * (the browser gets the same faces from next/font). The accent is the site
 * palette's, cut for the look, as RowSite.tsx hands it to the dialog.
 *
 * Race cards are left out: they load a venue mark with `new Image()`, which
 * is a browser thing. SERVER ONLY. */

const FONT_DIR = path.join(process.cwd(), "src", "app", "row100k", "share", "fonts");
const FACES: [string, string][] = [
  ["ArchivoBlack-Regular.ttf", "Archivo Black"],
  ["SpaceMono-Regular.ttf", "Space Mono"],
  ["SpaceMono-Bold.ttf", "Space Mono"],
  ["Archivo-Regular.ttf", "Archivo"],
  ["Archivo-Bold.ttf", "Archivo"],
];
let facesIn = false;
/* Also used by the reel filmed on the server (erg/reel/serverReel.ts). */
export function loadFaces(): void {
  if (facesIn) return;
  for (const [file, family] of FACES) GlobalFonts.register(readFileSync(path.join(FONT_DIR, file)), family);
  facesIn = true;
}

export const SERVER_FONTS: ShareFonts = { black: '"Archivo Black"', mono: '"Space Mono"' };

const NOT_HERE = new Set<string>([...RACE_CARD_IDS, ...RACE_TIME_CARD_IDS]);

/* The cards a payload can draw on the server, with the owner's OFF switches
 * honoured (rowSettings cards.off), as the site's picker honours them. */
export async function serverCards(data: ShareData): Promise<ShareCard[]> {
  const settings = await siteSettings();
  const off = new Set(settings.cardsOff);
  return availableCards(data).filter((c) => !NOT_HERE.has(c.id) && !off.has(c.id));
}

export async function renderCardPng(card: ShareCard, data: ShareData): Promise<Buffer> {
  loadFaces();
  const settings = await siteSettings();
  const cut = accentOn(paletteOf(settings.palette), settings.look);
  /* Module state, set immediately before the synchronous draw. */
  setCardAccent(cut.accent, capsOn(cut.accent));
  const canvas = createCanvas(card.width, card.height);
  const ctx = canvas.getContext("2d");
  card.draw(ctx as unknown as CanvasRenderingContext2D, data, SERVER_FONTS);
  return canvas.toBuffer("image/png");
}

/* WHAT A VIEWER MAY SHARE. The site mounts a share surface on a rower's
 * page for the rower and for an admin, nobody else, so the same two get a
 * payload here. With `rowId` the payload is that row's (its month, and the
 * row itself for THIS ROW); without, the viewer's own current month.
 * Null means no: not signed in, not theirs, or no such row. */
/* WHY THE STICKERS WERE SLOW (owner, 2026-11-22: "why do our shareables
 * take so long to load?"): the app asks for the list and then for each
 * sticker as its own picture, and every one of those requests worked out
 * the rower's whole profile again before drawing. Now the numbers behind a
 * rower's deck are worked out once and kept for a minute, so the list and
 * all its pictures share one read. Per server instance; a miss only costs
 * what it used to. */
const DECK_TTL_MS = 60_000;
const decks = new Map<string, { at: number; data: Promise<ShareData | null> }>();
export function shareDataFor(viewer: Viewer, rowId: string | null): Promise<ShareData | null> {
  if (!viewer.actor) return Promise.resolve(null);
  const key = `${viewer.actor.photographerId}|${rowId ?? ""}`;
  const hit = decks.get(key);
  if (hit && Date.now() - hit.at < DECK_TTL_MS) return hit.data;
  const data = readShareData(viewer, rowId);
  decks.set(key, { at: Date.now(), data });
  data.catch(() => decks.delete(key));
  if (decks.size > 200) for (const [k, v] of decks) if (Date.now() - v.at >= DECK_TTL_MS) decks.delete(k);
  return data;
}

async function readShareData(viewer: Viewer, rowId: string | null): Promise<ShareData | null> {
  if (!viewer.actor) return null;
  let num = viewer.me?.rowerNumber ?? null;
  let month: string | undefined;
  if (rowId) {
    const entry = await db.rowEntry.findFirst({
      where: { id: rowId, challenge: CHALLENGE },
      select: { day: true, participant: { select: { id: true, rowerNumber: true } } },
    });
    if (!entry) return null;
    if (!viewer.isAdmin && entry.participant.id !== viewer.myParticipantId) return null;
    num = entry.participant.rowerNumber;
    month = entry.day.slice(0, 7);
  }
  if (!num) return null;
  const built = await buildProfile(num, month);
  if (!built || (!built.view.isMe && !viewer.isAdmin)) return null;
  const row = rowId ? built.view.rows.find((r) => r.id === rowId) : undefined;
  /* A row off a connected erg brings its averages and its 500 m splits,
   * for the receipt and the splits stickers. A recording that cannot be
   * read costs those two extras and nothing else. */
  let erg: { watts: number | null; spm: number | null } | null = null;
  let splits: { endMeters: number; seconds: number }[] = [];
  if (row) {
    try {
      const t = await db.rowTelemetry.findFirst({ where: { entryId: row.id }, select: { avgWatts: true, avgSpm: true, data: true } });
      if (t) {
        erg = { watts: t.avgWatts, spm: t.avgSpm };
        const doc = validateTelemetryDoc(t.data);
        if (typeof doc !== "string") splits = analyseSession({ doc, history: [] }).splits.filter((s) => s.seconds > 0).map((s) => ({ endMeters: Math.round(s.endMeters / 10) * 10, seconds: s.seconds }));
      }
    } catch (err) {
      console.error("row app: recording unreadable for a row's stickers", err);
    }
  }
  return { ...built.view.shareData, row: row ? { day: row.day, meters: row.meters, seconds: row.seconds, title: row.title, erg, splits } : null };
}
