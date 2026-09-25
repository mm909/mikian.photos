import type { Metadata } from "next";
import { db } from "@/lib/db";
import { birthdayInput, fmtRowerNumber, parseDivision } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { SettingsForm } from "./SettingsForm";
import { settingsCss } from "./settingsCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings — Rowtember",
  robots: { index: false, follow: false },
};

/* The rower's settings on their own page behind the account menu (owner
 * call, 2026-09-05: "a settings page, not on the profile"). ONE BLOCK since
 * 2026-09-25 (owner: "Combine the two blocks (settings and about you) into
 * one. Make the settings save automatically on change — no SAVE CHANGES
 * button"): first name, last name, name on the board, Instagram, the
 * board, birthday, height, weight, home gym — SettingsForm.tsx, each field
 * saving itself. The admin's lights-out switch that sat under it moved to
 * /row100k/blackout the same day (owner: "move the lights-out setting to
 * the lights-out page"). Nothing here 404s: signed out gets told to sign
 * in (the chip in the bar does it), signed in but not joined gets pointed
 * at the join form, and a rower gets the form. */

/* What the About you fields need, or null while the columns are not in
 * the database yet. */
type About = { birthday: string; heightCm: number | null; weightKg: number | null; homeGym: string } | null;

/* ABOUT YOU, read here and only here (see ViewerParticipant for why the
 * shared viewer select leaves these out). CAUGHT (owner, 2026-09-25: the
 * page threw while the new columns were not in the database): a failed
 * read — P2022, or anything else — drops those fields and prints one quiet
 * line in their place, and the rest of settings works. A field that would
 * fail on save is worse than no field. */
async function readAbout(id: string): Promise<About> {
  try {
    const row = await db.rowParticipant.findUnique({
      where: { id },
      select: { birthday: true, heightCm: true, weightKg: true, homeGym: true },
    });
    if (!row) return null;
    return {
      birthday: birthdayInput(row.birthday),
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      homeGym: row.homeGym ?? "",
    };
  } catch (err) {
    console.error("row100k/settings: the About you columns could not be read (not pushed yet?)", err);
    return null;
  }
}

export default async function SettingsPage() {
  const viewer = await resolveViewer();
  const me = viewer.me;
  const about: About = me ? await readAbout(me.id) : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{settingsCss}</style>

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
              <SettingsForm
                participantId={me.id}
                displayName={me.displayName}
                instagram={me.instagram}
                division={parseDivision(me.division)}
                googleName={viewer.actor.name}
                about={about}
              />
              <p className="se-foot">
                <a href={`/row100k/r/${me.rowerNumber}`}>Profile →</a>
              </p>
            </>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
