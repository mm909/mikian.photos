import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { crewKeyOk, devTitle, gateTrackerPage } from "@/lib/tracker/gate";
import { clientShell, loadEventShell } from "@/lib/tracker/eventData";
import { baseCss, fontClass } from "../../theme";
import { crewCss } from "../../crewCss";
import { KeyWall } from "../crew/ui";
import { VanApp } from "./VanApp";

/* /track/[slug]/van?k=<crew key> — the support van's phone as a position
 * source (TRACKER_SPEC.md §11 Van). Same gates as the crew page: admin-only
 * in production while in development (CLAUDE.md), the crew key as the
 * spec's own door. The van posts through /api/track/[slug]/ingest/web with
 * the same key. */

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shell = await loadEventShell(params.slug).catch(() => null);
  return {
    title: devTitle(`Van — ${shell?.name ?? params.slug}`),
    robots: { index: false, follow: false },
  };
}

export default async function VanPage({ params, searchParams }: Props) {
  const { admin } = await gateTrackerPage();
  const shell = await loadEventShell(params.slug);
  if (!shell) notFound();
  const k = keyOf(searchParams);
  const key = k && crewKeyOk(shell.crewKey, k) ? k.trim() : null;

  return (
    <div className={`trk ${fontClass}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss + crewCss }} />
      {key ? <VanApp shell={clientShell(shell)} crewKey={key} admin={admin} /> : <KeyWall />}
    </div>
  );
}
