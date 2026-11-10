/* THE SERIES — the three food relays, one a month (owner, 2026-11-10: the
 * Glizzy Gauntlet first, "the same thing but … all the taco bells" second,
 * "a version of this but for In and Outs" third). One place for what each
 * page says about the other two, and for the START of each: the dates are
 * STAND-INS the owner picked in the interview ("a Saturday in January", "a
 * weekend in February", Sat Mar 20), so changing one here moves that page's
 * countdown, its pace table and the line its siblings print about it.
 *
 * Times carry Las Vegas's own offset: -08:00 before the clocks change on
 * March 14, 2027, -07:00 after. */

export type EventSlug = "glizzy-gauntlet" | "ring-every-bell" | "animal-style";

export const SERIES: Record<EventSlug, { name: string; blurb: string; start: string }> = {
  "glizzy-gauntlet": {
    name: "Vegas Glizzy Gauntlet",
    blurb: "Five Costco food courts, 48 miles across the valley, one glizzy at every stop.",
    /* 9:30 AM: a Saturday warehouse opens to every member (Executive at 9:00). */
    start: "2027-01-16T09:30:00-08:00",
  },
  "ring-every-bell": {
    name: "Ring Every Bell",
    blurb: "The Taco Bell 100K: 24 Taco Bells, one loop from the Strip, one day.",
    /* 7:00 AM: the Cantina never closes, and the first stores that keep
     * hours are open by the time a runner can reach them. */
    start: "2027-02-20T07:00:00-08:00",
  },
  "animal-style": {
    name: "Animal Style",
    blurb: "All 19 In-N-Outs in the valley, 87 miles, open to close.",
    /* 10:30 AM: when every In-N-Out unlocks its doors. */
    start: "2027-03-20T10:30:00-07:00",
  },
};

export const ORDER: EventSlug[] = ["glizzy-gauntlet", "ring-every-bell", "animal-style"];
