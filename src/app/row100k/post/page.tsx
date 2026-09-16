import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* THE POST PACK IS RETIRED (owner, 2026-09-16: "Lets actually retire the
 * post pack"). The Instagram carousel generator lived here; the poster
 * studio is the one place a shareable is made now, so an old link lands
 * there. PostPack.tsx, slides.ts and clubJoins.ts went with it. */
export default function PostPackPage(): never {
  redirect("/row100k/posters");
}
