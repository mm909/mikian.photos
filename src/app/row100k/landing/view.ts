/* ?land=a|b|c — which of the three signed-out landings to render (owner,
 * 2026-09-25). Anything else, or nothing, is null and the ordinary front
 * page renders. */
export type Land = "a" | "b" | "c";

export function parseLand(q: string | string[] | undefined): Land | null {
  const v = Array.isArray(q) ? q[0] : q;
  return v === "a" || v === "b" || v === "c" ? v : null;
}
