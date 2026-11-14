/* THE BOARD, FOR NOW. The app has no accounts yet, so there is nobody real
 * to rank against: this is a DEMO CREW whose month totals grow a little
 * every day, so the climb can be felt. The screen says so. The real board
 * (the Rowtember standings) replaces this file when sign-in lands. */

export type Racer = { id: string; name: string; meters: number; you?: boolean };

const CREW: [string, number][] = [
  ["Avery", 9300],
  ["Jordan", 8100],
  ["Sam", 7400],
  ["Riley", 6600],
  ["Casey", 5900],
  ["Morgan", 5200],
  ["Quinn", 4500],
  ["Drew", 3700],
  ["Parker", 2900],
];

/* Month totals on day-of-month `dom`: each rower's daily habit, with one
 * rest day a week in a different place for each. */
export function crewOn(dom: number, mine: { name: string; meters: number }): Racer[] {
  const crew: Racer[] = CREW.map(([name, perDay], i) => {
    let m = 0;
    for (let d = 1; d <= dom; d++) if ((d + i) % 7 !== 0) m += perDay;
    return { id: `crew-${i}`, name, meters: Math.round(m * 0.62) };
  });
  return [...crew, { id: "you", name: mine.name, meters: mine.meters, you: true }];
}

export const ranked = (list: Racer[]): Racer[] => [...list].sort((a, b) => b.meters - a.meters || (a.you ? 1 : -1));

/* ---- the feed ---------------------------------------------------------- */

export type FeedItem = { id: string; name: string; meters: number; seconds: number; at: number; you?: boolean; rowId?: string };

/* What the demo crew rowed today and yesterday, as feed lines: the same
 * habits the board is added up from, each at that rower's hour of the day.
 * Only rows whose hour has passed are in it. */
export function crewFeed(now = new Date()): FeedItem[] {
  const out: FeedItem[] = [];
  for (let back = 0; back <= 1; back++) {
    const day = new Date(now);
    day.setDate(day.getDate() - back);
    const dom = day.getDate();
    CREW.forEach(([name, perDay], i) => {
      if ((dom + i) % 7 === 0) return;
      const at = new Date(day.getFullYear(), day.getMonth(), dom, 5 + ((i * 5) % 15), (i * 23) % 60).getTime();
      if (at > now.getTime()) return;
      const meters = Math.round((perDay * 0.62) / 250) * 250;
      const pace = 112 + i * 4 + ((dom * (i + 3)) % 5);
      out.push({ id: `crew-${i}-${dom}`, name, meters, seconds: Math.round((meters / 500) * pace * 10) / 10, at });
    });
  }
  return out;
}
