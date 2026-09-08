import { fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { ELITE_LABEL, ELITE_TAG } from "@/lib/blackoutRules";
import { Blocks } from "./Blackout";
import { Who } from "./Boards";

/* THE ELITE as a list, for the surfaces that would otherwise rank them:
 * the front page's leader + top three and the stats page's TOTAL METERS
 * record while a window is open. Owner (2026-09-05, late): the list carries
 * no ranking at all — even blacked out, a rower must not be able to tell
 * whether they are third or fourth, only that they are in the elite; a
 * total with one digit more than everyone else's is allowed to show as
 * such. Same heading and foot as the elite block on the board (owner,
 * 2026-09-08): THE ELITE, BY AVERAGE SPLIT, no places while hidden.
 *
 * So: no place column at all. The rows arrive already in the order
 * blackoutRules.eliteOrder gives them (average split, then name) — this
 * component never sorts, it prints. Blocks for a hidden number, the real
 * figure only on the viewer's own row (the page decides: a row is handed
 * `meters` only when it is not masked). Plain component, no hooks, so the
 * client-side stats page and the server-rendered front page both use it.
 *
 * Props are exactly what may reach the browser: name, number, division,
 * the mask flag and the digit count. Never the seconds, never the total. */
export type EliteRow = {
  name: string;
  rowerNumber: number;
  division: string;
  masked?: boolean;
  /* Digit count of the real total — the blocks' length. */
  digits?: number;
  /* Their average split, "2:07" — the tag in front of the name, and what
   * the list is ordered by. */
  paceTag?: string;
  /* Only on an unmasked row (the viewer's own): their real total. */
  meters?: number;
};

export function EliteList({
  rows,
  until,
  meRowerNumber = null,
  eyebrow = true,
}: {
  rows: EliteRow[];
  /* "SEP 27" — when the window ends, already formatted (fmtPacificDay). */
  until?: string;
  /* The viewer's own rower number, to tint their row the way boards do. */
  meRowerNumber?: number | null;
  /* The heading line; off when the page already wrote one. */
  eyebrow?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="elite">
      {eyebrow && (
        <div className="elite-eye">
          <span>{ELITE_LABEL}</span>
          <span className="r">{until ? `HIDDEN UNTIL ${until.toUpperCase()} · BY AVERAGE SPLIT` : "HIDDEN · BY AVERAGE SPLIT"}</span>
        </div>
      )}
      <table className="board elite-t">
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowerNumber} className={meRowerNumber === r.rowerNumber ? "fin" : undefined}>
              <td className="dv">{r.division === "F" ? "W" : r.division === "M" ? "M" : ""}</td>
              <td>
                <Who
                  row={{ name: r.name, rowerNumber: r.rowerNumber }}
                  badge={
                    r.paceTag ? (
                      <span className="tierbadge pace">{r.paceTag}</span>
                    ) : (
                      <span className="tierbadge elite">{ELITE_TAG}</span>
                    )
                  }
                />
              </td>
              <td className="num">
                {r.masked || r.meters == null ? (
                  <>
                    <Blocks digits={r.digits ?? 1} /> m
                  </>
                ) : (
                  fmtMeters(r.meters)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="elite-foot mono">
        {rows.length === 1 ? "ONE ROWER" : `${rows.length} ROWERS`} · BY AVERAGE SPLIT · NO PLACES WHILE HIDDEN
      </p>
    </div>
  );
}

/* The one line other pages print about the list, so the wording lives in
 * one place: "ROWER 023 · ELITE" (ELITE_TAG does the word). */
export function eliteLine(rowerNumber: number): string {
  return `ROWER ${fmtRowerNumber(rowerNumber)} · ${ELITE_TAG}`;
}
