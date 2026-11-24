import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import type { TelemetryDoc } from "./pm5/session";

/* THE TWO PHOTOS, AND THE ROW (owner, 2026-11-20: "exactly 2 photos", on
 * every row, by hand or off the erg). The same road the site's own form
 * takes: each photo is shrunk on the device to a 1600 px long edge, sent
 * straight to storage through a signed address (api/row100k/photos/sign),
 * a 320 px thumb after it, and the row itself goes to api/row100k/rows with
 * the two keys. A row that came off a connected erg then sends its whole
 * recording to api/row100k/app/erg, tied to the row.
 *
 * A ROW OFF THE MONITOR IS LOGGED BEFORE ITS PHOTOS since 2026-11-24
 * (autolog.ts): it is on the site the moment it ends, and `finishRow` below
 * puts the two photos, the title and the words on a row that is already
 * there. A row typed in by hand still goes in whole, photos first, through
 * `logRow`. */

/* A photo off the phone. `fx` and `fy` say where the three-by-four frame
 * of a row sits on it, from 0 (its left, its top) to 1 (its right, its
 * foot); unset is the middle. */
export type Picked = { uri: string; width: number; height: number; fx?: number; fy?: number };

/* THE FRAME OF A ROW'S PHOTO: three wide by four tall, the tallest
 * Instagram takes (owner, 2026-11-22). */
export const FRAME = 3 / 4;

/* The part of a photo the frame shows, in the photo's own pixels. A photo
 * wider than the frame loses its sides; a taller one its top and foot;
 * which of them is where the rower slid it. */
export function frameOf(p: Picked): { originX: number; originY: number; width: number; height: number } {
  const fx = Math.min(1, Math.max(0, p.fx ?? 0.5));
  const fy = Math.min(1, Math.max(0, p.fy ?? 0.5));
  if (p.width / p.height > FRAME) {
    const w = Math.round(p.height * FRAME);
    return { originX: Math.round((p.width - w) * fx), originY: 0, width: w, height: p.height };
  }
  const h = Math.round(p.width / FRAME);
  return { originX: 0, originY: Math.round((p.height - h) * fy), width: p.width, height: h };
}

export async function pickPhoto(from: "camera" | "library"): Promise<Picked | null> {
  if (from === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("The camera is switched off for ROW. Turn it on in Settings, or choose a photo instead.");
  }
  const res = from === "camera" ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  const a = res.canceled ? null : res.assets[0];
  return a ? { uri: a.uri, width: a.width, height: a.height } : null;
}

/* Up to `limit` photos out of the library in one visit to it (owner,
 * 2026-11-21: "when I am submitting photos, allow me to select both of them
 * at the same time. Don't make me click on one, enter it, click on one,
 * enter it"). In the order they were picked. */
export async function pickPhotos(limit: number): Promise<Picked[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: limit > 1, selectionLimit: limit, orderedSelection: true });
  if (res.canceled) return [];
  return res.assets.slice(0, limit).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/* `framed`: cut to the row's frame first, where the rower set it (owner,
 * 2026-11-22: "we also need to be considerate now of crop whenever we
 * upload"), so the picture that is stored is the picture they saw. A face
 * for a profile is cut square by the phone's own tool and is not framed. */
async function shrink(p: Picked, edge: number, compress: number, framed = false): Promise<Blob> {
  const cut = framed && p.width > 0 && p.height > 0 ? frameOf(p) : null;
  const w = cut ? cut.width : p.width;
  const h = cut ? cut.height : p.height;
  const wide = w >= h;
  const long = Math.max(w, h);
  const out = await manipulateAsync(p.uri, [...(cut ? [{ crop: cut }] : []), ...(long > edge ? [{ resize: wide ? { width: edge } : { height: edge } }] : [])], { compress, format: SaveFormat.JPEG });
  return (await fetch(out.uri)).blob();
}

/* One file to storage. `onBytes` hears how many of its bytes have left the
 * phone, as they leave, which is what the bar under LOG is drawn from; that
 * count is the reason this is the phone's older way of sending (a request
 * that reports on its way up) and not `fetch`, which says nothing until the
 * whole file is there. */
