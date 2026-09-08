import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* Moderation moved into the rowers table on /row100k/signups (owner ask,
 * 2026-09-08: one page for signups and moderation). This URL only forwards
 * — the old ?r=<rowerNumber> rides along so a shared moderation link still
 * opens that rower. */
export default function ModerationPage({ searchParams }: { searchParams?: { r?: string } }) {
  const r = searchParams?.r;
  redirect(r && /^\d{1,6}$/.test(r) ? `/row100k/signups?r=${r}` : "/row100k/signups");
}
