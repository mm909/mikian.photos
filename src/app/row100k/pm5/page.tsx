import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { pmCss } from "./pm5Css";
import { Pm5Live } from "./Pm5Live";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PM5 live — 100K September",
  robots: { index: false, follow: false },
};

/* PM5 LIVE (owner, 2026-09-16: a barebones UI to try live results in the
 * gym). Eight Concept2 RowErgs, eight PM5 monitors, one laptop or Android
 * phone on this page: every monitor is paired over Web Bluetooth, its
 * numbers show on a card, and a finish lands on the race board through
 * the same POST the timing console uses. Admin only in production — the
 * rest of the world gets a 404 — and open in local dev without a session,
 * the gate the other DEVELOPMENT pages wear (dev/raceday-results), so the
 * page can be driven on a laptop in the gym off npm run dev:live; the
 * POSTs to the board still need the admin cookie. Everything that talks
 * to a monitor is in Pm5Live.tsx; the bytes are read in src/lib/pm5/pm5.ts
 * — moved out of this folder on 2026-09-17, when the telemetry console
 * left Rowtember for /erg and took the parsers with it. This page is the
 * race-day bridge and stays exactly where it is. */
export default async function Pm5Page() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the dev branch below still opens */
  }
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{pmCss}</style>
      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>PM5 live</h2>
            <span className="mono">
              TEST · BLUETOOTH TO THE RACE BOARD · <Link href="/erg">Erg telemetry →</Link>
            </span>
          </div>

          {/* The three things that have to be true before a monitor shows
           * up here. The menu path is from the Concept2 spec; newer firmware
           * may label it Menu → Connect instead. */}
          <p className="pm-copy">
            <b>On each monitor:</b> set up the piece (Select Workout → 5,000 m), then Main Menu → More
            Options → <b>Turn Wireless ON</b>, which opens the Connect Device screen and starts
            broadcasting. Leave the monitor on its workout screen. <b>One app per monitor:</b> if a racer
            has ErgData open on their phone and it is linked to that erg, this page cannot see it — have
            them close it. <b>Do not pair the PM5 in the laptop&apos;s Bluetooth settings</b>; the browser
            pairs it from the ADD AN ERG button. <b>Chrome or Edge only</b> (laptop, or Android), over https
            or localhost.
          </p>

          {/* What eight identical monitors and a long night do to the plan
           * above: the picker shows eight near-identical names, a laptop
           * that sleeps drops every erg, a monitor that sleeps drops one,
           * and a Windows adapter may not hold eight links at once. */}
          <p className="pm-copy">
            <b>Eight identical names in the picker:</b> turn wireless on one monitor at a time and set its lane
            right after — or pull one stroke and watch which card moves. The serial is on the label on the back
            of the monitor (or More Options → Utilities → Product ID). <b>Keep the laptop plugged in and set
            never to sleep</b>; a sleeping laptop drops every erg at once. <b>A monitor that goes dark between
            waves drops off:</b> wake it, get it back on the Connect Device screen, set the piece up again, then
            press RECONNECT on its card — the lane stays. <b>If the sixth or seventh erg will not connect,</b>{" "}
            the adapter is full: open this page on the phone too and give it the remaining lanes — the board is
            shared through the server, so two devices can feed it at once.
          </p>

          <Pm5Live />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
