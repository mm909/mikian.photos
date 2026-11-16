"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tspApi } from "@/lib/tsp/paths";
import { etaPlan, planClock, progressOf, type Leg } from "@/lib/tsp/legs";
import type { OtherVan, PositionView } from "@/lib/tsp/positions";
import { MI, snapToCourse, type CourseFile } from "../course";

/**
 * What the MAP, the TURNS page and the PLAN page share: the course file, the
 * 20-second poll that brings the dots and the plan, and the team's clock —
 * where the team is, and when it reaches any point on the course with every
 * leg at its runner's target pace (lib/tsp/legs.ts planClock / etaPlan).
 */

export type MemberLite = { id: string; name: string; role: "runner" | "crew"; paceSec: number | null; squad: number; placeholder: boolean };
export type TeamClock = { startAt: string | null; planPaceSec: number; shareVan: boolean };
export type LiveData = { positions: PositionView[]; others: OtherVan[]; legs: Leg[]; team: TeamClock };

export const STALE_MS = 5 * 60 * 1000;

/** A colour per runner, in roster order; none of them the course's own sky blue. */
export const RUNNER_COLORS = ["#E4572E", "#2E933C", "#8E44AD", "#F2A900", "#D81B60", "#00897B", "#3949AB", "#6D4C41", "#7CB342", "#C2185B", "#0097A7", "#EF6C00"];
export const NOBODY_COLOR = "#8C8B85";

export function colorsOf(members: MemberLite[]): Map<string, string> {
  const out = new Map<string, string>();
  // By id, so a runner keeps their colour when someone joins or the roster reorders.
  const byId = (a: MemberLite, b: MemberLite) => (a.id < b.id ? -1 : 1);
  const runners = members.filter((m) => m.role === "runner").sort(byId);
  [...runners, ...members.filter((m) => m.role !== "runner").sort(byId)].forEach((m, i) => out.set(m.id, RUNNER_COLORS[i % RUNNER_COLORS.length]));
  return out;
}

export const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function agoText(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ${min % 60} min ago`;
}

/** The course file, re-read when its address changes (a fixed stretch saves under a new one). */
export function useCourse(url: string): { course: CourseFile | null; failed: boolean } {
  const [course, setCourse] = useState<CourseFile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    setFailed(false);
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: CourseFile) => {
        if (!dead) setCourse(c);
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
    };
  }, [url]);
  return { course, failed };
}

/** The poll: GET /positions every 20 s while the tab is in front. */
export function useLive(slug: string, initial: LiveData, nowMs: number): { data: LiveData; now: number; refresh: () => Promise<void> } {
  const [data, setData] = useState<LiveData>(initial);
  const [now, setNow] = useState(nowMs);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(tspApi(slug, "/positions"), { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean } & LiveData;
      if (res.ok && j.ok) setData({ positions: j.positions, others: j.others, legs: j.legs, team: j.team });
    } catch {
      /* the next tick tries again */
    }
    setNow(Date.now());
  }, [slug]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);
  return { data, now, refresh };
}

/** Where the team is and when it gets anywhere. */
export function useClock(course: CourseFile | null, data: Pick<LiveData, "positions" | "legs" | "team">, members: MemberLite[], now: number) {
  const snapped = useMemo(() => {
    if (!course) return [];
    return data.positions.map((p) => ({ p, snap: snapToCourse(course, p.lat, p.lon), stale: now - Date.parse(p.at) > STALE_MS }));
  }, [course, data.positions, now]);

  /** The team's place on the course: the RUNNING phone if it is on the course, else the van furthest along. */
  const lead = useMemo(() => {
    const on = snapped.filter((s) => s.snap.offM < 1.5 * MI);
    const r = on.find((s) => s.p.kind === "runner");
    if (r) return r;
    return on.filter((s) => s.p.kind === "van").sort((a, b) => b.snap.m - a.snap.m)[0] ?? null;
  }, [snapped]);

  const startMs = data.team.startAt ? Date.parse(data.team.startAt) : null;
  const progress = useMemo(
    () => progressOf({ startMs, planPaceSec: data.team.planPaceSec, atCm: lead ? Math.round((lead.snap.m / MI) * 100) : null, atMs: lead ? Date.parse(lead.p.at) : null }),
    [startMs, data.team.planPaceSec, lead],
  );
  const clock = useMemo(() => {
    const pace = new Map(members.map((m) => [m.id, m.paceSec] as const));
    return planClock(data.legs, (id) => (id ? pace.get(id) ?? null : null), data.team.planPaceSec);
  }, [data.legs, data.team.planPaceSec, members]);
  /** When the team reaches a point (hundredths of a mile), ms, or null. */
  const etaCm = useCallback((cm: number) => etaPlan(clock, progress, startMs, cm), [clock, progress, startMs]);
  const eta = useCallback((m: number) => etaCm(Math.round((m / MI) * 100)), [etaCm]);
  return { snapped, lead, startMs, progress, clock, eta, etaCm };
}
