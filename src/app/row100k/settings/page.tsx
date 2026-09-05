import type { Metadata } from "next";
import { fmtRowerNumber, parseDivision } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { EditProfile } from "../EditProfile";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings — 100K September",
  robots: { index: false, follow: false },
};

/* The rower's settings — name on the board, Instagram, which board — on
 * their own page behind the account menu (owner call, 2026-09-05: "a
 * settings page, not on the profile"). Nothing here 404s: signed out gets
 * told to sign in (the chip in the bar does it), signed in but not joined
 * gets pointed at the join form, and a rower gets the form. */
export default async function SettingsPage() {
  const viewer = await resolveViewer();
  const me = viewer.me;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Settings</h2>
            <span className="mono">
              {me ? `ROWER ${fmtRowerNumber(me.rowerNumber)}` : "YOUR ENTRY ON THE BOARD"}
            </span>
          </div>

          {!viewer.actor ? (
            <p className="board-empty">SIGN IN TO EDIT YOUR SETTINGS — THE CHIP IN THE BAR, TOP RIGHT.</p>
          ) : !me ? (
            <p className="board-empty">
              YOU HAVE NOT JOINED YET.{" "}
              <a href="/row100k#join" style={{ color: "var(--water)" }}>
                JOIN THE CHALLENGE →
              </a>
            </p>
          ) : (
            <>
              <EditProfile
                name={me.displayName}
                instagram={me.instagram}
                division={parseDivision(me.division)}
              />
              <p className="board-empty" style={{ paddingBottom: 0 }}>
                YOUR NUMBER AND YOUR LOG STAY PUT — THIS ONLY CHANGES WHAT THE BOARD PRINTS.{" "}
                <a href={`/row100k/r/${me.rowerNumber}`} style={{ color: "var(--water)" }}>
                  MY PROFILE →
                </a>
              </p>
            </>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
