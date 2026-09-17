import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErgBar } from "./ErgBar";
import { ergPageOpen, ergViewer } from "./gate";
import { MonitorList } from "./MonitorList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monitors — Erg telemetry",
  robots: { index: false, follow: false },
};

/* MONITORS (owner, 2026-09-17: "a telemetry screen where I can connect
 * multiple ergs at the same time"). The front door of the erg product:
 * every monitor paired in this tab, one card each, and the way into any one
 * of them. Live surface, so it wears the ink ground.
 *
 * ONE PAGE, TWO VIEWS. The list and an erg console are both MonitorList —
 * opening an erg swaps the view rather than following a route, so nothing
 * that holds a Bluetooth link ever remounts and BACK TO MONITORS costs
 * nothing. The heading and the copy live in there with the list for the
 * same reason: they belong to the list, not to the console.
 *
 * ?play=SOMEID opens the console straight onto a playback of that saved
 * session, so a link from anywhere else lands on the row playing.
 *
 * Nothing on this page knows what a challenge is. That is the point of the
 * move: Rowtember is a thing that happens in September, and this is a tool
 * for reading an erg. */
export default async function ErgMonitorsPage({ searchParams }: { searchParams?: { play?: string | string[] } }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();

  const raw = searchParams?.play;
  const play = (Array.isArray(raw) ? raw[0] : raw) ?? null;

  return (
    <div className="eg-ink">
      <ErgBar active="monitors" viewer={v} />

      <div className="eg-wrap">
        {/* Signed out, the page still pairs, simulates and plays back — the
          * gym path runs off npm run dev with nobody signed in. Only SAVE
          * needs an account, and the list says so up front rather than
          * after forty-five minutes of rowing. */}
        <MonitorList playId={play} signedIn={v.signedIn} />

        <p className="eg-foot">Erg telemetry · Concept2 PM5 over Web Bluetooth · nothing here touches the race board</p>
      </div>
    </div>
  );
}