function put(url: string, blob: Blob, onBytes?: (sent: number) => void): Promise<void> {
  /* No signal, or (in a browser on a laptop) the storage refusing an
   * address it does not know. Nothing was logged; the form keeps the row. */
  const lost = "The photo could not be sent. Check the connection and try again; nothing was logged.";
  return new Promise<void>((done, fail) => {
    let x: XMLHttpRequest;
    try {
      x = new XMLHttpRequest();
      x.open("PUT", url);
      x.setRequestHeader("content-type", "image/jpeg");
    } catch {
      fail(new Error(lost));
      return;
    }
    if (onBytes) x.upload.onprogress = (e) => onBytes(Math.max(0, Math.min(blob.size, e.loaded || 0)));
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        onBytes?.(blob.size);
        done();
      } else fail(new Error(`The photo did not upload (${x.status}). Nothing was logged.`));
    };
    x.onerror = () => fail(new Error(lost));
    x.ontimeout = () => fail(new Error(lost));
    x.onabort = () => fail(new Error(lost));
    x.send(blob);
  });
}

/* A photo cut and shrunk, ready to go: the picture and its small copy. The
 * small copy is best effort, as on the site: a row without one shows its
 * full photo. */
type Ready = { main: Blob; thumb: Blob | null };
async function ready(p: Picked): Promise<Ready> {
  const main = await shrink(p, 1600, 0.82, true);
  const thumb = await shrink(p, 320, 0.7, true).catch(() => null);
  return { main, thumb };
}
const bytesOf = (r: Ready) => r.main.size + (r.thumb?.size ?? 0);

/* Up it goes; answers its key. `onBytes` hears the bytes of the two files
 * together. */
async function send(r: Ready, onBytes?: (sent: number) => void): Promise<string> {
  const signed = await api<{ key: string; url: string }>("/api/row100k/photos/sign", { body: { contentType: "image/jpeg", contentLength: r.main.size } });
  await put(signed.url, r.main, onBytes);
  if (r.thumb) {
    const thumb = r.thumb;
    try {
      const t = await api<{ url: string }>("/api/row100k/photos/sign", { body: { contentType: "image/jpeg", contentLength: thumb.size, thumbFor: signed.key } });
      await put(t.url, thumb, onBytes ? (n) => onBytes(r.main.size + n) : undefined);
    } catch {
      /* A row without a thumb shows its full photo. */
    }
  }
  onBytes?.(bytesOf(r));
  return signed.key;
}

/* One photo up; answers its key. */
export async function uploadPhoto(p: Picked): Promise<string> {
  return send(await ready(p));
}

/* One photo for a face, with the phone's own crop-and-zoom step, square
 * (owner, 2026-11-22: "when I'm adding a profile photo, I need to be able
 * to size it"). A browser has no such step and takes the picture whole;
 * every list crops it to the circle from its middle. */
export async function pickFace(): Promise<Picked | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: true, aspect: [1, 1] });
  const a = res.canceled ? null : res.assets[0];
  return a ? { uri: a.uri, width: a.width, height: a.height } : null;
}

/* A PROFILE PHOTO: up like a row's photo (and with its small copy, which
 * is what every list draws), then named as the rower's own. */
export async function setAvatar(p: Picked): Promise<void> {
  const key = await uploadPhoto(p);
  await api("/api/row100k/app/settings", { body: { avatarKey: key } });
}

export type NewRow = { day: string; meters: number; seconds: number; title: string; caption?: string; photos: [Picked, Picked]; doc?: TelemetryDoc };

/* HOW FAR A ROW HAS GOT ON ITS WAY IN (owner, 2026-11-23: "we need like a
 * animation for loading/sending or a % going up. Whenever we hit the submit
 * row, we need something to indicate like the progress bar or a % ... Right
 * now it just goes from like photo 1, photo 2, whatever, but it's a little
 * unclear, like how long does it have left, or is it working").
 *
 * `at` is how much is done for certain, from 0 to 1. `to` is how far the
 * step now running reaches: a step with no count of its own (cutting a
 * photo down, asking for an address, the save at the end) gives the bar the
 * stretch from `at` to `to` to creep along while it waits, so it is never
 * standing still. `word` is the step, for beside the percentage.
 *
 * WHAT THE PERCENTAGE IS MADE OF. Most of the wait is the photos going up,
 * so most of the bar is theirs, and that part is counted in bytes that have
 * left the phone out of the bytes of both photos and their small copies: a
 * big photo takes more of the bar than a small one. Before it, a little for
 * cutting the photos down (which is what tells us how many bytes there
 * are); after it, a little for the row itself, and for the monitor's
 * recording when there is one. */
export type Progress = { at: number; to: number; word: string };

/* THE TWO PHOTOS UP, with the bar told as they go: the first PREP of it for
 * cutting them down, the next UP of it by the bytes that have left the
 * phone. Answers their two keys. */
