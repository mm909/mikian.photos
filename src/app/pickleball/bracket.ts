/* THE DOUBLE-ELIMINATION ENGINE (/pickleball): pure functions, no React
 * and no db, so the page, the APIs, the canvas stickers and the test
 * script all replay the same bracket. The db stores only the TEAMS (with
 * their locked seeds) and the REPORTED RESULTS (match key + the two team
 * ids + the two scores); who stands in which match, the byes and the
 * champion are REPLAYED from those on every read. A corrected early
 * result silently invalidates any downstream result whose teams no
 * longer stand in that match, so a fixed typo can never corrupt the
 * rounds after it. The grand final is ONE match (owner, 2026-11-02: "one
 * grand final" — no bracket reset).
 *
 * Checked by hand: npx tsx src/app/pickleball/bracket.test.ts */

export type Reported = {
  matchKey: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  reportedBy?: string;
};

export type MatchState = {
  key: string;
  bracket: "W" | "L" | "GF";
  round: number;
  index: number;
  /* Team ids; null while unknown (feeder unplayed, or a bye flows
   * through — `aFrom`/`bFrom` says which). */
  a: string | null;
  b: string | null;
  /* Where an empty slot fills from ("Winner of L2 · 1"); "" on a slot
   * seeded directly. */
  aFrom: string;
  bFrom: string;
  /* Oriented to (a, b); null until reported. */
  scoreA: number | null;
  scoreB: number | null;
  winner: string | null;
  loser: string | null;
  /* Resolved without play — a bye flowed through. */
  bye: boolean;
  /* Both teams stand and no score yet: reportable. */
  ready: boolean;
  reportedBy: string;
};

export type BracketState = {
  /* Bracket size — the next power of two over the team count. */
  p: number;
  matches: MatchState[];
  winners: MatchState[][];
  losers: MatchState[][];
  final: MatchState;
  champion: string | null;
  runnerUp: string | null;
  played: number;
  total: number;
};

/* Reserved id a bye flows through as; a cuid can never collide with it. */
export const BYE = "BYE";

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 2);
}

/* Seed numbers (1-based) in bracket-position order, so 1 meets 2 only in
 * the final: p=8 → [1,8,4,5,2,7,3,6]. */
export function seedSlots(p: number): number[] {
  let arr = [1];
  while (arr.length < p) {
    const n = arr.length * 2;
    const next: number[] = [];
    for (const s of arr) next.push(s, n + 1 - s);
    arr = next;
  }
  return arr;
}

type Feed = { kind: "seed"; slot: number } | { kind: "winner"; key: string } | { kind: "loser"; key: string };
type Spec = { key: string; bracket: "W" | "L" | "GF"; round: number; index: number; a: Feed; b: Feed };

/* Every match of a size-p bracket with where its two slots fill from.
 * Winners: W<round>-<index>. Losers: L<d>-<index> where odd d is a minor
 * round (losers-bracket survivors pair up) and even d a major one (a
 * survivor meets a dropper from winners round d/2+1, the drop order
 * reversed on alternating rounds so round-one opponents don't rematch at
 * once). GF: the unbeaten team against the losers-bracket winner. */
export function bracketSpec(p: number): Spec[] {
  const wr = Math.log2(p);
  const order = seedSlots(p);
  const specs: Spec[] = [];
  for (let r = 1; r <= wr; r++) {
    const count = p / 2 ** r;
    for (let i = 0; i < count; i++) {
      specs.push({
        key: `W${r}-${i}`,
        bracket: "W",
        round: r,
        index: i,
        a: r === 1 ? { kind: "seed", slot: order[2 * i] - 1 } : { kind: "winner", key: `W${r - 1}-${2 * i}` },
        b: r === 1 ? { kind: "seed", slot: order[2 * i + 1] - 1 } : { kind: "winner", key: `W${r - 1}-${2 * i + 1}` },
      });
    }
  }
  const lr = p >= 4 ? 2 * (wr - 1) : 0;
  for (let d = 1; d <= lr; d++) {
    const count = p / 2 ** (Math.ceil(d / 2) + 1);
    for (let i = 0; i < count; i++) {
      let a: Feed;
      let b: Feed;
      if (d === 1) {
        a = { kind: "loser", key: `W1-${2 * i}` };
        b = { kind: "loser", key: `W1-${2 * i + 1}` };
      } else if (d % 2 === 0) {
        const j = (d / 2) % 2 === 1 ? count - 1 - i : i;
        a = { kind: "winner", key: `L${d - 1}-${i}` };
        b = { kind: "loser", key: `W${d / 2 + 1}-${j}` };
      } else {
        a = { kind: "winner", key: `L${d - 1}-${2 * i}` };
        b = { kind: "winner", key: `L${d - 1}-${2 * i + 1}` };
      }
      specs.push({ key: `L${d}-${i}`, bracket: "L", round: d, index: i, a, b });
    }
  }
  specs.push({
    key: "GF",
    bracket: "GF",
    round: 1,
    index: 0,
    a: { kind: "winner", key: `W${wr}-0` },
    b: lr > 0 ? { kind: "winner", key: `L${lr}-0` } : { kind: "loser", key: "W1-0" },
  });
  return specs;
}

