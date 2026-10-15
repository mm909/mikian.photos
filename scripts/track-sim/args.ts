/**
 * Flags for scripts/track-simulate.ts: plain argv parsing (no dependency)
 * and the help text, kept next to the parsing so they cannot drift.
 *
 * Hard-case flags take an optional entry prefix ("B:4:10"); without one
 * they apply to the first entry (team A in LASD26), as spec §12 reads.
 */

export interface Deadzone {
  entry: string | null;
  startMin: number;
  durMin: number;
}
export interface LegRef {
  entry: string | null;
  legNo: number;
  /** --late-tap only: minutes after the tap that it is posted. */
  min: number;
}
export interface OffRoute {
  entry: string | null;
  min: number;
  metres: number;
}

export interface SimArgs {
  event: string | null;
  base: string;
  /** Sim seconds per real second; 0 = as fast as possible, no sleeps. */
  speed: number;
  /** ISO, "now", or relative like "-16h" / "-30m"; null = the default rule. */
  start: string | null;
  fraction: number;
  legKm: number;
  /** Seconds per display unit (mile when the event is imperial, else km). */
  paceS: number;
  paceText: string;
  interval: number;
  secret: string | null;
  crew: string | null;
  seed: number;
  /** Sim seconds between status lines. */
  logEvery: number;
  reset: boolean;
  dryRun: boolean;
  allPhones: boolean;
  deadzones: Deadzone[];
  deadphone: { who: string; all: boolean } | null;
  missTap: LegRef | null;
  lateTap: LegRef | null;
  dupes: boolean;
  offroute: OffRoute | null;
  skewS: number;
  help: boolean;
}

export const HELP = `track-simulate — replay an event against a running dev server (TRACKER_SPEC.md §12)

  npm run track:simulate -- --event lasd26 --speed 60 --reset
  npx tsx scripts/track-simulate.ts --event lasd26 --speed 0 --fraction 0.05 --dry-run

  --event <slug>        events/<slug>.yaml (the only event in events/ when omitted)
  --base <url>          the server (default http://localhost:3000)
  --speed <n>           sim seconds per real second (default 60; 0 = no sleeps, as fast as possible)
  --start <when>        sim clock start: ISO, "now", or relative "-16h" / "-90m"
                        (default: the event's start_time if it is in the past, else now)
  --fraction <0..1>     stop at this share of the route (default 1)
  --leg-km <km>         mean leg length; legs vary ±15 % around it (default 6)
  --pace <m:ss>         base pace per mile (per km for a metric event) (default 7:30)
  --interval <s>        sim seconds between fixes (default 15)
  --secret <s>          Traccar webhook secret (default env TRACKER_TRACCAR_SECRET)
  --crew <k>            crew key (default: the event's resolved crew_key, i.e. env TRACKER_CREW_KEY_<SLUG> or dev-<slug>-crew)
  --seed <n>            random seed, for a reproducible run (default 1)
  --log-every <s>       sim seconds between status lines (default 60)
  --reset               POST /api/track/<slug>/reset first (dev only) to clear previous runs
  --dry-run             no server: print the plan, the first 20 fixes and every handoff
  --all-phones          off-course runners' phones keep reporting from the van (realistic, 7× the traffic)

hard cases (combine freely; [entry:] defaults to the first entry):
  --deadzone [entry:]<startMin>:<durMin>   hold that entry's runner fixes for durMin, then deliver them oldest first in one burst (repeatable)
  --deadphone <A3>[:all]                   that runner's phone is silent on their first leg (":all" = every leg); only the van reports
  --miss-tap [entry:]<legNo>               the crew tap that starts that leg is never sent; the next one arrives normally
  --late-tap [entry:]<legNo>:<min>         that tap is posted <min> minutes after it happened, with the true time
  --dupes                                  post every fix (and every tap) twice
  --offroute [entry:]<min>:<metres>        one fix at that minute sits that far off route, perpendicular to it
  --skew <sec>                             the crew phone's clock is off by this much (client_now and time shifted; the server corrects)

pairs: an entry with \`slots: 2\` in its yaml runs two by two — both runners report (slot B ~15 m behind A),
  every exchange swaps both slots to the next two roster runners with one tap per slot (B a second after A),
  and --miss-tap / --late-tap act on slot A's tap of that exchange while slot B's goes out normally.
`;

