import { BlockClock, Blocks } from "../../../Blackout";
import type { ProfileBest } from "./view";

/* The four bests as ONE small board — fastest 5k, fastest 10k, longest
 * row, biggest day, in the front page's top-three table voice instead of
 * the 2px cards (owner call, 2026-09-05). One list since 2026-09-25
 * (owner: "condense into one list — no PACE RECORDS / DISTANCE RECORDS
 * subheaders"); the two boards it used to be are gone with their titles.
 * Each label links to that record's leaderboard, filtered to the rower's
 * division so the board matches the place chip.
 *
 * No directive: the profile renders this straight on the server for a
 * masked rower (the page blanked the values and left a digit count or a
 * time silhouette, so the blocks are drawn here and no number reaches the
 * browser), and BestsTablesShare wraps it for the rower and admins, whose
 * per-row SHARE needs state. The SHARE cell only exists when a handler is
 * given — a server render never carries one. */
export function BestsTables({
  bests,
  onShare,
}: {
  bests: ProfileBest[];
  onShare?: (best: ProfileBest) => void;
}) {
  return (
    <div className="pf-best">
      <table className="board">
        <tbody>
          {bests.map((r) => (
            <tr key={r.key}>
              <td>
                <a className="k" href={r.href} aria-label={`${r.label} — the leaderboard`}>
                  {r.label}
                </a>
                {r.place ? (
                  <span className={`dtag${r.place <= 3 ? ` m${r.place}` : ""}`}>#{r.place}</span>
                ) : null}
                <div className="sub mono">{r.sub}</div>
              </td>
              <td className="num">
                {r.shape ? (
                  <BlockClock shape={r.shape} />
                ) : r.digits ? (
                  <>
                    <Blocks digits={r.digits} /> m
                  </>
                ) : (
                  r.value
                )}
              </td>
              {onShare ? (
                <td className="sh">
                  {r.value !== "—" ? (
                    <button type="button" className="quiet-btn" onClick={() => onShare(r)}>
                      SHARE
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
