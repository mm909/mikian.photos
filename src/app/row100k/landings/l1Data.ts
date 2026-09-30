import { TIERS, nowMs } from "@/lib/row100k";
import { monthOf, monthsThrough, prevMonth } from "@/lib/rowPeriod";
import { boardData } from "../boardData";

/* WHAT LANDING 1 (THE DARE) READS beyond the shared loader (landing/data.ts):
 * the rungs with how many rowers stand on or past each one this month, the
 * same count for the month that just closed, how many rowers have a meter
 * this month, and the number the next rower to opt in will be handed.
 *
 * Everything is read off the PUBLIC board (boardData — the blackout already
 * applied): a masked row carries the floor of the rung it reached, so it is
 * still counted on the right rung and on nothing above it. Read-only, and
 * it fails open to zeros so the page always renders. */

export type L1Rung = {
  key: string;
  meters: number;
  /* The board's short tag for the rung (10K, .25M). */
  label: string;
  /* What the board calls the rung, or null when the name is only the
   * distance said another way (.25M). */
  title: string | null;
  /* Rowers at or past this rung this month. */
  now: number;
  /* The same for the month that closed; null in the first month there was. */
  prev: number | null;
};

export type L1Extra = {
  /* Lowest rung first. */
  rungs: L1Rung[];
  /* Rowers with a meter on the board this month. */
  active: number;
  /* The same for the month that closed — the bars are drawn off it while
   * this month's board is still empty (the 1st, when the link goes out). */
  prevActive: number;
  /* "September" — the month the `prev` counts are for. */
  prevWord: string | null;
  /* The number the next rower gets (the join route hands out max + 1). */
  nextNumber: number | null;
};

const activeOf = (rows: { meters: number; masked?: boolean }[]): number =>
  rows.filter((r) => r.meters > 0 || r.masked).length;

const rungsOf = (now: number[] | null, prev: number[] | null): L1Rung[] =>
  TIERS.map((t, i) => ({
    key: t.key,
    meters: t.meters,
    label: t.label,
    title: t.title === t.label ? null : t.title,
    now: now ? now[i] : 0,
    prev: prev ? prev[i] : null,
  }));

const countRungs = (rows: { meters: number }[]): number[] =>
  TIERS.map((t) => rows.filter((r) => r.meters >= t.meters).length);

export async function loadL1(): Promise<L1Extra> {
  const now = nowMs();
  const month = monthOf(now);
  const last = monthsThrough(now).length > 1 ? prevMonth(month) : null;
  try {
    const [cur, old] = await Promise.all([boardData(), last ? boardData(last) : Promise.resolve(null)]);
    const top = cur.total.reduce((n, r) => Math.max(n, r.rowerNumber), 0);
    return {
      rungs: rungsOf(countRungs(cur.total), old ? countRungs(old.total) : null),
      active: activeOf(cur.total),
      prevActive: old ? activeOf(old.total) : 0,
      prevWord: old && last ? last.label.split(" ")[0] : null,
      nextNumber: top > 0 ? top + 1 : null,
    };
  } catch (err) {
    console.error("row100k landing 1: failed to load the rungs", err);
    return { rungs: rungsOf(null, null), active: 0, prevActive: 0, prevWord: null, nextNumber: null };
  }
}
