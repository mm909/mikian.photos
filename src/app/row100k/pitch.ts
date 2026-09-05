/* The launch-phase pitch for /row100k, stashed for next year.
 *
 * On 2026-09-05 the owner called the front page an ad: "100k / September",
 * the one-month sub line, the three-step deal, "takes thirty seconds", the
 * big erg photo, the "I'm in → sign in with Google" button. Five days into
 * the challenge none of that sells anything — the rowers are in, and the
 * page is now the front page of the newspaper (page.tsx). None of it was
 * wrong for August, though, so it lives here instead of in git history:
 * next year's launch page wants exactly this copy back, and a constants
 * file is easier to find than a commit. Nothing imports this module. */

/* The hero: the h1 (two lines, "100k" in water-blue) and the sub line. */
export const HERO = {
  line1: "100k",
  line2: "September.",
  sub: "One month. Row 100,000 meters. Every session counts — log it, climb the board.",
  /* The skewed water-blue stamp under the sub line (theme .cc-mark). */
  stamp: "Rowtember 2026",
} as const;

/* The big photo under the facts strip. public/row100k/hero-erg.jpg —
 * remember: a swapped photo needs a NEW file name, browsers cache by URL. */
export const HERO_PHOTO = {
  src: "/row100k/hero-erg.jpg",
  alt: "Rower mid-drive on the erg, motion-blurred under a honeycomb ceiling",
  width: 1400,
  height: 1750,
} as const;

/* "The deal" — three moves, shown to anyone not yet on the board. */
export const DEAL = {
  heading: "The deal",
  eyebrow: "THREE MOVES",
  steps: [
    {
      n: "01",
      title: "Claim your number",
      body: "Sign in with Google, put a name and your @ on the board.",
    },
    {
      n: "02",
      title: "Row",
      body: "Show up. Row. Repeat. Can you make it to 100k?",
    },
    {
      n: "03",
      title: "Log it",
      body: "Meters and time. 5k / 10k pieces count for the record boards.",
    },
  ],
} as const;

/* The clock section header and its mono tags. */
export const CLOCK = {
  heading: "The clock",
  before: "FIRST STROKE — SEP 1",
  during: "SEP 1 → SEP 30",
} as const;

/* The join section: header variants by state, the two button labels. */
export const JOIN = {
  heading: "Get on the board",
  headingJoined: "Your September",
  signedOut: "TAKES 30 SECONDS",
  signedInUnjoined: "ALMOST IN — PICK YOUR NAME",
  wrapped: "SEPTEMBER 2026 — WRAPPED",
  /* The black skewed stamp-button (theme .cc-mark.btn-mark). */
  signInButton: "I’m in → sign in with Google",
  submitButton: "I’m in",
  closedNotice: "THE CHALLENGE IS WRAPPED — THE BOARD BELOW IS FINAL. SEE YOU NEXT TIME.",
} as const;

/* The dashboard's bib card + progress bar copy. */
export const DASHBOARD = {
  bibEvent: "ROWTEMBER · 2026",
  shareButton: "Share a card",
  logButton: "Log a row",
  done: "100K — DONE. KEEP GOING.",
  /* `${fmtMeters(GOAL_METERS - meters)} TO GO` */
  toGoSuffix: "TO GO",
} as const;

/* Page metadata and the OG / Twitter card descriptions. */
export const META = {
  title: "100K September — the rowing challenge",
  description:
    "One month. 100,000 meters. Sign in, claim your rower number, log every session, climb the board. Open to everyone.",
  ogDescription: "One month. Row 100,000 meters. Get on the board.",
} as const;
