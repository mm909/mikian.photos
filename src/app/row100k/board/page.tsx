import { permanentRedirect } from "next/navigation";

/* THE BOARD PAGE IS RETIRED (owner, 2026-09-24: "the board is reduced into
 * the records page: we don't need the board page anymore"). Its table —
 * tiers, arrows, progress bars, the under-10k rule — is the total-meters
 * view of the full rankings now. Every old link, sticker and share card
 * that still says /row100k/board lands there, with the month (?m=) and
 * the division (?d=) carried through; a #elite fragment survives the
 * redirect on its own, and the elite block keeps its id there. */

export const dynamic = "force-dynamic";

export default function BoardPage({ searchParams }: { searchParams?: { m?: string | string[]; d?: string | string[] } }) {
  const q = new URLSearchParams();
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const m = first(searchParams?.m);
  const d = first(searchParams?.d);
  if (m) q.set("m", m);
  if (d) q.set("d", d);
  const s = q.toString();
  permanentRedirect(`/row100k/records/total${s ? `?${s}` : ""}`);
}
