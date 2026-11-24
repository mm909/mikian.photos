import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TelemetryDoc, TelemetrySavedRow } from "./pm5/session";

/* THE RECORDINGS ON THIS PHONE. A row is logged to the site (upload.ts);
 * what stays here is each piece the phone itself recorded off an erg, whole,
 * so THE READ can open it and rank it against the others without a round
 * trip. */

export type Row = {
  id: string;
  day: string;
  at: number;
  meters: number;
  seconds: number;
  strokes: number;
  avgWatts: number;
  source: "erg" | "demo" | "manual";
  /* True when the whole piece (strokes, splits, force curves) is stored
   * beside the row, so THE READ can be opened for it. */
  hasDoc?: boolean;
  device?: string;
};

const ROWS = "rows/1";

export async function loadRows(): Promise<Row[]> {
  try {
    const raw = await AsyncStorage.getItem(ROWS);
    const list = raw ? (JSON.parse(raw) as Row[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveRows(rows: Row[]): Promise<void> {
  await AsyncStorage.setItem(ROWS, JSON.stringify(rows));
}

/* The whole piece, one key per row so the list of rows stays small. */
const docKey = (id: string) => `doc/1/${id}`;

export async function saveDoc(id: string, doc: TelemetryDoc): Promise<void> {
  await AsyncStorage.setItem(docKey(id), JSON.stringify(doc));
}

export async function loadDoc(id: string): Promise<TelemetryDoc | null> {
  try {
    const raw = await AsyncStorage.getItem(docKey(id));
    return raw ? (JSON.parse(raw) as TelemetryDoc) : null;
  } catch {
    return null;
  }
}

export async function deleteDoc(id: string): Promise<void> {
  await AsyncStorage.removeItem(docKey(id)).catch(() => null);
}

/* A row in the shape the site's analysis ranks against. */
export function asSaved(r: Row): TelemetrySavedRow {
  const tenths = Math.round(r.seconds * 10);
  return {
    id: r.id,
    device: r.device ?? "PM5",
    simulated: r.source === "demo",
    startedAt: new Date(r.at).toISOString(),
    endedAt: null,
    meters: r.meters,
    tenths,
    strokes: r.strokes,
    avgPaceTenths: r.meters > 0 ? Math.round((tenths / r.meters) * 500) : null,
    avgWatts: r.avgWatts || null,
    avgSpm: null,
    avgHr: null,
    dragFactor: null,
    title: `${r.day} · ${r.meters.toLocaleString("en-US")} m`,
    entryId: null,
    rowerNumber: null,
    createdAt: new Date(r.at).toISOString(),
  };
}

/* ROWS RECORDED AND NOT LOGGED YET (owner, 2026-11-22, of a row he rowed,
 * left the app during and came back to find gone: "is there a way to get
 * that data back?"; "if I go to log a row, maybe there should be a history
 * of all my rows that have been done on a rower").
 *
 * Until that day a piece lived only in the app's memory until LOG: closing
 * the app, or the monitor re-arming, lost it. Now the piece in progress is
 * written here every few seconds and as the app is left (erg/useErg.ts),
 * and it stays until it is logged or the rower deletes it. The log screen
 * lists them (screens/RowScreen.tsx). Nothing here leaves the phone. */
export type Pending = {
  id: string;
  /* When the first packet of the piece arrived, and when it was last written. */
  at: number;
  savedAt: number;
  meters: number;
  seconds: number;
  strokes: number;
  avgWatts: number;
  device: string;
  /* The monitor said the piece was over. */
  ended: boolean;
  hasDoc: boolean;
  /* WHAT A ROW THAT LOGS ITSELF NEEDS TO KNOW (autolog.ts, 2026-11-24).
   * `full`: a set piece rowed to its end, all of its meters or all of its
   * time. `over`: the monitor has gone on to another piece, so this one
   * cannot be picked up again. `refused`: the site would not take it, in
   * the site's own words, so it is not sent again by itself. `dup`: the
   * same piece as a longer recording (the connection dropped and came
   * back), which is the one that is logged. */
  full?: boolean;
  over?: boolean;
  refused?: string;
  dup?: boolean;
};

const PENDING = "pending/1";
const pendingDocKey = (id: string) => `pending-doc/1/${id}`;
/* Under this a piece is a few warm-up pulls, not a row to keep. */
export const PENDING_MIN_M = 100;
/* The most kept; past it the oldest go. */
const PENDING_MOST = 20;

export async function loadPending(): Promise<Pending[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING);
    const list = raw ? (JSON.parse(raw) as Pending[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === "string" && p.meters >= 1) : [];
  } catch {
    return [];
  }
}

/* One write at a time: the timer, the app being left and the monitor
 * re-arming can all ask at once, and each reads the list before it writes. */
let chain: Promise<unknown> = Promise.resolve();
const queued = <T,>(job: () => Promise<T>): Promise<T> => {
  const next = chain.then(job, job);
  chain = next.catch(() => null);
  return next;
};

/* Every write asked for so far has landed: for a reader that must see the
 * piece that was kept a moment ago (autolog.ts). */
export const pendingSettled = (): Promise<unknown> => chain;

/* Who is told when the list changes, so the log screen shows a piece the
 * moment it is kept. */
const pendingSubs = new Set<() => void>();
export function onPending(f: () => void): () => void {
  pendingSubs.add(f);
  return () => {
    pendingSubs.delete(f);
  };
}
const toldPending = () => pendingSubs.forEach((f) => f());

/* Keep a piece, or write over the one with the same id. The document goes
 * first, so a list never names a document that is not there. */
export function putPending(p: Pending, doc?: TelemetryDoc): Promise<void> {
  return queued(async () => {
    if (doc) await AsyncStorage.setItem(pendingDocKey(p.id), JSON.stringify(doc));
    const list = await loadPending();
    const had = list.find((x) => x.id === p.id);
    /* What was noted against the piece stays noted when it is written again. */
    const row: Pending = { ...p, hasDoc: !!doc || !!had?.hasDoc, over: p.over || had?.over, refused: p.refused ?? had?.refused, dup: p.dup || had?.dup };
    const next = [...list.filter((x) => x.id !== p.id), row].sort((a, b) => a.at - b.at);
    const gone = next.length > PENDING_MOST ? next.splice(0, next.length - PENDING_MOST) : [];
    await AsyncStorage.setItem(PENDING, JSON.stringify(next));
    for (const g of gone) await AsyncStorage.removeItem(pendingDocKey(g.id)).catch(() => null);
    toldPending();
  });
}

/* A note against a piece that is kept: the site refused it, or it is the
 * short half of a longer one. */
export function markPending(id: string, note: Partial<Pick<Pending, "refused" | "dup" | "over">>): Promise<void> {
  return queued(async () => {
    const list = await loadPending();
    if (!list.some((x) => x.id === id)) return;
    await AsyncStorage.setItem(PENDING, JSON.stringify(list.map((x) => (x.id === id ? { ...x, ...note } : x))));
    toldPending();
  });
}

/* It was logged, or the rower deleted it. */
export function dropPending(id: string): Promise<void> {
  return queued(async () => {
    const list = await loadPending();
    if (list.some((x) => x.id === id)) await AsyncStorage.setItem(PENDING, JSON.stringify(list.filter((x) => x.id !== id)));
    await AsyncStorage.removeItem(pendingDocKey(id)).catch(() => null);
    toldPending();
  });
}

export async function loadPendingDoc(id: string): Promise<TelemetryDoc | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingDocKey(id));
    return raw ? (JSON.parse(raw) as TelemetryDoc) : null;
  } catch {
    return null;
  }
}
