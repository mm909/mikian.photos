import { BlockClock, Blocks } from "../../../Blackout";
import type { ProfileBest } from "./view";

/* The four bests as two small boards — pace records (fastest 5k / 10k) and
 * distance records (longest row / biggest day) — in the front page's
 * top-three table voice instead of the 2px cards (owner call, 2026-09-05).
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
  const pace = bests.filter((b) => b.key.startsWith("fastest"));
  const dist = bests.filter((b) => !b.key.startsWith("fastest"));
  return (
    <div className="pf-bests">
      <BestsBoard label="Pace records" rows={pace} onShare={onShare} />
      <BestsBoard label="Distance records" rows={dist} onShare={onShare} />
    </div>
  );
}

function BestsBoard({
  label,
  rows,
  onShare,
}: {
  label: string;
  rows: ProfileBest[];
  onShare?: (best: ProfileBest) => void;
}) {
  return (
    <div className="pf-best">
      <h3 className="mono">{label}</h3>
      <table className="board">
        <tbody>
          {rows.map((r) => (
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
