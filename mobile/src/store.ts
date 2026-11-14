import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TelemetryDoc, TelemetrySavedRow } from "./pm5/session";
import { dayKey } from "./theme";

/* THE LOG, ON THE DEVICE. One row per piece; nothing leaves the phone yet
 * (accounts and the shared board are the next piece of work). */

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

export type Profile = { name: string; dailyGoal: number; monthGoal: number };
export const DEFAULT_PROFILE: Profile = { name: "You", dailyGoal: 5000, monthGoal: 100000 };

const ROWS = "rows/1";
const PROFILE = "profile/1";

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

export async function loadProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE);
    return raw ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE, JSON.stringify(p));
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

/* ---- what the screens read off the log -------------------------------- */

export const metersOn = (rows: Row[], day: string): number => rows.reduce((n, r) => n + (r.day === day ? r.meters : 0), 0);
export const metersInMonth = (rows: Row[], month: string): number => rows.reduce((n, r) => n + (r.day.startsWith(month) ? r.meters : 0), 0);

/* Days in a row with a row logged, ending today (or yesterday, so a streak
 * is not lost before today's row). */
export function streak(rows: Row[], now = new Date()): number {
  const days = new Set(rows.map((r) => r.day));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* The last seven days, oldest first. */
export function week(rows: Row[], now = new Date()): { day: string; letter: string; meters: number; today: boolean }[] {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({ day: key, letter: "SMTWTFS"[d.getDay()], meters: metersOn(rows, key), today: i === 0 });
  }
  return out;
}
