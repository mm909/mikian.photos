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
