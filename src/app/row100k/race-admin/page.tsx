import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { currentRace, racePhase } from "../raceday";
import { EMPTY_RACERS, listRacers, type Racer } from "../racedayData";
import { RaceWaves } from "./RaceWaves";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race waves — 100K September",
  robots: { index: false, follow: false },
};

/* Page-local styles — .ra- prefix, theme.ts untouched. Text child of a style
 * tag: no double quotes, angle brackets, apostrophes or ampersands here. */
const raWavCss = `
.row100k .ra-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin:8px 0 0;line-height:1.8}
.row100k .ra-note b{color:var(--ink);font-weight:700}
.row100k .ra-ok{margin-top:14px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--water);line-height:1.7}
.row100k .ra-sec{margin-top:44px}
.row100k .ra-act{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.row100k .ra-act .send{margin-top:0;width:auto;padding:11px 18px;font-size:14px}
.row100k .ra-tabs{margin:16px 0 0}
.row100k .ra-foot{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-top:10px;line-height:1.8}
.row100k .ra-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(208px,1fr));gap:12px;margin-top:4px}
.row100k .ra-wave{border:2px solid var(--ink);padding:12px 14px 14px}
.row100k .ra-wave.open{border-style:dashed;border-color:var(--line)}
.row100k .ra-wave .h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-bottom:1px solid var(--ink);padding-bottom:6px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.row100k .ra-wave.open .h{border-bottom-color:var(--line);color:var(--gray)}
.row100k .ra-wave .h .t{color:var(--water)}
.row100k .ra-wave .f{font-family:var(--row-archivo-black),sans-serif;font-size:28px;line-height:1;margin-top:10px;color:var(--ink)}
.row100k .ra-wave.full .f{color:var(--water)}
.row100k .ra-wave .f .s{font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.12em;color:var(--gray)}
.row100k .ra-wave ul{list-style:none;margin:10px 0 0;padding:0;font-family:var(--row-mono),monospace;font-size:11px;line-height:1.9;color:var(--ink)}
.row100k .ra-wave ul li{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.row100k .ra-wave ul .w{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row100k .ra-wave ul .n{color:var(--gray)}
.row100k .ra-wave ul .d{color:var(--gray);letter-spacing:.1em}
.row100k .ra-wave ul .q{color:var(--gray);white-space:nowrap}
/* The console tables carry a wave picker and a clock time, which no phone
 * column can hold: they keep their width and scroll sideways inside their
 * wrapper rather than squeezing the picker down to its arrow. */
.row100k table.board.ra-t{min-width:540px}
.row100k table.board td.ra-w{width:134px;padding-right:0}
/* Only a phone needs telling that the field slides. */
.row100k .ra-swipe{display:none}
@media (max-width:700px){.row100k .ra-swipe{display:block}}
.row100k select.ra-pick{width:100%;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.06em;padding:6px 6px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);cursor:pointer}
.row100k select.ra-pick.open{border-color:var(--line);color:var(--gray)}
.row100k select.ra-pick:disabled{opacity:.4;cursor:default}
.row100k tr.ra-out td{opacity:.45}
.row100k tr.ra-out td.who{text-decoration:line-through}
.row100k table.board td.ra-tell{font-size:10px;letter-spacing:.12em;white-space:nowrap}
.row100k table.board td.ra-move{font-size:11px;letter-spacing:.1em;white-space:nowrap}
.row100k table.board tr.ra-moved td.ra-move{color:var(--water);font-weight:700}
`;

/* RACE WAVES — admin only (owner, 2026-09-10: "we need a way to assign
 * waves to rowers ... we can assign them manually, we can have something to
 * auto-assign them and then be able to assign them manually after that").
 * The field with everyone in it, the auto-assign with its dry run, the grid
 * of waves against the clock, and EMAIL THE WAVES. The rest of the world
 * gets a 404 — admin only even in local dev, where the signup page opens to
 * anyone (raceday.ts raceOpenFor): the console is the owner's, always.
 *
 * METERS ARE NOT PRINTED HERE and that is deliberate: racedayData carries a
 * blackout-masked total as 0, so printing it would print a lie. The seed is
 * the fastest 5k, which is public through a window anyway. */
export default async function RaceAdminPage() {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  const race = currentRace();
  let racers: Racer[] = EMPTY_RACERS;
  let unreadable = false;
  try {
    racers = await listRacers(race);
  } catch (err) {
    console.error("row100k/race-admin: failed to read the field", err);
    unreadable = true;
  }

  const phase = racePhase(race);
  const phaseWord = phase === "open" ? "TAKING NAMES" : phase === "closed" ? "NAMES SHUT — RACE MORNING" : "RACED";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{raWavCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Race waves</h2>
            <span className="mono">ADMIN ONLY — {phaseWord}</span>
          </div>
          <p className="ra-note">
            <b>{race.title}</b> · {race.sub} · <b>{race.when}</b> · {race.hours} · {race.venueLine} · waves of{" "}
            {race.waveSize} every {race.waveMinutes} minutes · {race.closesLine.toLowerCase()}
          </p>

          <RaceWaves race={race} racers={racers} unreadable={unreadable} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
