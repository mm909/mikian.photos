import Link from "next/link";
import type { ProfileErgRow } from "./view";

/* THE ERG on the profile (owner, 2026-09-23: "give me a section on the
 * profile to view these logged rows and play them back"). Every piece the
 * monitor recorded against this rower — the telemetry saved from /erg with
 * this rower on the erg — as a plain table: when, the monitor, how far,
 * how long, the average split, the title.
 *
 * IT IS NOT THE LOG. Rowtember's log is what the rower typed and the photo
 * they posted; this is what the PM5 sent. The two are separate ledgers
 * this year (owner, same day: "two independent logs, one for the
 * telemetry data and one for Rowtember, at least for this year"), so a
 * piece here counts for nothing on the board and the log above it does
 * not know it exists.
 *
 * OPEN and PLAY BACK are the rower's own and the admin's: the review page
 * and the console both need the account the piece is reachable from
 * (store.ts scope), so a visitor gets the table and no doors. */
export function ErgRows({ rows, canOpen }: { rows: ProfileErgRow[]; canOpen: boolean }) {
  return (
    <div className="pf-erg-scroll">
      <table className="pf-erg-tab">
        <thead>
          <tr>
            <th>When</th>
            <th>Monitor</th>
            <th>Distance</th>
            <th>Time</th>
            <th>Avg split</th>
            <th>Title</th>
            {canOpen ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.when}</td>
              <td>
                {r.device}
                {r.simulated ? " · SIM" : ""}
              </td>
              <td className="num">{r.meters}</td>
              <td className="num">{r.time}</td>
              <td className="num">{r.split}</td>
              <td className="tt">{r.title}</td>
              {canOpen ? (
                <td>
                  <span className="pf-erg-act">
                    <Link href={`/erg/s/${r.id}`}>OPEN</Link>
                    <Link href={`/erg?play=${encodeURIComponent(r.id)}`}>PLAY BACK</Link>
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
