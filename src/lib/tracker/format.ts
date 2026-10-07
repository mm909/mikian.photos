/**
 * Display formatting for the tracker. Isomorphic (no server imports), used
 * by the /track pages and the snapshot's human-readable bits. The data is
 * metres and seconds; THIS is where units become miles or kilometres.
 */

import type { Units } from "./types";

export const MI = 1609.344;

/** 93 800 m → "58.3 mi" | "93.8 km". `decimals` defaults to 1. */
export function fmtDist(m: number | null | undefined, units: Units, decimals = 1): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  const v = units === "imperial" ? m / MI : m / 1000;
  return `${v.toFixed(decimals)} ${units === "imperial" ? "mi" : "km"}`;
}

/** Number only, no unit: for big numerals with the unit set as a label. */
export function distValue(m: number, units: Units, decimals = 1): string {
  const v = units === "imperial" ? m / MI : m / 1000;
  return v.toFixed(decimals);
}

export function distUnit(units: Units): string {
  return units === "imperial" ? "mi" : "km";
}

/** Seconds per km → seconds per display unit. */
export function paceInUnits(sPerKm: number, units: Units): number {
  return units === "imperial" ? sPerKm * (MI / 1000) : sPerKm;
}

/** 264 s/km → "7:05 /mi" | "4:24 /km". */
export function fmtPace(sPerKm: number | null | undefined, units: Units): string {
  if (sPerKm === null || sPerKm === undefined || !Number.isFinite(sPerKm) || sPerKm <= 0) return "—";
  const s = Math.round(paceInUnits(sPerKm, units));
  if (s > 3600 * 3) return "—";
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")} /${distUnit(units)}`;
}

/** 33 320 s → "9:15:20"; 920 → "15:20". Always at least m:ss. */
export function fmtDuration(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "—";
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** "20 s ago", "12 min ago", "2 h 5 min ago". */
export function fmtAgo(ageS: number | null | undefined): string {
  if (ageS === null || ageS === undefined || !Number.isFinite(ageS)) return "—";
  const s = Math.max(0, Math.round(ageS));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min ago` : `${h} h ago`;
}

/** "in 12 min", "in 2 h 5 min". Negative → fmtAgo. */
export function fmtIn(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "—";
  if (s < 0) return fmtAgo(-s);
  const m = Math.round(s / 60);
  if (m < 1) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `in ${h} h ${rm} min` : `in ${h} h`;
}

/** Wall clock in the event's zone: "3:42 PM". */
export function fmtClock(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(d);
  }
}

/** "3:42 PM" or, on another day than `ref`, "Sat 3:42 PM". */
export function fmtClockDay(iso: string | null | undefined, timeZone: string, ref?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const r = ref ? new Date(ref) : null;
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone };
  if (r && dayKey(d, timeZone) !== dayKey(r, timeZone)) opts.weekday = "short";
  try {
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  } catch {
    delete opts.timeZone;
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  }
}

function dayKey(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** "3:42–3:58 PM" for an ETA window. */
export function fmtClockRange(a: string | null | undefined, b: string | null | undefined, timeZone: string): string {
  if (!a || !b) return "—";
  const fa = fmtClock(a, timeZone);
  const fb = fmtClock(b, timeZone);
  const [ta, pa] = splitAmPm(fa);
  const [tb, pb] = splitAmPm(fb);
  if (pa && pa === pb) return `${ta}–${tb} ${pa}`;
  return `${fa}–${fb}`;
}

function splitAmPm(s: string): [string, string] {
  const m = /^(.*?)\s*(AM|PM)$/i.exec(s);
  return m ? [m[1], m[2].toUpperCase()] : [s, ""];
}

/** "Fri, Oct 23 · 5:00 AM" */
export function fmtDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(d);
    return `${day} · ${fmtClock(iso, timeZone)}`;
  } catch {
    return d.toLocaleString();
  }
}

/** 58.49 → "58%" */
export function fmtPercent(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return `${Math.round(Math.max(0, Math.min(100, p)))}%`;
}

/** Seconds between two ISO instants (b − a). */
export function secondsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 1000;
}
