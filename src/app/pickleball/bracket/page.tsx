import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Bracket, type ResultRow, type TeamRow } from "../BracketView";
import { BracketSticker } from "../Stickers";
import { TOURNEY } from "../tournament";
import { COURT, barlowCondensed, bungee, css } from "../theme";

/* THE BRACKET PAGE (owner, 2026-11-02: "show the bracket on its own
 * page" — and drawn like a real tournament bracket, winners moving on).
 * The sheet itself: winners rounds, the losers rounds, the grand final,
 * the champions banner, score entry on a tap, and the whole thing as a
 * sticker. The front door at /pickleball keeps the signups. */

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: COURT };

export const metadata: Metadata = {
  title: `Pickleball ’${String(TOURNEY.year).slice(-2)} — The bracket, drawn`,
  description: "The double-elimination draw, every score as it lands.",
};

export default async function PickleballBracketPage() {
  let teams: TeamRow[] = [];
  let results: ResultRow[] = [];
  let locked = false;
  let unreadable = false;
  try {
    const [rows, setting, res] = await Promise.all([
      db.pickleTeam.findMany({ where: { tourney: TOURNEY.slug }, orderBy: { createdAt: "asc" } }),
      db.pickleSetting.findUnique({ where: { tourney: TOURNEY.slug } }),
      db.pickleResult.findMany({ where: { tourney: TOURNEY.slug } }),
    ]);
    teams = rows.map((t) => ({ id: t.id, player1: t.player1, player2: t.player2, skill: t.skill, seed: t.seed, withdrawn: t.withdrawnAt !== null }));
    locked = setting?.lockedAt != null;
    results = res.map((r) => ({ matchKey: r.matchKey, teamAId: r.teamAId, teamBId: r.teamBId, scoreA: r.scoreA, scoreB: r.scoreB, reportedBy: r.reportedBy }));
  } catch (err) {
    console.error("pickleball: failed to read the bracket (tables pushed?)", err);
    unreadable = true;
  }

  const yr = `’${String(TOURNEY.year).slice(-2)}`;

  return (
    <div className={`pb ${bungee.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>

      <div className="pb-bar">
        <a href="/pickleball" className="pb-wm">
          Pickleball
          <small>Double elimination {yr}</small>
        </a>
        <nav>
          <a className="pb-chip" href="/pickleball#in">
            Opt in
          </a>
          <a className="pb-chip" href="/pickleball#teams">
            The field
          </a>
        </nav>
      </div>
      <div className="pb-stripe" />

      <section className="wrap" id="bracket">
        <div className="pb-head">
          <h2 className="disp">The bracket</h2>
          <span>{locked ? "Live — tap a match to score it" : "Draws when the field locks"}</span>
        </div>
        {unreadable ? <p className="pb-err">The bracket could not be read — have the tables been pushed?</p> : null}
        {locked ? (
          <>
            <Bracket teams={teams} results={results} />
            <p className="pb-sub">The bracket as a sticker</p>
            <BracketSticker teams={teams} results={results} />
          </>
        ) : (
          <p className="pb-empty">
            The draw goes up here once the field is seeded and locked. Lose your first match and you’re not done — the losers bracket runs all
            the way back to the grand final.
          </p>
        )}
      </section>

      <HomeFooter />
    </div>
  );
}
