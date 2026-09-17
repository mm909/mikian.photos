import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ergPageOpen, ergViewer } from "./gate";

/* THE ERG PRODUCT (owner, 2026-09-17: "let us build the post hoc analysis
 * screen and keep Rowtember out of it — these things should be a little
 * disjoint"). Everything under /erg is one thing: connect as many PM5
 * monitors as there are ergs in the room, watch any one of them, save each
 * one on its own, play a saved row back, and read a finished piece
 * afterwards. No challenge, no rower number, no board.
 *
 * THE CHROME MOVED OUT OF HERE (owner, same day, after using it: "it does
 * not need to be its own page at the moment — we will leave it in the
 * drop-down menu for now, but when it goes live it will probably just be
 * another header on the Rowtember site"). The layout no longer wraps the
 * pages in a ground and a sheet, because a page picks its own: ink for the
 * live screens, paper for the review ones, and the site bar and footer come
 * with either. Shell.tsx is that wrapper; this file is only the door.
 *
 * THE DOOR IS HERE as well as on each page, so a page added later cannot be
 * public by accident: local dev open, production admin only. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Erg telemetry",
  robots: { index: false, follow: false },
};

export default async function ErgLayout({ children }: { children: React.ReactNode }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();

  return <>{children}</>;
}
