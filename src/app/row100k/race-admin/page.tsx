import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { hoursLine, racePhase } from "../raceday";
import { raceWithSettings } from "../racedaySettings";
import { EMPTY_RACERS, listRacers, type Racer } from "../racedayData";
import { listGallery } from "../galleryList";
import { photoUrl, photosServable, thumbKey } from "../photoUrls";
import { RaceSettings, type GalleryPick } from "./RaceSettings";
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
/* THE EVENING panel. datetime-local is not in the theme input rule (it
 * lists text, date and number), so it is given the same underline here —
 * the blackout console does the same for its own two. */
/* A native date widget has a wide intrinsic minimum and will push straight
 * through the panel border in a fixed grid column, so it is set a size down
 * from the theme input and allowed to shrink (min-width:0 on it AND on its
 * grid cell — a grid item defaults to min-width:auto). */
.row100k .panel input[type=datetime-local]{width:100%;min-width:0;background:transparent;border:none;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-archivo),sans-serif;font-size:15px;padding:9px 2px;border-radius:0;appearance:none}
.row100k .ra-block{border-top:1px dashed var(--line);margin-top:26px;padding-top:16px}
.row100k .ra-block:first-of-type{border-top:none;margin-top:6px;padding-top:0}
.row100k .ra-eye{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
/* Three across on a desk, two on a tablet, one on a phone — the columns
 * decide for themselves rather than by breakpoint. */
.row100k .ra-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr));gap:0 22px}
.row100k .ra-3 div{min-width:0}
.row100k .ra-def{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);margin-top:7px;line-height:1.9}
.row100k .ra-def b{color:var(--water);font-weight:700}
.row100k .ra-read{font-family:var(--row-mono),monospace;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);margin-top:22px;line-height:2}
.row100k .ra-read b{color:var(--water);font-weight:700;font-variant-numeric:tabular-nums}
.row100k .ra-warn{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#b3400f;margin-top:8px;line-height:1.8}
.row100k .ra-cur{display:flex;align-items:flex-start;gap:16px;margin-top:14px;flex-wrap:wrap}
.row100k .ra-cur img{display:block;width:96px;height:120px;object-fit:cover;border:2px solid var(--ink);background:var(--line)}
.row100k .ra-cur .none{width:96px;height:120px;border:2px dashed var(--line)}
.row100k .ra-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;margin-top:16px;max-height:340px;overflow-y:auto}
.row100k .ra-pic{display:block;margin:0;padding:0;border:2px solid var(--line);background:none;cursor:pointer;aspect-ratio:4/5;overflow:hidden}
.row100k .ra-pic.on{border-color:var(--water)}
.row100k .ra-pic img{display:block;width:100%;height:100%;object-fit:cover}
.row100k .ra-chg{list-style:none;margin:22px 0 0;padding:0;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);line-height:1.9}
.row100k .ra-chg li{border-top:1px dashed var(--line);padding:5px 0}
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

  /* The race AS IT STANDS, not as it shipped: the settings row the panel
   * below writes moves every time on this page (racedaySettings.ts). */
  const { race, view } = await raceWithSettings();
  let racers: Racer[] = EMPTY_RACERS;
  let unreadable = false;
  try {
    racers = await listRacers(race);
  } catch (err) {
    console.error("row100k/race-admin: failed to read the field", err);
    unreadable = true;
  }

  /* THE PICTURE PICKER's thumbnails — the same cached gallery listing the
   * gallery page reads, capped because this is a picker and not the album.
   * Fails soft: a listing hiccup costs the thumbnails, not the console. */
  let gallery: GalleryPick[] = [];
  try {
    if (photosServable()) {
      gallery = await Promise.all(
        (await listGallery()).slice(0, 60).map(async (o) => ({
          key: o.key,
          thumb: await photoUrl(o.hasThumb ? thumbKey(o.key) : o.key),
        })),
      );
    }
  } catch (err) {
    console.error("row100k/race-admin: gallery listing failed", err);
    gallery = [];
  }

  /* What the read-out starts from: people actually pulling, right now. */
  const starters = racers.filter((r) => !r.withdrewAt && r.role === "racer").length;

  const phase = racePhase(race);
  /* RACE EVENING — the race is 6–9 PM (owner, 2026-09-11: "6-9pm on the
   * 27th"); the word was left over from when it was built as a morning. */
  const phaseWord = phase === "open" ? "TAKING NAMES" : phase === "closed" ? "NAMES SHUT — RACE EVENING" : "RACED";

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
            {/* The gym and the room, no town between them: venueLine was
              * "The Strip Barbell · Las Vegas" and read here as the exact
              * lockup the owner struck (2026-09-11, "we just keep it at the
              * strip barbell engine room"). His own console is the last
              * place that should go on saying it. */}
            <b>{race.title}</b> · {race.sub} · <b>{race.when}</b> · {hoursLine(race)} · {race.venue} · {race.room} ·
            waves of {race.waveSize} every {race.waveMinutes} minutes
          </p>

          <RaceSettings view={view} gallery={gallery} field={starters} />

          <RaceWaves race={race} racers={racers} unreadable={unreadable} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
