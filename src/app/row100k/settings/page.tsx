import type { Metadata } from "next";
import { db } from "@/lib/db";
import { birthdayInput, fmtRowerNumber, parseDivision } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { EditProfile } from "../EditProfile";
import { AboutYou } from "./AboutYou";
import { LightsOutView } from "./LightsOutView";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings — 100K September",
  robots: { index: false, follow: false },
};

/* The rower's settings — name on the board, Instagram, which board — on
 * their own page behind the account menu (owner call, 2026-09-05: "a
 * settings page, not on the profile"), and since 2026-09-24 an ABOUT YOU
 * block under it (birthday, height, weight — owner: "height and weight
 * optional, in the settings page"; home gym since 2026-09-25; none of it
 * printed anywhere). Nothing here 404s: signed out gets told to sign in
 * (the chip in the bar does it), signed in but not joined gets pointed at
 * the join form, and a rower gets the forms. */

/* What the About you block needs, or ok:false while the columns are
 * not in the database yet. */
type About =
  | { ok: true; birthday: Date | null; heightCm: number | null; weightKg: number | null; homeGym: string | null }
  | { ok: false };

/* ABOUT YOU, read here and only here (see ViewerParticipant for why the
 * shared viewer select leaves these out). CAUGHT (owner, 2026-09-25: the
 * page threw while the new columns were not in the database): a failed
 * read — P2022, or anything else — drops the block and prints one quiet
 * line in its place, and the rest of settings works. A form that would
 * fail on save is worse than no form. */
async function readAbout(id: string): Promise<About> {
  try {
    const row = await db.rowParticipant.findUnique({
      where: { id },
      select: { birthday: true, heightCm: true, weightKg: true, homeGym: true },
    });
    if (!row) return { ok: false };
    return { ok: true, ...row };
  } catch (err) {
    console.error("row100k/settings: the About you columns could not be read (not pushed yet?)", err);
    return { ok: false };
  }
}

export default async function SettingsPage() {
  const viewer = await resolveViewer();
  const me = viewer.me;
  const about: About = me ? await readAbout(me.id) : { ok: false };

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
              {about.ok ? (
                <AboutYou
                  participantId={me.id}
                  birthday={birthdayInput(about.birthday)}
                  heightCm={about.heightCm}
                  weightKg={about.weightKg}
                  homeGym={about.homeGym ?? ""}
                />
              ) : (
                <p className="board-empty" style={{ paddingBottom: 0 }}>
                  THE PROFILE FIELDS — BIRTHDAY, HEIGHT, WEIGHT, HOME GYM — ARE NOT AVAILABLE YET.
                </p>
              )}
            </>
          )}

          {/* THE ADMIN'S OWN VIEW OF LIGHTS OUT (owner, 2026-09-21) — nobody
            * else sees this panel. */}
          {viewer.isAdmin && (
            <LightsOutView all={viewer.preview === null} testing={viewer.preview === "elite" || viewer.preview === "public"} />
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
