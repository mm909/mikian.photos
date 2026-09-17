import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CHALLENGE } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { tmCss } from "./tmCss";
import { Telemetry } from "./Telemetry";
import { listTelemetry } from "./store";
import type { TelemetrySavedRow, TelemetryViewer } from "./session";

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
 * bar and the footer, .tm-dark paints the middle.
 *
 * The viewer is resolved once here (owner, 2026-09-17: the option to save
 * the live telemetry of a row) so SAVE can say why it is off before a
 * click, and their saved rows come down with the first paint — an admin
 * sees everyone's. resolveViewer never throws; the list fails open to
 * nothing, and the client refreshes it after every save or delete. */
export default async function Pm5TelemetryPage() {
  const v = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !v.isAdmin) notFound();

  const viewer: TelemetryViewer = {
    signedIn: v.actor !== null,
    joined: v.myParticipantId !== null,
    isAdmin: v.isAdmin,
    rowerNumber: v.me?.rowerNumber ?? null,
  };

  let rows: TelemetrySavedRow[] = [];
  if (v.isAdmin || v.myParticipantId) {
    try {
      rows = await listTelemetry({ challenge: CHALLENGE, participantId: v.isAdmin ? null : v.myParticipantId });
    } catch (err) {
      console.error("row100k telemetry: saved rows lookup failed, rendering none", err);
    }
  }

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
              monitor in the room. <b>The recording lives in this tab only</b> until EXPORT JSON or <b>SAVE</b>: a
              reload, a swipe back or a closed tab takes it with it (the browser asks first while it is unsaved).
              SAVE keeps the session under your rower number; SAVED ROWS below loads one back into the console.
            </p>

            <Telemetry viewer={viewer} initialRows={rows} />
          </div>
        </section>
      </div>

      <RowFooter />
    </div>
  );
}