class Flags {
  private seen = new Map<string, string[]>();
  constructor(argv: string[]) {
    for (let i = 0; i < argv.length; i++) {
      const tok = argv[i];
      if (!tok.startsWith("--")) throw new Error(`unexpected argument "${tok}" (flags start with --)`);
      let name = tok.slice(2);
      let value: string;
      const eq = name.indexOf("=");
      if (eq >= 0) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        value = argv[++i];
      } else {
        value = "true";
      }
      const list = this.seen.get(name) ?? [];
      list.push(value);
      this.seen.set(name, list);
    }
  }
  has(name: string): boolean {
    return this.seen.has(name);
  }
  get(name: string): string | undefined {
    const l = this.seen.get(name);
    return l ? l[l.length - 1] : undefined;
  }
  all(name: string): string[] {
    return this.seen.get(name) ?? [];
  }
  num(name: string, dflt: number, check: (n: number) => boolean, hint: string): number {
    const raw = this.get(name);
    if (raw === undefined) return dflt;
    const n = Number(raw);
    if (!Number.isFinite(n) || !check(n)) throw new Error(`--${name}: expected ${hint}, got "${raw}"`);
    return n;
  }
}

/** "7:30" → 450; "450" → 450. Seconds per unit. */
export function parsePace(text: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(text);
  if (Number.isFinite(n) && n > 60) return n;
  throw new Error(`--pace: expected m:ss (e.g. 7:30), got "${text}"`);
}

/** ISO, "now", or "-16h" / "-90m" relative to the wall clock. */
export function parseStart(text: string | null, nowMs: number): number | null {
  if (text === null) return null;
  const t = text.trim();
  if (t === "now") return nowMs;
  const rel = /^([+-])(\d+(?:\.\d+)?)([hm])$/.exec(t);
  if (rel) {
    const ms = Number(rel[2]) * (rel[3] === "h" ? 3600e3 : 60e3);
    return nowMs + (rel[1] === "-" ? -ms : ms);
  }
  const abs = Date.parse(t);
  if (!Number.isFinite(abs)) throw new Error(`--start: expected an ISO date-time, "now" or "-16h", got "${text}"`);
  return abs;
}

/** "[entry:]n1[:n2…]" → the entry (if any) and exactly `count` numbers. */
function entryColon(spec: string, count: number, flag: string, shape: string): { entry: string | null; nums: number[] } {
  const parts = spec.split(":");
  let entry: string | null = null;
  if (parts.length === count + 1) entry = parts.shift()!.toUpperCase();
  if (parts.length !== count || parts.some((p) => p.trim() === "" || !Number.isFinite(Number(p)))) {
    throw new Error(`${flag}: expected ${shape}, got "${spec}"`);
  }
  return { entry, nums: parts.map(Number) };
}

export function parseArgs(argv: string[]): SimArgs {
  const f = new Flags(argv);
  const paceText = f.get("pace") ?? "7:30";
  const deadzones = f.all("deadzone").map((spec) => {
    const { entry, nums } = entryColon(spec, 2, "--deadzone", "[entry:]<startMin>:<durMin>");
    if (nums[1] <= 0) throw new Error("--deadzone: durMin must be > 0");
    return { entry, startMin: nums[0], durMin: nums[1] };
  });
  const dp = f.get("deadphone");
  const deadphone = dp ? { who: dp.split(":")[0].toUpperCase(), all: /:all$/i.test(dp) } : null;
  const mt = f.get("miss-tap");
  const missTap = mt ? (({ entry, nums }) => ({ entry, legNo: nums[0], min: 0 }))(entryColon(mt, 1, "--miss-tap", "[entry:]<legNo>")) : null;
  const lt = f.get("late-tap");
  const lateTap = lt ? (({ entry, nums }) => ({ entry, legNo: nums[0], min: nums[1] }))(entryColon(lt, 2, "--late-tap", "[entry:]<legNo>:<min>")) : null;
  const or = f.get("offroute");
  const offroute = or ? (({ entry, nums }) => ({ entry, min: nums[0], metres: nums[1] }))(entryColon(or, 2, "--offroute", "[entry:]<min>:<metres>")) : null;
  const base = (f.get("base") ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    event: f.get("event") ?? null,
    base,
    speed: f.num("speed", 60, (n) => n >= 0, "a number ≥ 0"),
    start: f.get("start") ?? null,
    fraction: f.num("fraction", 1, (n) => n > 0 && n <= 1, "a number in (0, 1]"),
    legKm: f.num("leg-km", 6, (n) => n > 0.5, "kilometres > 0.5"),
    paceS: parsePace(paceText),
    paceText,
    interval: f.num("interval", 15, (n) => n >= 1, "seconds ≥ 1"),
    secret: f.get("secret") ?? null,
    crew: f.get("crew") ?? null,
    seed: f.num("seed", 1, (n) => Number.isInteger(n), "an integer"),
    logEvery: f.num("log-every", 60, (n) => n >= 1, "seconds ≥ 1"),
    reset: f.has("reset"),
    dryRun: f.has("dry-run"),
    allPhones: f.has("all-phones"),
    deadzones,
    deadphone,
    missTap,
    lateTap,
    dupes: f.has("dupes"),
    offroute,
    skewS: f.num("skew", 0, () => true, "seconds"),
    help: f.has("help") || f.has("h"),
  };
}
