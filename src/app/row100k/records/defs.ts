import type { Boards, RecordRow, TotalRow } from "@/lib/row100k";

/* The five record boards, shared by the stats-page cards and the
 * full-ranking pages under /row100k/records/[record]. Keys double as the
 * URL segment, so this list IS the routing table for that page. */

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

/* Division filter, carried in the URL (?d=all|m|f) on the ranking pages and
 * held as client state on the stats page. "all" is one combined ranking
 * across both divisions. */
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
