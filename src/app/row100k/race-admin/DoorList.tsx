import { fmtRowerNumber } from "@/lib/row100k";
import type { RaceDef } from "../raceday";
import type { Racer } from "../racedayData";

/* THE DOOR LIST (owner, 2026-09-12: "give me a simplified viewing table of
 * who is signed up as a racer and a spectator, and a count of racers and
 * spectators"). The sheet he would print and carry to the gym: a name comes
 * at him, he finds it, and the row says whether they are on an erg or in a
 * chair, which wave, and whether the waiver is done. Four columns, A to Z,
 * nothing to click.
 *
 * IT IS NOT A SECOND WAVE CONSOLE. RaceWaves is the machine — two tables, a
 * picker on every row, dry runs, mail — and it sorts by wave and then by
 * seed because it is laying a grid out. This sorts by NAME, because a door
 * hands you a name, and it keeps racers and spectators in ONE table because
 * the question is how many bodies are coming, which two tables cannot
 * answer without arithmetic. Server component: no state, no fetch, nothing
 * on it writes, no client bundle at all.
 *
 * NO EMAIL COLUMN, ever: this is a sheet that gets carried into a room and
 * read over a shoulder, and the addresses belong in the console the mail is
 * sent from. Same reason the wave prints as a bare number and never as a
 * clock time — a rower is only ever told their own wave (raceday.ts). The
 * bracket, the fastest 5k, the told-state and the signup day are all
 * downstairs in the console: subtraction is the design. Meters are nowhere,
 * because racedayData carries a masked total as 0 and a zero would be a
 * lie. */
export function DoorList({ race, racers, unreadable }: { race: RaceDef; racers: Racer[]; unreadable: boolean }) {
  /* A withdrawal is a fact, not a delete (racedayData), so the row is still
   * here — but somebody who took their name out is not coming, and every
   * count on this block is about who is. They get a line of their own under
   * the table instead. */
  const coming = racers.filter((r) => !r.withdrewAt);
  const gone = racers.filter((r) => r.withdrewAt);
  const racing = coming.filter((r) => r.role === "racer");
  const watching = coming.filter((r) => r.role === "spectator");
  /* Only a racer is ever ASKED for the waiver — a spectator is not pulling
   * (SignupPanel) — and somebody who switched down from racer still carries
   * the old stamp. Neither belongs in the column or the count. */
  const owed = race.waiver ? racing.filter((r) => !r.waiverAt).length : 0;

  /* A TO Z, one list, racers and spectators interleaved: the one sort
   * nothing else on the page uses, and the only one you can run a finger
   * down when a name walks in. The rower number breaks a tie, because two
   * people can share a display name. */
  const byName = (a: Racer, b: Racer) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.rowerNumber - b.rowerNumber;
  const rows = [...coming].sort(byName);
  const out = [...gone].sort(byName);

  return (
    <div className="ra-door">
      <div className="sec-head ra-sec">
        <h2>The door list</h2>
        <span className="mono">EVERYBODY COMING — A TO Z</span>
      </div>
      <p className="ra-note">
        Racers and spectators in one list, in the order a name arrives at a door. Nothing here changes anything — the
        wave console below is where the work is.
      </p>

      {unreadable ? (
        /* Four zeros and a broken read must never look the same. The console
         * says this in the same words further down: one failure, one
         * sentence, said twice rather than described two ways. */
        <p className="board-empty">
          THE FIELD COULD NOT BE READ JUST NOW — NO COUNT HERE WOULD BE HONEST. RELOAD IN A MOMENT.
        </p>
      ) : (
        <>
          <div className="st-tiles">
            <div className="st-tile">
              <div className="k mono">Racers</div>
              <div className="n">{racing.length}</div>
              <div className="l mono">PULLING THE {race.meters.toLocaleString("en-US")} M</div>
            </div>
            <div className="st-tile">
              <div className="k mono">Spectators</div>
              <div className="n">{watching.length}</div>
              <div className="l mono">IN THE ROOM, NOT ON AN ERG</div>
            </div>
            {/* He asked for two numbers; the third is the one a door actually
              * needs — how many bodies — and it is free, because the two it
              * adds up are already on the screen beside it. */}
            <div className="st-tile">
              <div className="k mono">Everybody</div>
              <div className="n">{coming.length}</div>
              <div className="l mono">BODIES THROUGH THE DOOR</div>
            </div>
            {/* The one number here he can ACT on, so the only one that gets
              * colour, and only above zero. A race carrying no waiver at all
              * gives the tile to the withdrawals rather than leaving a hole
              * in the four-up. */}
            {race.waiver ? (
              <div className={`st-tile${owed > 0 ? " owe" : ""}`}>
                <div className="k mono">Waiver</div>
                <div className="n">{owed}</div>
                <div className="l mono">
                  {owed > 0 ? "STILL OWED" : racing.length === 0 ? "NOBODY TO CHASE YET" : "EVERY RACER HAS SIGNED"}
                </div>
              </div>
            ) : (
              <div className="st-tile">
                <div className="k mono">Took it back</div>
                <div className="n">{gone.length}</div>
                <div className="l mono">WITHDRAWN, NOT DELETED</div>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="board-empty">NOBODY HAS SIGNED UP YET — NAMES LAND HERE THE MOMENT THEY COME IN.</p>
          ) : (
            <table className="board ra-d">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Racing</th>
                  <th className="ra-dw">Wave</th>
                  {race.waiver && <th className="ra-dv">Waiver</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {/* The name does not link. The console links every name
                      * because you work in it; this one only gets read, and
                      * on paper a link is ink. The number stays, because it
                      * is how you tell two Mikes apart. */}
                    <td className="who">
                      <span className="mono ra-dn">{fmtRowerNumber(r.rowerNumber)} · </span>
                      {r.name}
                    </td>
                    <td className="mono">
                      {r.role === "racer" ? <b className="ra-yes">RACING</b> : <span className="ra-no">WATCHING</span>}
                    </td>
                    {/* A racer with no wave yet is a hole and shows one. A
                      * spectator has no wave to be missing, so that cell is
                      * empty rather than wearing a dash that means nothing. */}
                    <td className="mono ra-dw">
                      {r.role !== "racer" ? "" : r.wave === null ? <span className="ra-no">—</span> : r.wave}
                    </td>
                    {race.waiver && (
                      <td className="mono ra-dv">
                        {r.role !== "racer" ? (
                          ""
                        ) : r.waiverAt ? (
                          <span className="ra-no">SIGNED</span>
                        ) : (
                          <b className="ra-owe">OWED</b>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* THE TAIL. Kept out of the table so the list he scans is only
            * people who are coming and a finger never has to skip a line —
            * and named here, because the case this sheet exists for is
            * somebody who withdrew turning up at the door anyway. */}
          {out.length > 0 && (
            <p className="ra-foot">
              {out.length} TOOK THEIR {out.length === 1 ? "NAME" : "NAMES"} BACK —{" "}
              {out.map((r) => r.name.toUpperCase()).join(" · ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
