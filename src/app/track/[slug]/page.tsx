import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TRACKER_PUBLIC, devTitle, gateTrackerPage, trackerReadAllowed } from "@/lib/tracker/gate";
import { baseCss, fontClass } from "../theme";
import { publicCss } from "./publicCss";
import { TrackerApp } from "./TrackerApp";
import type { InitialEvent } from "./tabs/shared";

/* THE PUBLIC SPECTATOR PAGE — /track/<slug> (TRACKER_SPEC.md §11).
 *
 * The server does two things: the gate, and the event shell (name, units,
 * zone, start, the entries' names and colours) so the first paint has a
 * header and one quiet card per entry. Everything live comes from the
 * snapshot the client polls (§3: spectators read one cached file).
 *
 * IN DEVELOPMENT (owner, 2026-10-06: "push any pages once they are live
 * but gate them behind the admin", and the standing CLAUDE.md rule): a 404
 * in production for anyone who is not an admin, open on a laptop —
 * gateTrackerPage() in src/lib/tracker/gate.ts. When the owner says live:
 * flip TRACKER_PUBLIC there and the "(dev)" tag and the DEV pill go with it. */

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#101214" };

type Params = { params: { slug: string } };

async function loadShell(slug: string): Promise<InitialEvent | null> {
  const ev = await db.trackerEvent.findUnique({
    where: { id: slug },
    include: { entries: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, shortName: true, color: true } } },
  });
  if (!ev) return null;
  return {
    slug: ev.id,
    name: ev.name,
    kind: ev.kind === "solo" ? "solo" : "relay",
    units: ev.units === "metric" ? "metric" : "imperial",
    timezone: ev.timezone,
    start_time: ev.startTime.toISOString(),
    public_delay_s: ev.publicDelayS,
    entries: ev.entries.map((e) => ({ id: e.id, name: e.name, short_name: e.shortName, color: e.color })),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  // Not even the event name leaks to a viewer the gate will 404.
  const { allowed } = await trackerReadAllowed();
  const ev = allowed ? await db.trackerEvent.findUnique({ where: { id: params.slug }, select: { name: true } }) : null;
  return {
    title: devTitle(`${ev?.name ?? "Live tracker"} — Live`),
    description: ev ? `Where the runners are right now: ${ev.name}.` : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function TrackPage({ params }: Params) {
  const { admin } = await gateTrackerPage();
  const initial = await loadShell(params.slug);
  if (!initial) notFound();

  return (
    <div className={`trk ${fontClass}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss + publicCss }} />
      <TrackerApp slug={initial.slug} initial={initial} admin={admin} dev={!TRACKER_PUBLIC} />
    </div>
  );
}
