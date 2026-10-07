import { NextResponse } from "next/server";
import { crewKeyOk } from "@/lib/tracker/gate";
import { loadEventShell } from "@/lib/tracker/eventData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* GET /track/[slug]/manifest.webmanifest?k=<crew key> — the web app manifest
 * that makes the crew page installable (TRACKER_SPEC.md §11 Crew). It is a
 * route handler, not a static file, because start_url must carry the
 * event's crew key: the installed app opens straight onto the handoff
 * buttons, no link to find at 3 AM.
 *
 * Gated by the crew key alone, not the admin session: browsers fetch a
 * manifest WITHOUT cookies unless the link carries crossorigin=use-credentials,
 * so a cookie gate would make the page uninstallable. The manifest reveals
 * only the event name and the key the caller already supplied. */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const shell = await loadEventShell(params.slug);
  if (!shell) return new NextResponse(null, { status: 404 });
  const k = new URL(req.url).searchParams.get("k");
  if (!k || !crewKeyOk(shell.crewKey, k)) return new NextResponse(null, { status: 404 });

  const slug = encodeURIComponent(params.slug);
  const key = encodeURIComponent(k.trim());
  const manifest = {
    id: `/track/${slug}/crew`,
    name: `${shell.name} crew`,
    short_name: "Crew",
    description: "Handoff taps for the crew. Works without signal; taps are sent when it is back.",
    start_url: `/track/${slug}/crew?k=${key}`,
    scope: `/track/${slug}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#101214",
    theme_color: "#101214",
    icons: [
      { src: "/track/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/track/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
