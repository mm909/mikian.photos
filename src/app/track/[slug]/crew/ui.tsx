"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useOnline } from "../../offlineQueue";

/**
 * Small client pieces the crew, van and join apps share: the sticky header,
 * the online pill, a remembered choice in localStorage, a poll that only
 * runs while the tab is visible, a copy button, the toast, and the "this
 * page needs the crew link" wall. They live under crew/ because that is the
 * folder these three pages are built from; van/ and join/ import from here.
 */

/** True after the first client render — gate anything read from the device (localStorage, clocks). */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/**
 * A choice remembered per device (which team, which van, who am I).
 * `loaded` turns true once localStorage has been read, so the page can show
 * a neutral frame instead of the chooser flashing before the saved value.
 */
export function useStoredChoice(key: string): [string | null, (v: string | null) => void, boolean] {
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      setValue(window.localStorage.getItem(key));
    } catch {
      setValue(null);
    }
    setLoaded(true);
  }, [key]);
  const set = useCallback(
    (v: string | null) => {
      setValue(v);
      try {
        if (v === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, v);
      } catch {
        /* private mode: the choice lives for this page only */
      }
    },
    [key],
  );
  return [value, set, loaded];
}

/** Run `fn` now and every `ms` while the tab is visible; again the moment it becomes visible. */
export function useVisiblePoll(fn: () => void | Promise<void>, ms: number, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      void ref.current();
      timer = window.setInterval(() => void ref.current(), ms);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}

/** Date.now() refreshed every `ms`; 0 until mounted so server and client agree on the first paint. */
export function useTick(ms = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiUrl(slug: string, path: string, key?: string | null): string {
  const base = `/api/track/${encodeURIComponent(slug)}/${path}`;
  return key ? `${base}?k=${encodeURIComponent(key)}` : base;
}

/** "The crew key was refused" for 401/403/404 on a keyed route; "Server error NNN" otherwise. */
export function keyedStatusMessage(status: number): string {
  if (status === 401 || status === 403 || status === 404) return "The crew key was refused — reopen the link the crew lead shared";
  return `Server error ${status}`;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new HttpError(res.status, keyedStatusMessage(res.status));
  return (await res.json()) as T;
}

/* ─── Slots (pairs) ──────────────────────────────────────────────────────── */

/**
 * How many runners an entry has on course at once and what the slots are
 * called (TrackerEntry.slots / slotNames). LASD26 runs in PAIRS (owner,
 * 2026-10-15: "we are running two by two"): one entry, slots A and B. The
 * server pages load it (crew/slots.ts) and pass it down as a plain map.
 */
export interface EntrySlotInfo {
  /** ≥ 1; 1 = a classic relay. */
  slots: number;
  /** Labels per slot, index 0 = slot 1; the number stands in when a label is missing. */
  slotNames: string[];
}

/** Entry id → slot info. */
export type SlotInfoByEntry = Record<string, EntrySlotInfo>;

/** The slot info for one entry; a classic relay (1 slot, no names) when the map has none. */
export function slotInfoOf(info: SlotInfoByEntry | undefined, entryId: string | null | undefined): EntrySlotInfo {
  const i = entryId ? info?.[entryId] : undefined;
  return { slots: Math.max(1, Math.floor(i?.slots ?? 1)), slotNames: i?.slotNames ?? [] };
}

/** "A" for slot 1 of an entry with slot_names ["A", "B"]; "1" without names. */
export function slotNameOf(info: EntrySlotInfo, slot: number): string {
  return info.slotNames[slot - 1] ?? String(slot);
}

/** Green under 2 min, amber under 10, red beyond — the join page's freshness colours. */
export function freshness(ageS: number | null): "ok" | "warn" | "bad" | "" {
  if (ageS === null || !Number.isFinite(ageS)) return "";
  if (ageS < 120) return "ok";
  if (ageS < 600) return "warn";
  return "bad";
}

/* ─── Components ──────────────────────────────────────────────────────────── */

export function OnlinePill() {
  const online = useOnline();
  return (
    <span className={`c-net${online ? "" : " off"}`} aria-live="polite">
      <i aria-hidden="true" /> {online ? "Online" : "No signal"}
    </span>
  );
}

export function TrackHeader({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <header className="c-top">
      <div className="row">
        <div style={{ minWidth: 0 }}>
          <span className="mono c-kicker">{kicker}</span>
          <div className="c-title cond" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

/** Rendered by the server page when ?k= is missing or wrong. Never echoes the key. */
export function KeyWall({ title = "This page needs the crew link", text }: { title?: string; text?: string }) {
  return (
    <div className="c-wall">
      <div>
        <span className="mono">Live tracker · crew</span>
        <h1 className="cond">{title}</h1>
        <p>{text ?? "Open the link the crew lead shared with you — it carries the key. There is nothing to type here."}</p>
      </div>
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Older WebViews: a hidden textarea + execCommand still works.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setDone(ok);
    if (ok) window.setTimeout(() => setDone(false), 1500);
  };
  return (
    <button type="button" className={done ? "done" : undefined} onClick={() => void copy()} aria-label={`${label}: ${text}`}>
      {done ? "Copied" : label}
    </button>
  );
}

export interface ToastState {
  key: number;
  text: string;
  action?: { label: string; onClick: () => void };
}

/** Bottom toast; the owner dismisses it on a timer (CrewApp: 2 s). */
export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div className="c-toast" role="status" aria-live="polite">
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toast.text}</span>
      {toast.action && (
        <button type="button" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
