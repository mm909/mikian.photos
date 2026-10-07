import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { devTitle, gateTrackerPage } from "@/lib/tracker/gate";
import { clientShell, loadEventShell } from "@/lib/tracker/eventData";
import { baseCss, fontClass } from "../../theme";
import { crewCss } from "../../crewCss";
import { JoinApp } from "./JoinApp";

/* /track/[slug]/join — runner setup (TRACKER_SPEC.md §11). No crew key:
 * runners get this link, not the crew's. What the page shows is the Traccar
 * server address (TRACKER_TRACCAR_PUBLIC_URL, e.g. https://host:5055 — the
 * address runners type, which may differ from the REST URL the backfill
 * uses) and each runner's own device identifier from the event file.
 * Admin-only in production while in development (CLAUDE.md, gate.ts). */

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#101214",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shell = await loadEventShell(params.slug).catch(() => null);
  return {
    title: devTitle(`Runner setup — ${shell?.name ?? params.slug}`),
    robots: { index: false, follow: false },
  };
}

export default async function JoinPage({ params }: Props) {
  const { admin } = await gateTrackerPage();
  const shell = await loadEventShell(params.slug);
  if (!shell) notFound();
  const traccarUrl = (process.env.TRACKER_TRACCAR_PUBLIC_URL ?? "").trim() || null;

  return (
    <div className={`trk ${fontClass}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss + crewCss }} />
      <JoinApp shell={clientShell(shell)} traccarUrl={traccarUrl} admin={admin} />
    </div>
  );
}
