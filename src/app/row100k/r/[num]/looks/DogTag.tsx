import { fmtRowerNumber } from "@/lib/row100k";
import { ELITE_LABEL, ELITE_TAG } from "@/lib/blackoutRules";
import { RowerSearch } from "./RowerSearch";
import type { ProfileView } from "./view";

/* ONE OF THE ELITE, SEEN BY SOMEBODY ELSE, WHILE A WINDOW IS OPEN.
 *
 * The owner, 2026-09-06: "when you go to an elite player's profile we
 * should black it out… maybe we just make it show a super stripped down
 * version that's just their average pace. I'm kinda thinking rower dog tag
 * vibes… I want that average pace to be there like identity — rower 201 is
 * this pace. White on black. That's what it is."
 *
 * So the page stops being a profile and becomes a tag: the number and the
 * name on one line, THE ELITE, and the one figure that stays public while
 * the meters are gone — the average split. No ledger of blocks, no
 * calendar, no bests, no log. A wall of blocks was still a page about
 * numbers nobody may read; this is a page about who they are.
 *
 * The pace is a ratio of two hidden numbers and gives neither away, which
 * is why it is the one thing here. Everything else on this component is
 * already public: a name, a rower number, a division, and the fact that
 * they are in the elite.
 *
 * The search stays — this is still the way to reach another rower — and it
 * is the only thing on the page that is not the tag.
 *
 * The tag itself (DogTagCard) is also what an elite rower gets under their
 * own stats while a window is open (owner, 2026-09-08: "what everyone else
 * sees") — Profile.tsx mounts the card alone, without the search, since
 * the nameplate above already carries one. */

/* The tag: the black block and nothing else. The bib sits on the name line
 * at the name's size, grey, exactly as the profile nameplate has it (owner,
 * 2026-09-08); the pace is white like the name. */
export function DogTagCard({
  view,
  until,
  heading: Name = "h1",
}: {
  view: ProfileView;
  until?: string;
  /* The tag is the page for a stranger (h1); under the rower's own
   * nameplate it is a section of it (h2) — one h1 a page. */
  heading?: "h1" | "h2";
}) {
  const r = view.rower;
  const board = r.division === "F" ? "WOMEN" : r.division === "M" ? "MEN" : "OVERALL";
  return (
    <div className="dt">
      <div className="dt-in">
        <p className="dt-eye mono">{ELITE_LABEL}</p>

        <Name className="dt-name">
          <span className="num">{fmtRowerNumber(r.rowerNumber)}</span> {r.displayName}
        </Name>

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
  );
}

/* The whole page for a stranger: the tag, then the way to somebody else. */
export function DogTag({ view, until }: { view: ProfileView; until?: string }) {
  const r = view.rower;
  return (
    <section className="pf-sec">
      <div className="wrap front">
        <DogTagCard view={view} until={until} />

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
