import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
  CHALLENGE,
  CHALLENGE_DEMO,
  SANITY_FALLBACK,
  sanityBand,
  type SanityBand,
} from "@/lib/row100k";

/* The plausibility band the log form checks against (sanityBand in
 * src/lib/row100k.ts), drawn from every row logged so far. Cached on the
 * board's tag so a fresh log refreshes it along with the standings, with a
 * ten-minute backstop — the shape of the distribution barely moves row to
 * row, and the form only needs it to be roughly right. */

const loadSanityBand = async (): Promise<SanityBand> => {
  const rows = await db.rowEntry.findMany({
    where: { challenge: CHALLENGE },
    select: { meters: true, seconds: true },
  });
  return sanityBand(rows);
};

const getSanityBand = unstable_cache(loadSanityBand, ["row100k-sanity"], {
  revalidate: 600,
  tags: ["row100k-boards"],
});

/* Never throws: the band is a courtesy nudge, and a profile page must not
 * 500 because it could not be read — the form falls back to the same sane
 * defaults it uses when no band is passed at all. The seeded demo board
 * skips the cache for the reason boardData.ts gives (reseeding outside the
 * app never revalidates the tag). */
export async function sanityBandForForm(): Promise<SanityBand> {
  try {
    return CHALLENGE === CHALLENGE_DEMO ? await loadSanityBand() : await getSanityBand();
  } catch (err) {
    console.error("row100k: failed to load the sanity band", err);
    return SANITY_FALLBACK;
  }
}
