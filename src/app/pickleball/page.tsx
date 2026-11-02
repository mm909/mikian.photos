import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { HomeFooter } from "@/components/home/HomeFooter";
import { AdminPanel, Bracket, type ResultRow, type TeamRow } from "./BracketView";
import { Count, SignupForm } from "./SignupForm";
import { BracketSticker, TeamStickers } from "./Stickers";
import { skillLabel, TOURNEY } from "./tournament";
import { COURT, barlowCondensed, bungee, css } from "./theme";

/* THE PICKLEBALL PAGE (owner, 2026-11-02): sign up to play, host a
 * bracket, put in results — doubles, double elimination, one grand
 * final, no account anywhere. Anyone reads it, anyone opts in, anyone at
 * the court reports a score; only the owner seeds and locks. LIVE but
 * UNLINKED (owner: "live but no link placed") — the address is handed
 * out, not found. The bar is the page's own, the hyrox way, and the
 * marketplace header stays off (RunnerChrome.tsx). The look is a night
 * court — deep blue, white lines, the ball's neon — and the page moves
 * (owner: "really cool animations ... where things make sense"): the
 * title rises, a ball bounces the baseline, the stamp slams, the
 * bracket staggers in, a ready match pulses. */

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: COURT };

export const metadata: Metadata = {
  title: `Pickleball ’${String(TOURNEY.year).slice(-2)} — The bracket`,
  description: "Doubles, double elimination. Opt in, watch the draw, put your scores in.",
};

export default async function PickleballPage() {
  const actor = await getEffectiveActor();
  const admin = actor ? isAdmin(actor) : false;

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
    console.error("pickleball: failed to read the tables (pushed?)", err);
    unreadable = true;
  }

  const active = teams.filter((t) => !t.withdrawn);
  const yr = `’${String(TOURNEY.year).slice(-2)}`;
  /* The title, word by word, each on its own delay. */
  const word = (text: string, d: number, cls = "") => (
    <span className="w" key={`${text}${d}`}>
      <em className={`wi ${cls}`.trim()} style={{ "--d": `${d}ms` } as React.CSSProperties}>
        {text}
      </em>
    </span>
  );

  return (
    <div className={`pb ${bungee.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>

      <div className="pb-bar">
        <a href="/pickleball" className="pb-wm">
          Pickleball
          <small>Double elimination {yr}</small>
        </a>
        <nav>
          <a className="pb-chip" href="#in">
            Opt in
          </a>
          <a className="pb-chip" href="#bracket">
            The bracket
          </a>
        </nav>
      </div>
      <div className="pb-stripe" />

      <header className="pb-hero">
        <div className="wrap">
          <p className="pb-crumb">Doubles · Double elimination</p>
          <h1 className="disp">
            {word("PICKLE", 0)}
            <br />
            {word("BALL", 120)} {word(yr, 260, "yr")}
          </h1>
          <p className="pb-tag">{TOURNEY.tagline}</p>
          <p className="pb-lede">
            Grab a partner, put your names in. The owner seeds the field and locks the bracket; from there every score goes in right here,
            courtside. Lose once and you drop to the losers bracket — <b>nobody is out until they’ve lost twice.</b>
          </p>

          <div className="pb-facts">
            <div className="pb-fact" style={{ "--i": 0 } as React.CSSProperties}>
              <div className="k">Teams in</div>
              <div className="v">
                <Count to={active.length} />
                <small>{locked ? "the field is locked" : "no cap — bring everyone"}</small>
              </div>
            </div>
            <div className="pb-fact" style={{ "--i": 1 } as React.CSSProperties}>
              <div className="k">Format</div>
              <div className="v">
                Double elim
                <small>one game to 11 · single grand final</small>
              </div>
            </div>
            <div className="pb-fact" style={{ "--i": 2 } as React.CSSProperties}>
              <div className="k">When · where</div>
              <div className="v">
                {TOURNEY.dateLine}
                <small>{TOURNEY.venue}</small>
              </div>
            </div>
          </div>
        </div>
        <span className="pb-ball" aria-hidden>
          <i />
        </span>
        <span className="pb-baseline" aria-hidden />
      </header>

      <section className="wrap" id="in">
        <div className="pb-head">
          <h2 className="disp">Opt in</h2>
          <span>{locked ? "Closed — bracket is live" : "Open"}</span>
        </div>
        {unreadable ? <p className="pb-err">The list could not be read — have the tables been pushed?</p> : null}
        <SignupForm locked={locked} />
      </section>

      <section className="wrap" id="teams">
        <div className="pb-head">
          <h2 className="disp">The field</h2>
          <span>
            {active.length} {active.length === 1 ? "team" : "teams"}
          </span>
        </div>
        {active.length === 0 ? (
          <p className="pb-empty">Nobody yet — be the first two in.</p>
        ) : (
          <div className="pb-teams">
            {(locked ? [...active].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99)) : active).map((t, i) => (
              <div className="pb-team" key={t.id} style={{ "--i": i } as React.CSSProperties}>
                <span className="n">{locked && t.seed !== null ? `#${t.seed}` : `${i + 1}`}</span>
                <span className="who">
                  {t.player1}
                  <span className="amp">&amp;</span>
                  {t.player2}
                </span>
                {t.skill ? <span className="lvl">{skillLabel(t.skill)}</span> : null}
              </div>
            ))}
          </div>
        )}
        {active.length > 0 ? (
          <>
            <p className="pb-sub">Your sticker</p>
            <TeamStickers teams={active} />
          </>
        ) : null}
        {admin ? <AdminPanel teams={teams} locked={locked} /> : null}
      </section>

      <section className="wrap" id="bracket">
        <div className="pb-head">
          <h2 className="disp">The bracket</h2>
          <span>{locked ? "Live — tap a match to score it" : "Draws when the field locks"}</span>
        </div>
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
