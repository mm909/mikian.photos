import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE } from "@/lib/row100k";
import { loadLanding } from "../../landing/data";
import { L1 } from "../L1";

/* Preview of landing 1, THE DARE (landings/L1.tsx), on live numbers.
 *
 * A joined rower has nothing to opt in to: they go to the front page, the
 * way they will once this is the home page. Anyone else — a stranger, or
 * a Google account that never joined — gets the landing. The lookup fails
 * open to the landing so the page always renders. */
export const dynamic = "force-dynamic";

async function joinedRower(): Promise<boolean> {
  try {
    const actor = await getEffectiveActor();
    if (!actor) return false;
    const me = await db.rowParticipant.findUnique({
      where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
      select: { rowerNumber: true },
    });
    return me !== null;
  } catch {
    return false;
  }
}

export default async function Landing1Page() {
  if (await joinedRower()) redirect("/row100k");
  return <L1 data={await loadLanding()} />;
}
