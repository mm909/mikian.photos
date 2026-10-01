/* ?land=1..5 — which of the five signed-out landing drafts to render
 * (owner, 2026-09-30: "we need new draft home pages, give me 5 different
 * ones"; the earlier a/b/c drafts of 09-25 were rejected and are gone).
 * Anything else, or nothing, is null and the ordinary front page renders.
 * The same five are reachable for anyone, signed in or not, at
 * /row100k/landings/p1..p5. */
export type Land = 1 | 2 | 3 | 4 | 5;

export function parseLand(q: string | string[] | undefined): Land | null {
  const v = Array.isArray(q) ? q[0] : q;
  return v === "1" || v === "2" || v === "3" || v === "4" || v === "5" ? (Number(v) as Land) : null;
}
