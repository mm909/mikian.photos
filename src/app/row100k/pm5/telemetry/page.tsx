import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { tmCss } from "./tmCss";
import { Telemetry } from "./Telemetry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PM5 telemetry — 100K September",
  robots: { index: false, follow: false },
};

/* PM5 TELEMETRY (owner, 2026-09-17: a live telemetry screen like a rocket
 * launch). One Concept2 RowErg, one PM5, every number the monitor
 * broadcasts over Bluetooth decoded and charted as it happens. Disjoint
 * from race day: no board, no lanes, no submitting — that is /row100k/pm5.
 * Same gate as that page: admin only in production, open in local dev
 * without a session. Ink top to bottom, like race day: chrome-ink takes the
 * bar and the footer, .tm-dark paints the middle. */
export default async function Pm5TelemetryPage() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the dev branch below still opens */
  }
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  return (
    <div className={`row100k chrome-ink ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{tmCss}</style>
      <RowBar />

      <div className="tm-dark">
        <section>
          <div className="wrap tm-wrap">
            <div className="sec-head">
              <h2>PM5 telemetry</h2>
              <span className="mono">
                TEST · ONE ERG · EVERY NUMBER THE MONITOR SENDS · <Link href="/row100k/pm5">race board ←</Link>
              </span>
            </div>

            {/* What this is and the three things that have to be true
             * before a monitor shows up. The menu path is from the Concept2
             * spec; newer firmware may say Menu → Connect. */}
            <p className="tm-copy">
              <b>A live telemetry screen for one erg</b> — the status packets, every stroke, the force curve, the
              splits and the end-of-piece summary, decoded off the wire and charted as they arrive. <b>Chrome or
              Edge</b> on a laptop or Android, or <b>Bluefy</b> on an iPhone, over https or localhost. On the
              monitor: set up the piece, then Main Menu → More Options → <b>Turn Wireless ON</b> and leave it on
              the workout screen. <b>One app per monitor:</b> if ErgData on a phone is linked to this erg, this
              page cannot see it. Do not pair the PM5 in the laptop&apos;s Bluetooth settings; the CONNECT button
              does it. <b>Nothing here touches the race board</b> — SIMULATE shows the whole console with no
              monitor in the room. <b>The recording lives in this tab only</b> until EXPORT JSON: a reload, a
              swipe back or a closed tab takes it with it (the browser asks first while it is unexported).
            </p>

            <Telemetry />
          </div>
        </section>
      </div>

      <RowFooter />
    </div>
  );
}
