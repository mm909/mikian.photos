import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { currentRace, raceOpenFor, racePhase, waveTime } from "../raceday";
import { listRacers } from "../racedayData";
import { FIELD_SHOWS_AT, Field } from "./Field";
import { rdCss } from "./rdCss";
import { SignupPanel } from "./SignupPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race day — 100K September",
  robots: { index: false, follow: false },
};

/* RACE DAY (owner, 2026-09-10): a timed 5,000 m trial at The Strip Barbell
 * on the last Sunday of Rowtember. Free — a rower registers, the owner puts
 * them in a wave, and an email tells them which one.
 *
 * The page is three things in order: what race day IS (the stub, straight
 * out of raceday.ts so the day, the place and the hours are stated once, in
 * code), THE ACT (sign in / opt in / you are in), and THE RACERS — one
 * board table, and only once FIELD_SHOWS_AT names are in it.
 *
 * MONOCHROME (owner, 2026-09-11: "on the race day sign up, let us stick
 * with monochromatic — just black and whites, whites on black"). Everything
 * between the bar and the footer sits on the ink ground of .rd-dark, and
 * the water blue is off this surface entirely; rdCss.ts carries the grey
 * ladder and the contrast it was chosen on.
 *
 * WHAT THE STUB SAYS, and no more (owner, same day: "I do not want a ton of
 * copy on the page ... mostly RACE DAY, TIMED 5,000 METER TRIAL. Maybe we
 * could just say first wave starts at six thirty"). The paragraph of sell
 * came off that day and is not coming back. What is left is the day, then
 * four facts: where, the hours, that it runs in WAVES and when the first
 * one goes off, and the waiver. The wave time is read from the race
 * (waveTime) and never typed out, so moving the race moves the page.
 *
 * THE HOST sits at the foot of the stub: The Strip Barbell mark, placed
 * once, under a hairline, with THE ENGINE ROOM named beside it (owner: the
 * room is new this September). It is smaller than the day above it and it
 * is not lined up against a Rowtember mark as an equal — Rowtember is
 * hosting something at their gym, and the page should read that way.
 *
 * HIDDEN FOR NOW (owner: "this should be hidden in development for now").
 * raceOpenFor is the one switch: open in local dev so the page can be
 * driven signed out, admin-only in production until the owner opens it. It
 * is in no nav rail and no menu yet either.
 *
 * BLACKOUT: the field prints TIMES, never meters. A fastest 5k is public
 * even for one of the elite while a window is open (the elite rule hides
 * their meters, not their clock), so this page reads the same to everybody
 * and nothing on it has to be masked. */
export default async function RaceDayPage() {
  const viewer = await resolveViewer();
  // Hidden until the owner opens it: dev for everyone, production for an
  // admin. The same gate the shirt shop wears.
  if (!raceOpenFor(viewer.isAdmin)) notFound();

  const race = currentRace();
  const phase = racePhase(race);
  const racers = await listRacers(race);
  // A withdrawal keeps its row so the wave console can see the hole it
  // leaves; the FIELD is only the names still in.
  const live = racers.filter((r) => r.withdrewAt === null);
  // THE FIELD IS THE START LIST, so it is RACERS (owner, 2026-09-11: a
  // spectator gets no wave and no erg). The people coming to watch are a
  // number beside it — they are in the room, they are not in the race.
  const field = live.filter((r) => r.role === "racer");
  const watching = live.length - field.length;
  const mine = viewer.myParticipantId
    ? (racers.find((r) => r.participantId === viewer.myParticipantId) ?? null)
    : null;

  // The section head says nothing while the race is open: FREE TO ENTER
  // came off with the rest of the sell (owner, 2026-09-11), and the day is
  // already the biggest line on the page.
  const headNote = phase === "closed" ? "REGISTRATION CLOSED" : phase === "raced" ? "RACED" : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{rdCss}</style>
      <RowBar {...barProps(viewer)} />

      <div className="rd-dark">
        <section>
          <div className="wrap">
            <p className="rd-dev">In development · not linked from the bar yet</p>

            <div className="sec-head">
              <h2>{race.title}</h2>
              {headNote && <span className="mono">{headNote}</span>}
            </div>

            <div className="rd-stub">
              <p className="rd-eye">{race.sub}</p>
              <p className="rd-when">{race.when}</p>
              <ul className="rd-facts">
                <li>
                  <span className="k">Where</span>
                  <span className="v">{race.venueLine}</span>
                </li>
                <li>
                  <span className="k">Hours</span>
                  <span className="v">{race.hours}</span>
                </li>
                {/* The one thing about the format a rower has to know
                 * before they put a name in: it runs in waves, and the
                 * first one goes off at this time. */}
                <li>
                  <span className="k">Waves</span>
                  <span className="v">
                    First wave {waveTime(race, 1)}, then every {race.waveMinutes} min
                  </span>
                </li>
                {/* The gym's waiver, said out loud among the facts rather
                 * than sprung at the end (owner sent the link 2026-09-11). */}
                {race.waiver && (
                  <li>
                    <span className="k">Waiver</span>
                    <span className="v">
                      <a href={race.waiver.url} target="_blank" rel="noopener noreferrer">
                        Sign it here
                      </a>
                    </span>
                  </li>
                )}
              </ul>

              {/* THE HOST, quietly: their mark, their room, their site. */}
              {race.venueMark && (
                <div className="rd-host">
                  <a href={race.venueUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      className="rd-mark"
                      src={race.venueMark.src}
                      alt={race.venueMark.alt}
                      width={1000}
                      height={Math.round(1000 / race.venueMark.ratio)}
                    />
                  </a>
                  <p className="rd-room">
                    <b>{race.room}</b>
                    {race.roomNote}
                  </p>
                </div>
              )}
            </div>

            <SignupPanel
              race={race}
              signedIn={viewer.actor !== null}
              joined={viewer.myParticipantId !== null}
              open={phase === "open"}
              mine={mine}
            />
          </div>
        </section>

        {/* The start list, once it is one (Field.FIELD_SHOWS_AT). */}
        {field.length >= FIELD_SHOWS_AT && (
          <section>
            <div className="wrap">
              <div className="sec-head">
                <h2>The racers</h2>
                <span className="mono">
                  {field.length} IN THE FIELD
                  {watching > 0 ? ` · ${watching} WATCHING` : ""}
                </span>
              </div>

              <Field race={race} field={field} />
            </div>
          </section>
        )}
      </div>

      <RowFooter />
    </div>
  );
}
