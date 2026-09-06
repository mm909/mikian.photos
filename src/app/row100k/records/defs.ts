import { clockShape, digitCount } from "@/lib/blackoutRules";
import type { Boards, RecordRow, TotalRow } from "@/lib/row100k";

/* The five record boards, shared by the stats page's records section and
 * the full-ranking pages under /row100k/records/[record]. Keys double as
 * the URL segment, so this list IS the routing table for that page. The
 * titles double as the chip labels on the stats page (the chips uppercase
 * them), so a record is called the same thing everywhere. */

export type RecordKey = "total" | "5000" | "10000" | "longest" | "bigday";

export type RecordDef = {
  key: RecordKey;
  title: string;
  kind: "time" | "meters";
  /* pace boards only — drives the /500m split rendering */
  dist?: 5000 | 10000;
  emptyHint: (started: boolean) => string;
};

export const RECORD_DEFS: RecordDef[] = [
  {
    key: "total",
    title: "Total meters",
    kind: "meters",
    emptyHint: (s) => (s ? "Every meter counts — log the first one." : "Claimed Sep 1 by whoever shows up."),
  },
  {
    key: "5000",
    title: "Fastest 5k",
    kind: "time",
    dist: 5000,
    emptyHint: (s) => (s ? "Log a 5,000m piece to claim this." : "Claimed Sep 1 by whoever shows up."),
  },
  {
    key: "10000",
    title: "Fastest 10k",
    kind: "time",
    dist: 10000,
    emptyHint: (s) => (s ? "Log a 10,000m piece to claim this." : "Claimed Sep 1 by whoever shows up."),
  },
  { key: "longest", title: "Longest row", kind: "meters", emptyHint: () => "One sitting, most meters." },
  { key: "bigday", title: "Biggest day", kind: "meters", emptyHint: () => "Most meters inside one calendar day." },
];

export function recordDef(key: string): RecordDef | undefined {
  return RECORD_DEFS.find((d) => d.key === key);
}

/* Division filter, carried in the URL (?d=all|m|f) on the ranking pages.
 * "all" is one combined ranking across both divisions. */
export type DivKey = "all" | "m" | "f";

export const DIV_DEFS: { key: DivKey; label: string; word: string }[] = [
  { key: "all", label: "All", word: "everyone" },
  { key: "m", label: "Men's", word: "men" },
  { key: "f", label: "Women's", word: "women" },
];

export function parseDiv(v: unknown): DivKey {
  return v === "m" || v === "f" ? v : "all";
}

export function divMatch(div: DivKey, division: string): boolean {
  return div === "all" || division === div.toUpperCase();
}

/* One row of any record board, normalized: the original row (for the Who
 * link), the record value, and whatever meta that board carries. The
 * "from N m" prorated annotation is deliberately NOT surfaced anywhere. */
export type Ranked = {
  row: TotalRow | RecordRow;
  value: number;
  day?: string;
  sessions?: number;
};

export function rankedRows(boards: Boards, key: RecordKey): Ranked[] {
  if (key === "total") {
    return boards.total
      // A masked (blackout) row is on the board by definition even when its
      // tier floor is 0 — dropping it would shift everyone below up a place.
      .filter((r) => r.meters > 0 || r.masked)
      .map((r) => ({ row: r, value: r.meters, sessions: r.sessions }));
  }
  const rows =
    key === "longest"
      ? boards.longest
      : key === "bigday"
        ? boards.bigDay
        : boards.fastest[Number(key) as 5000 | 10000];
  return rows.map((r) => ({ row: r, value: r.value, day: r.day }));
}

/* ------------------------------------------------------- stats page props */

/* What the stats page hands its client-side records section: one ranked
 * list per record, already blanked. Anything a client component receives
 * is in the page source, so a rower the blackout hides from this viewer
 * has their value zeroed HERE and only its shape travels — a digit count
 * for meters, the ##:##.# silhouette for a time (owner rule, 2026-09-05: a
 * time over a known distance is the meters by another route). Name,
 * number, place, day and session count stay. Nothing else from the board
 * row (no instagram, no pct, no piece length) goes along. */
export type RecordRowLite = {
  participantId: string;
  name: string;
  rowerNumber: number;
  division: string;
  value: number;
  day?: string;
  sessions?: number;
  masked?: boolean;
  digits?: number;
  shape?: string;
};

export type RecordsProp = Record<RecordKey, RecordRowLite[]>;

export function liteRecords(boards: Boards, hidden: Set<string>): RecordsProp {
  const out = {} as RecordsProp;
  for (const def of RECORD_DEFS) {
    out[def.key] = rankedRows(boards, def.key).map((r) => {
      const lite: RecordRowLite = {
        participantId: r.row.participantId,
        name: r.row.name,
        rowerNumber: r.row.rowerNumber,
        division: r.row.division,
        value: r.value,
        day: r.day,
        sessions: r.sessions,
      };
      const src = r.row as { masked?: boolean; digits?: number };
      if (!src.masked && !hidden.has(r.row.participantId)) return lite;
      /* A masked total row already carries its digit count from boardView
       * (its meters are the tier floor by then); a record row still holds
       * the truth here on the server, so count it and drop it. */
      return def.kind === "time"
        ? { ...lite, value: 0, masked: true, shape: clockShape(r.value, true) }
        : { ...lite, value: 0, masked: true, digits: src.digits ?? digitCount(r.value) };
    });
  }
  return out;
}

/* The podium plus the viewer's neighbourhood: the top `top` rows and, when
 * the viewer sits deeper, the row above them, their own and the row below
 * — after a gap row when the two runs do not touch, and nothing after
 * (owner call, 2026-09-05: one, two, three, dot dot dot, where you are,
 * the person above and below you). A viewer inside the podium, or no
 * viewer at all, gets the podium alone. */
export function podiumWindow<T>(
  rows: T[],
  meIdx: number,
  top = 3,
): { top: T[]; gap: boolean; ctx: T[]; ctxStart: number } {
  const head = rows.slice(0, top);
  if (meIdx < top) return { top: head, gap: false, ctx: [], ctxStart: top };
  const ctxStart = Math.max(top, meIdx - 1);
  return {
    top: head,
    gap: ctxStart > top,
    ctx: rows.slice(ctxStart, Math.min(rows.length, meIdx + 2)),
    ctxStart,
  };
}
