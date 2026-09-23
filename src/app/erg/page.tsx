import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ergPageOpen, ergViewer } from "./gate";
import { MonitorList } from "./MonitorList";
import { ErgShell } from "./Shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monitors — Erg telemetry",
  robots: { index: false, follow: false },
};

/* MONITORS (owner, 2026-09-17: "a telemetry screen where I can connect
 * multiple ergs at the same time"). The front door of the erg product:
 * every monitor paired in this tab, one ROW each (owner, same day: "I want
 * them to be more horizontal than cards"), and the way into any one of
 * them. Live surface, so it wears the ink ground and the chrome inverts
 * with it.
 *
 * ONE PAGE, TWO VIEWS. The list and an erg console are both MonitorList —
 * opening an erg swaps the view rather than following a route, so nothing
 * that holds a Bluetooth link ever remounts and BACK TO MONITORS costs
 * nothing. The heading and the copy live in there with the list for the
 * same reason: they belong to the list, not to the console.
 *
 * TWO QUERIES, both of which only set where this page opens:
 *   ?erg=SOMEID   the console for that erg, which is what each row links
 *                 to — so a row can be opened in a tab. A tab that has
 *                 never paired that monitor has no such slot and lands on
 *                 the list, which is the honest answer.
 *   ?play=SOMEID  the console onto a playback of that saved session, so a
 *                 link from anywhere else lands on the row playing.
 *   ?board=1      the race board; ?board=tv the same lanes on the
 *                 television, and &look=a|b|c picks one of its three looks.
 *
 * Nothing on this page knows what a challenge is. The BAR does — it is the
 * site bar now (owner, same day: "when it goes live it will probably just
 * be another header on the Rowtember site") — but the page under it is a
 * tool for reading an erg and nothing else. */
export default async function ErgMonitorsPage({ searchParams }: { searchParams?: { play?: string | string[]; erg?: string | string[]; board?: string | string[]; look?: string | string[] } }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();

  const one = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw) ?? null;

  return (
    <ErgShell ground="ink">
      {/* Signed out, the page still pairs, simulates and plays back — the
        * gym path runs off npm run dev with nobody signed in. Only SAVE
        * needs an account, and the foot of the list says so. */}
      <MonitorList playId={one(searchParams?.play)} ergId={one(searchParams?.erg)} board={one(searchParams?.board)} look={one(searchParams?.look)} signedIn={v.signedIn} />

    </ErgShell>
  );
}
