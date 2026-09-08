import { fmtRowerNumber } from "@/lib/row100k";
import { ELITE_LABEL, ELITE_TAG } from "@/lib/blackoutRules";
import { RowerSearch } from "./RowerSearch";
import type { ProfileView } from "./view";

/* ONE OF THE FIFTEEN, SEEN BY SOMEBODY ELSE, WHILE A WINDOW IS OPEN.
 *
 * The owner, 2026-09-06: "when you go to an elite fifteen player's profile
 * we should black it out… maybe we just make it show a super stripped down
 * version that's just their average pace. I'm kinda thinking rower dog tag
 * vibes… I want that average pace to be there like identity — rower 201 is
 * this pace. White on black. That's what it is."
 *
 * So the page stops being a profile and becomes a tag: the number, the
 * name, ELITE 15, and the one figure that stays public while the meters are
 * gone — the average split. No ledger of blocks, no calendar, no bests, no
 * log. A wall of blocks was still a page about numbers nobody may read;
 * this is a page about who they are.
 *
 * The pace is a ratio of two hidden numbers and gives neither away, which
 * is why it is the one thing here. Everything else on this component is
 * already public: a name, a rower number, a division, and the fact that
 * they are in the fifteen.
 *
 * The search stays — this is still the way to reach another rower — and it
 * is the only thing on the page that is not the tag. */
export function DogTag({ view, until }: { view: ProfileView; until?: string }) {
  const r = view.rower;
  const board = r.division === "F" ? "WOMEN" : r.division === "M" ? "MEN" : "OVERALL";
  return (
    <section className="pf-sec">
      <div className="wrap front">
        <div className="dt">
          <div className="dt-in">
            <p className="dt-eye mono">{ELITE_LABEL}</p>

            <p className="dt-num mono">{fmtRowerNumber(r.rowerNumber)}</p>
            <h1 className="dt-name">{r.displayName}</h1>

            {view.paceTag ? (
              <>
                <p className="dt-pace">{view.paceTag}</p>
                <p className="dt-unit mono">AVERAGE SPLIT · PER 500 M</p>
              </>
            ) : (
              <p className="dt-unit mono">NO TIMED ROW YET</p>
            )}

            <p className="dt-foot mono">
              {board} · {ELITE_TAG}
              {until ? ` · HIDDEN UNTIL ${until.toUpperCase()}` : ""}
            </p>
          </div>
        </div>

        {/* Still the way to somebody else's page. */}
        <div className="dt-find">
          <RowerSearch
            rowerNumber={r.rowerNumber}
            displayName={r.displayName}
            roster={view.roster}
          >
            <p className="pf-date mono">FIND ANOTHER ROWER</p>
          </RowerSearch>
        </div>
      </div>
    </section>
  );
}