async function sendTwo(photos: [Picked, Picked], step: (p: Progress) => void, PREP: number, UP: number): Promise<[string, string]> {
  step({ at: 0, to: PREP / 2, word: "Getting photo 1 ready" });
  const one = await ready(photos[0]);
  step({ at: PREP / 2, to: PREP, word: "Getting photo 2 ready" });
  const two = await ready(photos[1]);

  const all = Math.max(1, bytesOf(one) + bytesOf(two));
  /* While a photo's address is being asked for nothing is counted yet: the
   * bar may creep a hair past what has gone, no further. */
  const up = (sent: number, word: string) => {
    const at = PREP + UP * Math.min(1, sent / all);
    step({ at, to: Math.min(PREP + UP, at + 0.015), word });
  };
  up(0, "Sending photo 1 of 2");
  const a = await send(one, (n) => up(n, "Sending photo 1 of 2"));
  up(bytesOf(one), "Sending photo 2 of 2");
  const b = await send(two, (n) => up(bytesOf(one) + n, "Sending photo 2 of 2"));
  return [a, b];
}

/* Log it. `step` says where it has got to, for the bar. Answers the new
 * row's id and whether the recording went with it. */
export async function logRow(row: NewRow, step: (p: Progress) => void): Promise<{ id: string; recorded: boolean }> {
  const PREP = 0.12;
  const REC = row.doc ? 0.1 : 0;
  const SAVE = 0.1;
  const UP = 1 - PREP - SAVE - REC;

  const [a, b] = await sendTwo(row.photos, step, PREP, UP);

  const saved = PREP + UP;
  step({ at: saved, to: saved + SAVE * 0.9, word: "Saving the row" });
  const made = await api<{ id: string }>("/api/row100k/rows", { body: { day: row.day, meters: row.meters, seconds: row.seconds, title: row.title, photos: [a, b] } });
  /* The caption goes on once the row exists; a row is not lost for it. */
  if (row.caption?.trim()) await api("/api/row100k/app/row", { body: { id: made.id, caption: row.caption } }).catch(() => null);
  let recorded = false;
  if (row.doc) {
    step({ at: saved + SAVE, to: saved + SAVE + REC * 0.9, word: "Saving the recording" });
    try {
      await api("/api/row100k/app/erg", { body: { doc: row.doc, entryId: made.id } });
      recorded = true;
    } catch {
      /* The row is logged; the recording stays on the phone for the read. */
    }
  }
  step({ at: 1, to: 1, word: "Logged" });
  return { id: made.id, recorded };
}

/* WHAT GOES ON A ROW THAT IS ALREADY LOGGED (a row off the monitor, which
 * logs itself with no photos: autolog.ts): the two photos, a title typed
 * over the one the site gave it, the words under it, another day. Any of
 * them, or none. The same bar as a row going in whole. The row's meters and
 * time ride along because the site's edit asks for the whole row
 * (api/row100k/rows/[id]); they are the ones it already has. */
export type RowFinish = { id: string; day: string; meters: number; seconds: number; title?: string; caption?: string; photos?: [Picked, Picked] };

export async function finishRow(row: RowFinish, step: (p: Progress) => void): Promise<void> {
  const PREP = row.photos ? 0.12 : 0;
  const SAVE = row.photos ? 0.12 : 1;
  const UP = 1 - PREP - SAVE;
  let keys: [string, string] | undefined;
  if (row.photos) {
    try {
      keys = await sendTwo(row.photos, step, PREP, UP);
    } catch (err) {
      /* The words a photo fails with were written for a row that does not
       * exist yet ("nothing was logged"). This one does. */
      const said = err instanceof Error ? err.message.replace(/[;.]? ?nothing was logged\.?/i, ".") : "The photos could not be sent.";
      throw new Error(`${said} The row itself is logged; try the photos again.`);
    }
  }
  const at = PREP + UP;
  step({ at, to: at + SAVE * 0.9, word: keys ? "Putting the photos on the row" : "Saving" });
  await api(`/api/row100k/rows/${row.id}`, { method: "PATCH", body: { day: row.day, meters: row.meters, seconds: row.seconds, ...(row.title !== undefined ? { title: row.title } : {}), ...(keys ? { photos: keys } : {}) } });
  if (row.caption?.trim()) await api("/api/row100k/app/row", { body: { id: row.id, caption: row.caption } }).catch(() => null);
  step({ at: 1, to: 1, word: "Saved" });
}

/* The day the site calls today: Pacific, the fixed seven hours its boards
 * and its validation use. */
export function pacificToday(now = Date.now()): string {
  return new Date(now - 7 * 3600_000).toISOString().slice(0, 10);
}

export function shiftDay(day: string, by: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
}