export function matchLabel(m: { bracket: "W" | "L" | "GF"; round: number; index: number }): string {
  if (m.bracket === "GF") return "Grand final";
  return `${m.bracket === "W" ? "Winners" : "Losers"} R${m.round} · ${m.index + 1}`;
}

/* The whole bracket, replayed. `teamsInSeedOrder` is the locked order,
 * seed 1 first; slots past the team count are byes. */
export function replay(teamsInSeedOrder: string[], results: Reported[]): BracketState {
  const p = nextPow2(teamsInSeedOrder.length);
  const specs = bracketSpec(p);
  const resByKey = new Map(results.map((r) => [r.matchKey, r]));
  const won = new Map<string, string>();
  const lost = new Map<string, string>();

  const feedVal = (f: Feed): string | null => {
    if (f.kind === "seed") return teamsInSeedOrder[f.slot] ?? BYE;
    const m = f.kind === "winner" ? won : lost;
    return m.get(f.key) ?? null;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const s of specs) {
      if (won.has(s.key)) continue;
      const a = feedVal(s.a);
      const b = feedVal(s.b);
      if (a === null || b === null) continue;
      if (a === BYE || b === BYE) {
        won.set(s.key, a === BYE ? b : a);
        lost.set(s.key, BYE);
        changed = true;
        continue;
      }
      const r = resByKey.get(s.key);
      if (!r || r.scoreA === r.scoreB) continue;
      const pair = new Set([r.teamAId, r.teamBId]);
      if (pair.size !== 2 || !pair.has(a) || !pair.has(b)) continue; /* stale — an upstream correction */
      const winner = r.scoreA > r.scoreB ? r.teamAId : r.teamBId;
      won.set(s.key, winner);
      lost.set(s.key, winner === a ? b : a);
      changed = true;
    }
  }

  const fromLabel = (f: Feed): string => {
    if (f.kind === "seed") return "";
    const [b, rest] = [f.key[0], f.key.slice(1)];
    const [round, index] = rest.split("-").map(Number);
    return `${f.kind === "winner" ? "Winner" : "Loser"} of ${matchLabel({ bracket: b as "W" | "L", round, index })}`;
  };

  const out: MatchState[] = specs.map((s) => {
    const aRaw = feedVal(s.a);
    const bRaw = feedVal(s.b);
    const a = aRaw === BYE ? null : aRaw;
    const b = bRaw === BYE ? null : bRaw;
    const w = won.get(s.key) ?? null;
    const winner = w === BYE ? null : w;
    const l = lost.get(s.key) ?? null;
    const bye = won.has(s.key) && (aRaw === BYE || bRaw === BYE);
    const r = !bye && winner !== null ? resByKey.get(s.key) ?? null : null;
    const oriented = r ? (r.teamAId === a ? [r.scoreA, r.scoreB] : [r.scoreB, r.scoreA]) : null;
    return {
      key: s.key,
      bracket: s.bracket,
      round: s.round,
      index: s.index,
      a,
      b,
      aFrom: aRaw === BYE ? "Bye" : fromLabel(s.a),
      bFrom: bRaw === BYE ? "Bye" : fromLabel(s.b),
      scoreA: oriented ? oriented[0] : null,
      scoreB: oriented ? oriented[1] : null,
      winner,
      loser: l === BYE ? null : l,
      bye,
      ready: a !== null && b !== null && !won.has(s.key),
      reportedBy: r?.reportedBy ?? "",
    };
  });

  const byKey = new Map(out.map((m) => [m.key, m]));
  const wr = Math.log2(p);
  const winners: MatchState[][] = [];
  for (let r = 1; r <= wr; r++) winners.push(out.filter((m) => m.bracket === "W" && m.round === r));
  const losers: MatchState[][] = [];
  const lr = p >= 4 ? 2 * (wr - 1) : 0;
  for (let d = 1; d <= lr; d++) losers.push(out.filter((m) => m.bracket === "L" && m.round === d));
  const final = byKey.get("GF") as MatchState;
  const playable = out.filter((m) => !m.bye);
  return {
    p,
    matches: out,
    winners,
    losers,
    final,
    champion: final.winner,
    runnerUp: final.winner ? (final.winner === final.a ? final.b : final.a) : null,
    played: playable.filter((m) => m.winner !== null).length,
    total: playable.length,
  };
}

/* Score sanity for one game to 11 played loose (win by 2 not enforced —
 * rec play caps games all sorts of ways; the only hard rules are "a
 * number" and "not a tie"). */
export function readScore(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 30) return null;
  return n;
}
