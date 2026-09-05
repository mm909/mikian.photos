import type { ReactNode } from "react";
import { clockShape } from "@/lib/blackoutRules";

/* Blackout blocks — what a hidden number looks like. Plain components (no
 * hooks, no client directive) so the board (a client component) and the
 * admin page (a server component) can both render them. Styles live under
 * .bo in theme.ts, sized off the inherited font so a run of blocks is as
 * wide as the digits it replaces — the old fat cursor, several of them,
 * not a black bar (owner call, 2026-09-05). */

/* `digits` blocks with a real comma between thousands groups, so a hidden
 * 123,456 reads as six blocks with the comma in the right place: you can
 * see it is six figures and where the hundred-thousands start, and nothing
 * else. `group` off draws a bare run. */
export function Blocks({ digits, group = true }: { digits: number; group?: boolean }) {
  const n = Math.max(1, Math.floor(digits));
  const parts: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(<i key={`d${i}`} />);
    if (group && i < n - 1 && (n - i - 1) % 3 === 0) parts.push(<b key={`c${i}`}>,</b>);
  }
  return (
    <span className="bo" role="img" aria-label="hidden">
      {parts}
    </span>
  );
}

/* A hidden time: blocks for the digits, the real colons (and the record
 * board's point) kept between them, so 22:14 reads as ▮▮:▮▮ and 1:04:01 as
 * ▮:▮▮:▮▮ — the shape of the number and nothing else. The owner's rule
 * (2026-09-05) hides an elite rower's times along with their meters: a
 * time over a known distance is the meters by another route. A server
 * surface passes `seconds` (and `tenths` for the fmtRecordTime shape); a
 * client component passes a ready `shape` from clockShape/shapeOf in
 * blackoutRules.ts, because the seconds must never reach the browser. */
export function BlockClock({
  seconds,
  tenths,
  shape,
}: {
  seconds?: number;
  tenths?: boolean;
  shape?: string;
}) {
  const s = shape ?? clockShape(seconds ?? 0, tenths);
  return (
    <span className="bo" role="img" aria-label="hidden">
      {[...s].map((ch, i) => (ch === "#" ? <i key={i} /> : <b key={i}>{ch}</b>))}
    </span>
  );
}

/* A hidden word — one block per character, no commas. Used over the name
 * of a tier nobody has reached yet. */
export function BlockText({ chars }: { chars: number }) {
  const n = Math.max(1, Math.floor(chars));
  return (
    <span className="bo" role="img" aria-label="hidden">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
