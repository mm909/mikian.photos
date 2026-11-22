import { API, api } from "./api";
import { copyImage, fetchFile, fromBase64, shareFile, type Fetched } from "./files";

/* THE STICKERS AND THE REEL OVERLAYS (owner, 2026-11-20: "the stickers are
 * the site's transparent cards"; "overlays and videos designed to be
 * stitched together in edits or another app"; "get them to work").
 *
 * Nothing is drawn in the app. A STICKER is one of the site's share cards,
 * drawn by the site's own card code on the server (/api/row100k/app/card)
 * and handed here as a PNG on a transparent ground: white type and the ROW
 * mark, to lay over a photo. A REEL OVERLAY is the site's reel painting
 * filmed on the server (/api/row100k/app/reel) into an MP4 on a ground to
 * key out. A card or a clip changed on the site is changed here. */

export type Sticker = { id: string; label: string; width: number; height: number; png?: string };
export type Deck = { rowerNumber?: number; cards: Sticker[] };

/* A DECK COMES WITH ITS ART (owner, 2026-11-22: "I should not be waiting
 * for anything there"). One request brings the list and every sticker
 * drawn; each is kept as if it had been fetched, so the viewer has nothing
 * left to ask for. A deck is kept five minutes, and all of them are let go
 * when a row is logged, which is the only thing that changes one. */
const decks = new Map<string, Promise<Deck>>();
export function deck(rowId?: string): Promise<Deck> {
  const key = rowId ?? "";
  let p = decks.get(key);
  if (!p) {
    p = api<Deck>(`/api/row100k/app/cards?art=1${rowId ? `&row=${rowId}` : ""}`).then((d) => {
      for (const c of d.cards) {
        if (!c.png) continue;
        const png = c.png;
        delete c.png;
        seen.set(`card|${c.id}|${key}`, fromBase64(png, cardName(c.id, rowId), "image/png"));
      }
      return d;
    });
    decks.set(key, p);
    p.catch(() => decks.delete(key));
    setTimeout(() => decks.get(key) === p && decks.delete(key), 300_000);
  }
  return p;
}
export function forgetStickers(): void {
  decks.clear();
  for (const k of [...seen.keys()]) if (k.startsWith("card|")) seen.delete(k);
}

const cardUrl = (id: string, rowId?: string) => `${API}/api/row100k/app/card?id=${encodeURIComponent(id)}${rowId ? `&row=${rowId}` : ""}`;
const cardName = (id: string, rowId?: string) => `row-${id.replace(/^rowtember-/, "")}${rowId ? `-${rowId.slice(-6)}` : ""}.png`;

/* Fetched once and kept for the visit. */
const seen = new Map<string, Promise<Fetched>>();
function once(key: string, make: () => Promise<Fetched>): Promise<Fetched> {
  let p = seen.get(key);
  if (!p) {
    p = make();
    seen.set(key, p);
    p.catch(() => seen.delete(key));
  }
  return p;
}

const sticker = (id: string, rowId?: string) => once(`card|${id}|${rowId ?? ""}`, () => fetchFile(cardUrl(id, rowId), cardName(id, rowId)));
export const stickerUri = (id: string, rowId?: string) => sticker(id, rowId).then((f) => f.uri);

/* Hand a sticker to the share sheet, and tell the site, which keeps count
 * of what gets shared. */
export async function shareSticker(id: string, rowId: string | undefined, rowerNumber: number | undefined): Promise<"share" | "download" | "none"> {
  const did = await shareFile(await sticker(id, rowId), cardName(id, rowId), "image/png", "public.png");
  if (did !== "none") api("/api/row100k/share-event", { body: { cardId: id, action: did, ...(rowerNumber ? { rowerNumber } : {}) } }).catch(() => null);
  return did;
}

/* ---- reel overlays ----------------------------------------------------- */

export async function copySticker(id: string, rowId: string | undefined, rowerNumber: number | undefined): Promise<void> {
  await copyImage(await sticker(id, rowId));
  api("/api/row100k/share-event", { body: { cardId: id, action: "copy", ...(rowerNumber ? { rowerNumber } : {}) } }).catch(() => null);
}

export const CLIPS = [
  { id: "meters", label: "Meters" },
  { id: "clock", label: "Clock" },
  { id: "pace", label: "Pace" },
  { id: "stack", label: "All six" },
  { id: "stroke", label: "The stroke" },
  { id: "monitor", label: "The monitor" },
] as const;
export type ClipId = (typeof CLIPS)[number]["id"];
export const GROUNDS = [
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "black", label: "Black" },
] as const;
export type GroundId = (typeof GROUNDS)[number]["id"];
export const LENGTHS = [5, 10, 15] as const;

const reelUrl = (rowId: string, clip: ClipId, bg: string, len: number, still: boolean) => `${API}/api/row100k/app/reel?row=${rowId}&clip=${clip}&bg=${bg}&len=${len}${still ? "&still=1" : ""}`;

/* What a clip ends on, on ink, for the tile. */
export const reelStillUri = (rowId: string, clip: ClipId) => once(`still|${rowId}|${clip}`, () => fetchFile(reelUrl(rowId, clip, "ink", 10, true), `reel-${clip}-${rowId.slice(-6)}.png`)).then((f) => f.uri);

/* THE CLIP, MOVING: its five-second version as fifty small frames on one
 * picture (the site's REEL_STRIP, which these numbers repeat), for the
 * preview that plays when a clip is opened. Fetched once and kept. */
export const STRIP = { frames: 50, cols: 10, rows: 5, fps: 10 } as const;
export const reelStripUri = (rowId: string, clip: ClipId) => once(`strip|${rowId}|${clip}`, () => fetchFile(`${reelUrl(rowId, clip, "ink", 5, false)}&strip=1`, `reel-${clip}-${rowId.slice(-6)}-strip.jpg`)).then((f) => f.uri);

/* FILM A CLIP, THEN SHARE IT, as two steps (2026-11-22, after the owner
 * pressed FILM and the button stayed grey: "I clicked filming and
 * nothing's happening"). The site takes a while to film; a browser only
 * opens its share sheet on a press, and a press that is twenty seconds old
 * no longer counts. So the film is made and shown, and SHARE is its own
 * press. A film that has not come back in ninety seconds is given up on,
 * with a sentence. */
const reelName = (rowId: string, clip: ClipId, bg: GroundId, len: number) => `row-${clip}-${bg}-${len}s-${rowId.slice(-6)}.mp4`;
export const filmReel = (rowId: string, clip: ClipId, bg: GroundId, len: number): Promise<Fetched> =>
  once(`reel|${rowId}|${clip}|${bg}|${len}`, () => fetchFile(`${reelUrl(rowId, clip, bg, len, false)}&format=phone`, reelName(rowId, clip, bg, len), 90_000));
export const shareFilm = (f: Fetched, rowId: string, clip: ClipId, bg: GroundId, len: number): Promise<"share" | "download" | "none"> => shareFile(f, reelName(rowId, clip, bg, len), "video/mp4", "public.mpeg-4");
