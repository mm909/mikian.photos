/* THE TOURNAMENT, in code (owner, 2026-11-02: a site to sign up to play
 * pickleball, host a bracket, put in results — doubles, double
 * elimination, no account, one for now built so the next is a line
 * here). The raffle/race-day way: the facts live here by slug, the db
 * holds what changes (the teams, the scores, the lock). The venue and
 * the date are the owner's to fill in when he has them. */

export type Tourney = {
  slug: string;
  /* The wordmark line. */
  name: string;
  year: number;
  /* The hero facts — "TBA" until the owner sets them. */
  venue: string;
  dateLine: string;
  tagline: string;
};

export const TOURNEYS: Tourney[] = [
  {
    slug: "pickleball-2026",
    name: "Pickleball",
    year: 2026,
    venue: "TBA",
    dateLine: "TBA",
    tagline: "Doubles. Double elimination. Opt in.",
  },
];

/* One for now (owner, 2026-11-02). */
export const TOURNEY = TOURNEYS[0];

/* The self-rated ladder the form offers (owner: collect skill level; the
 * seeding is his, by hand, so this is a hint, not a bracket input). */
export const SKILLS: { id: string; label: string }[] = [
  { id: "new", label: "New to it" },
  { id: "3.0", label: "3.0" },
  { id: "3.5", label: "3.5" },
  { id: "4.0", label: "4.0" },
  { id: "4.5", label: "4.5+" },
];

export const NAME_MAX = 40;

export function skillLabel(id: string): string {
  return SKILLS.find((s) => s.id === id)?.label ?? "";
}

/* A team is its two players (owner, 2026-11-02: "just player names" — no
 * team-name field anywhere). */
export function teamName(player1: string, player2: string): string {
  return `${player1} & ${player2}`;
}
