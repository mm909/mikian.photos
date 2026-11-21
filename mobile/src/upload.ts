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
 * recording to api/row100k/app/erg, tied to the row. */

export type Picked = { uri: string; width: number; height: number };

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

async function shrink(p: Picked, edge: number, compress: number): Promise<Blob> {
  const wide = p.width >= p.height;
  const long = Math.max(p.width, p.height);
  const out = await manipulateAsync(p.uri, long > edge ? [{ resize: wide ? { width: edge } : { height: edge } }] : [], { compress, format: SaveFormat.JPEG });
  return (await fetch(out.uri)).blob();
}

async function put(url: string, blob: Blob): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob });
  } catch {
    /* No signal, or (in a browser on a laptop) the storage refusing an
     * address it does not know. Nothing was logged; the form keeps the row. */
    throw new Error("The photo could not be sent. Check the connection and try again; nothing was logged.");
  }
  if (!res.ok) throw new Error(`The photo did not upload (${res.status}). Nothing was logged.`);
}

/* One photo up; answers its key. The thumb is best effort, as on the site. */
async function upload(p: Picked): Promise<string> {
  const main = await shrink(p, 1600, 0.82);
  const signed = await api<{ key: string; url: string }>("/api/row100k/photos/sign", { body: { contentType: "image/jpeg", contentLength: main.size } });
  await put(signed.url, main);
  try {
    const thumb = await shrink(p, 320, 0.7);
    const t = await api<{ url: string }>("/api/row100k/photos/sign", { body: { contentType: "image/jpeg", contentLength: thumb.size, thumbFor: signed.key } });
    await put(t.url, thumb);
  } catch {
    /* A row without a thumb shows its full photo. */
  }
  return signed.key;
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
  const key = await upload(p);
  await api("/api/row100k/app/settings", { body: { avatarKey: key } });
}

export type NewRow = { day: string; meters: number; seconds: number; title: string; caption?: string; photos: [Picked, Picked]; doc?: TelemetryDoc };

/* Log it. `step` says where it has got to, for the button. Answers the new
 * row's id and whether the recording went with it. */
export async function logRow(row: NewRow, step: (s: string) => void): Promise<{ id: string; recorded: boolean }> {
  step("Photo 1 of 2");
  const a = await upload(row.photos[0]);
  step("Photo 2 of 2");
  const b = await upload(row.photos[1]);
  step("Logging");
  const made = await api<{ id: string }>("/api/row100k/rows", { body: { day: row.day, meters: row.meters, seconds: row.seconds, title: row.title, photos: [a, b] } });
  /* The caption goes on once the row exists; a row is not lost for it. */
  if (row.caption?.trim()) await api("/api/row100k/app/row", { body: { id: made.id, caption: row.caption } }).catch(() => null);
  let recorded = false;
  if (row.doc) {
    step("Saving the recording");
    try {
      await api("/api/row100k/app/erg", { body: { doc: row.doc, entryId: made.id } });
      recorded = true;
    } catch {
      /* The row is logged; the recording stays on the phone for the read. */
    }
  }
  return { id: made.id, recorded };
}

/* The day the site calls today: Pacific, the fixed seven hours its boards
 * and its validation use. */
export function pacificToday(now = Date.now()): string {
  return new Date(now - 7 * 3600_000).toISOString().slice(0, 10);
}

export function shiftDay(day: string, by: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
}
