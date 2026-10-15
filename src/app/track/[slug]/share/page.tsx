import type { Metadata, Viewport } from "next";
import { Archivo_Black } from "next/font/google";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TRACKER_PUBLIC, devTitle, gateTrackerPage, trackerReadAllowed } from "@/lib/tracker/gate";
import { baseCss, fontClass } from "../../theme";
import type { Shell } from "../../shareCards";
import { shareCss } from "./shareCss";
import { ShareApp } from "./ShareApp";

/* STICKERS — /track/<slug>/share (owner, 2026-10-15: "share a sticker
 * that's No Shortcuts and Just Friends … create several and we can remove
 * the ones we don't like").
 *
 * The server does the gate and hands over the event shell (name, units,
 * zone, start) so THE MARK paints before any snapshot; everything with a
 * number in it comes from the snapshot the client polls, exactly like the
 * public page. Same gate as that page (gateTrackerPage: a 404 in
 * production for anyone who is not an admin while the tracker is in
 * development, open on a laptop) and the same dark theme. */

/* Archivo Black: the LASD page's headline face and the nearest thing to
 * the Just Friends wordmark. The tracker's own faces (Barlow Condensed,
 * Barlow, IBM Plex Mono) come with fontClass. */
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--trk-black",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#101214" };

type Params = { params: { slug: string } };

async function loadShell(slug: string): Promise<Shell | null> {
  // A database blip is a 404, not a crash (the page has nothing to say
  // without the event anyway).
  const ev = await db.trackerEvent
    .findUnique({
      where: { id: slug },
      select: { id: true, name: true, units: true, timezone: true, startTime: true },
    })
    .catch((err) => {
      console.error("track/share: event lookup failed", err);
      return null;
    });
  if (!ev) return null;
  return {
    slug: ev.id,
    name: ev.name,
    units: ev.units === "metric" ? "metric" : "imperial",
    timezone: ev.timezone,
    start_time: ev.startTime.toISOString(),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  // Not even the event name leaks to a viewer the gate will 404.
  const { allowed } = await trackerReadAllowed();
  const ev = allowed ? await db.trackerEvent.findUnique({ where: { id: params.slug }, select: { name: true } }).catch(() => null) : null;
  return {
    title: devTitle(`${ev?.name ?? "Live tracker"} — Stickers`),
    description: ev ? `Story stickers from the live tracker: ${ev.name}.` : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: Params) {
  await gateTrackerPage();
  const shell = await loadShell(params.slug);
  if (!shell) notFound();

  return (
    <div className={`trk ${fontClass} ${archivoBlack.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss + shareCss }} />
      <ShareApp shell={shell} dev={!TRACKER_PUBLIC} />
    </div>
  );
}
