import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { board100kCss } from "../../board/board100kCss";
import { m2dCss } from "../../m2d/m2dCss";
import { pledgeCss } from "../../m2d/pledge/pledgeCss";
import { pledgeViews, sweepPledges, type PledgeView } from "../../m2dPledgeActions";
import { PledgeAdmin } from "./PledgeAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "M2D pledges (dev) — Rowtember",
  robots: { index: false, follow: false },
};

/* THE OWNER'S PLEDGE LIST (owner, 2026-11-26: "make sure it comes to me to
 * review it, to approve it ... someone just puts in that they're donating
 * $1 billion"). Pending pledges first, each with Approve and Decline; then
 * the approved ones with their fill, and the declined. Opening it sends
 * whatever giver email is due (sweepPledges), as the daily cron does. The
 * email previews are /dev/m2d-pledges/email.
 *
 * The development gate (CLAUDE.md): admin only in production, open in
 * local dev, (dev) in the title, linked from the DEVELOPMENT group. */
export default async function M2dPledgesPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();
  await sweepPledges().catch((err) => console.error("M2D pledges: sweep failed", err));
  const list: PledgeView[] | null = await pledgeViews().catch((err) => {
    console.error("M2D pledges: not read", err);
    return null;
  });
  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <style>{pledgeCss}</style>
      <RowBar {...barProps(viewer)} />
      <main className="bd m2 m2-give">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>M2D · Pledges</b>
            <span>Owner only</span>
          </h1>
          <p className="pl-links">
            <a href="/m2d/pledge">The pledge page ›</a>
            <a href="/dev/m2d-pledges/email?e=welcome" target="_blank">Welcome email ›</a>
            <a href="/dev/m2d-pledges/email?e=claimed" target="_blank">Claimed email ›</a>
            <a href="/dev/m2d-pledges/email?e=close" target="_blank">Close email ›</a>
          </p>
          {list ? (
            <PledgeAdmin initial={list} />
          ) : (
            <p className="bd-say" role="alert">
              The pledges could not be read.
            </p>
          )}
        </div>
      </main>
      <RowFooter front />
    </div>
  );
}
