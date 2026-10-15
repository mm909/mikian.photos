import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { crewKeyOk, devTitle, gateTrackerPage } from "@/lib/tracker/gate";
import { clientShell, loadEventShell } from "@/lib/tracker/eventData";
import { baseCss, fontClass } from "../../theme";
import { crewCss } from "../../crewCss";
import { CrewApp } from "./CrewApp";
import { loadSlotInfo } from "./slots";
import { KeyWall } from "./ui";

/* /track/[slug]/crew?k=<crew key> — the handoff page (TRACKER_SPEC.md §11).
 *
 * IN DEVELOPMENT (CLAUDE.md rule, gate.ts): admin-only in production, open
 * on a laptop, noindex, "(dev)" in the title. The crew key is the spec's own
 * door and stays when the page goes public: a missing or wrong key renders
 * a plain wall that never echoes what was given. The key is in the URL on
 * purpose — the crew lead shares one link, and the installed app (manifest
 * route next door) starts at that exact URL. */

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#101214",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type Props = { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> };

function keyOf(sp: Props["searchParams"]): string | null {
  const k = sp.k;
  if (typeof k === "string") return k;
  if (Array.isArray(k)) return k[0] ?? null;
  return null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const shell = await loadEventShell(params.slug).catch(() => null);
  const k = keyOf(searchParams);
  const meta: Metadata = {
    title: devTitle(`Crew — ${shell?.name ?? params.slug}`),
    robots: { index: false, follow: false },
  };
  if (shell && k && crewKeyOk(shell.crewKey, k)) {
    // Installable only with a valid key: the manifest's start_url carries it.
    meta.manifest = `/track/${encodeURIComponent(params.slug)}/manifest.webmanifest?k=${encodeURIComponent(k.trim())}`;
    meta.appleWebApp = { capable: true, statusBarStyle: "black-translucent", title: `${shell.name} crew` };
  }
  return meta;
}

export default async function CrewPage({ params, searchParams }: Props) {
  const { admin } = await gateTrackerPage();
  const shell = await loadEventShell(params.slug);
  if (!shell) notFound();
  const k = keyOf(searchParams);
  const key = k && crewKeyOk(shell.crewKey, k) ? k.trim() : null;
  // Pairs (slots A / B) per entry — the slot picker needs it; see crew/slots.ts.
  const slotInfo = key ? await loadSlotInfo(params.slug) : {};

  return (
    <div className={`trk ${fontClass}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss + crewCss }} />
      {key ? <CrewApp shell={clientShell(shell)} crewKey={key} admin={admin} slotInfo={slotInfo} /> : <KeyWall />}
    </div>
  );
}
