import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* Dev stats folded into the shareables page (owner, 2026-09-16: "combine
 * this page on the shareables menu"). The card catalogue, the counts and
 * the recent list all live at /row100k/shareables now; this URL only
 * forwards. */
export default function DevStatsPage() {
  redirect("/row100k/shareables");
}
