import "server-only";
import { db } from "@/lib/db";
import { TSP_EVENT } from "./paths";

/**
 * WHERE EVERYONE IS (owner, 2026-11-16: "we need to be able to see where the
 * runners and the vans are for our team. We also want the option to
 * broadcast where our van is to other teams. I like the idea of sharing my
 * location with my team whenever I open up the app").
 *
 * A member's phone checks in while the route page is open and sharing
 * (TeamPosition, one row per check-in). What they ARE is their own call:
 *   runner — carrying the baton right now: the team's dot on the course
 *   van    — riding in a van
 *   crew   — anywhere else
 *   off    — stopped sharing: the row that hides their dot
 * The newest row per member inside the window is their dot; an older one
 * means the phone has gone quiet and the page greys it.
 *
 * Other teams see ONE thing, and only when a captain turned it on
 * (TspTeam.shareVan): this team's vans. Never the runner, never the crew.
 */

export const KINDS = ["runner", "van", "crew", "off"] as const;
export type Kind = (typeof KINDS)[number];
export const parseKind = (v: unknown): Kind | null => (v === "runner" || v === "van" || v === "crew" || v === "off" ? v : null);

/** A dot older than this is not drawn at all. */
const WINDOW_MS = 12 * 3600 * 1000;

export type PositionView = { memberId: string; name: string; kind: Kind; lat: number; lon: number; accuracyM: number; at: string };
export type OtherVan = { team: string; teamName: string; name: string; lat: number; lon: number; at: string };

type Row = { memberId: string; name: string; kind: string; lat: number; lon: number; accuracyM: number; at: Date };

function newestPerMember(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of rows) {
    if (seen.has(r.memberId)) continue;
    seen.add(r.memberId);
    out.push(r);
  }
  return out;
}

/** The team's dots: the newest check-in per member, the ones who went "off" left out. */
export async function teamPositions(team: string): Promise<PositionView[]> {
  const rows = await db.teamPosition.findMany({
    where: { team, at: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { at: "desc" },
    take: 4000,
    select: { memberId: true, name: true, kind: true, lat: true, lon: true, accuracyM: true, at: true },
  });
  return newestPerMember(rows)
    .filter((r) => r.kind !== "off")
    .map((r) => ({ memberId: r.memberId, name: r.name, kind: parseKind(r.kind) ?? "crew", lat: r.lat, lon: r.lon, accuracyM: r.accuracyM, at: r.at.toISOString() }));
}

/** The vans the OTHER teams of this crossing have chosen to show. */
export async function otherVans(team: string): Promise<OtherVan[]> {
  const teams = await db.tspTeam.findMany({ where: { event: TSP_EVENT, shareVan: true, NOT: { slug: team } }, select: { slug: true, name: true } });
  if (teams.length === 0) return [];
  const names = new Map(teams.map((t) => [t.slug, t.name] as const));
  const rows = await db.teamPosition.findMany({
    where: { team: { in: teams.map((t) => t.slug) }, at: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { at: "desc" },
    take: 8000,
    select: { team: true, memberId: true, name: true, kind: true, lat: true, lon: true, accuracyM: true, at: true },
  });
  const seen = new Set<string>();
  const out: OtherVan[] = [];
  for (const r of rows) {
    const key = `${r.team}:${r.memberId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.kind !== "van") continue;
    out.push({ team: r.team, teamName: names.get(r.team) ?? r.team, name: r.name, lat: r.lat, lon: r.lon, at: r.at.toISOString() });
  }
  return out;
}

export async function checkIn(args: { team: string; memberId: string; name: string; kind: Kind; lat: number; lon: number; accuracyM: number }): Promise<void> {
  await db.teamPosition.create({ data: args });
}
