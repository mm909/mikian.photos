/**
 * Live tracker simulator (TRACKER_SPEC.md §12).
 *
 *   npm run track:simulate -- --event lasd26 --speed 60 --reset
 *   npx tsx scripts/track-simulate.ts --event lasd26 --speed 0 --fraction 0.05 --dry-run
 *   npx tsx scripts/track-simulate.ts --help
 *
 * Replays an event against a RUNNING dev server through the real HTTP
 * endpoints of the URL contract — the Traccar webhook for runner phones,
 * the web adapter for the van, the crew handoff API for taps — never by
 * writing to the database. Each entry runs legs of ~5–7 km, rotating its
 * participants in order; at every exchange the crew tap is posted and the
 * van drives on to the NEXT exchange and waits there, so its fixes sit
 * ahead of the runner (they must not advance progress). Teams differ in
 * pace by ~3 % so a gap forms. The hard cases of §12 are flags; see
 * scripts/track-sim/args.ts (--help) for all of them.
 *
 * PAIRS (owner, 2026-10-15: "we are running two by two"): an entry with
 * `slots: 2` has two runners on course at once. They run side by side —
 * the slot B runner's phone reports ~15 m behind A's on the same progress —
 * and at every exchange BOTH slots swap to the next two roster runners,
 * one crew tap per slot (slot A's a second before B's, as a crew really
 * taps). The roster rotates two at a time across everyone. An entry with
 * one slot behaves exactly as before.
 *
 * CLOCKS — three, and they must not be confused:
 *   - the SIM clock stamps fixes and taps (fix_time, handoff.time). It
 *     starts at --start and runs at --speed × real time.
 *   - the WALL clock is what the server judges fixes against: stamped more
 *     than 5 min after it → dropped as "future"; before the event's start
 *     − 1 h → "before_start" (INGEST_RULES, spec §8 rule 4).
 *   - a tap's client_now is the WALL clock (+ --skew), because the skew rule
 *     compares it with the server's wall clock, not with the sim.
 * So a replay needs its whole sim timeline behind the wall clock and after
 * the event start − 1 h. Before race day that means: set start_time in
 * events/<slug>.yaml to a day ago, `npm run track:sync`, then run with
 * --reset. The script warns at startup when the plan breaks either rule,
 * and the per-batch tally shows "rejected: future" when it did anyway.
 */

import { randomUUID } from "node:crypto";
import { ids, listEventSlugs, loadEventConfig, readRouteGpx } from "../src/lib/tracker/config";
import { MI } from "../src/lib/tracker/format";
import { pointAtRouteM, routeIndexFromGpx } from "../src/lib/tracker/routeIndex";
import { INGEST_RULES, type DeviceRef, type EntryConfig, type EventConfig, type RouteIndex } from "../src/lib/tracker/types";
import { HELP, parseArgs, parseStart, type Deadzone, type LegRef, type OffRoute, type SimArgs } from "./track-sim/args";
import { Poster, SimFatal, type Delivery, type FixDelivery, type HandoffDelivery } from "./track-sim/http";

/* ─── Tunables that are not flags ─────────────────────────────────────────── */
const GPS_NOISE_M = 8; // σ of the per-fix position noise
const PACE_NOISE = 0.04; // σ of the per-fix speed factor
const TEAM_SPREAD = 0.03; // entry i runs (1 + 0.03·i)× the base pace: a gap forms
const RUNNER_SPREAD = 0.06; // each runner's own offset, ± up to this around the team pace
const VAN_MPS = 18; // ≈ 40 mph: a 6 km hop takes 5–6 min, "a few minutes"
const IN_VAN_EVERY = 4; // --all-phones: off-course phones report every 4th tick
const PAIR_GAP_M = 15; // pairs: each further slot's runner reports this far behind the one before
const PAIR_TAP_GAP_S = 1; // pairs: the crew taps slot B this long after slot A

interface Runner {
  n1: number;
  id: string;
  name: string;
  initials: string;
  /** "A3": the short name plus the 1-based position — what --deadphone names. */
  tag: string;
  device?: DeviceRef;
  paceFactor: number;
  battery: number;
  legs: number;
  distanceM: number;
}

interface EntrySim {
  cfg: EntryConfig;
  id: string;
  short: string;
  paceFactor: number;
  runners: Runner[];
  progressM: number;
  /** The exchange counter: leg 1 runs to exchanges[1]; with pairs every slot's leg shares it. */
  legNo: number;
  legStartMs: number;
  legStartM: number;
  /** Runners on course at once (1 = a classic relay, 2 = pairs), capped by the roster. */
  slots: number;
  /** Roster index of the runner holding each slot (index 0 = slot 1). */
  onCourse: number[];
  vanM: number;
  vanTargetM: number;
  vanBattery: number;
  finished: boolean;
  finishedMs: number | null;
  /** --deadzone: runner fixes held until `untilMs`, then delivered oldest first. */
  hold: { untilMs: number; items: Delivery[] } | null;
  offrouteDone: boolean;
}

/* ─── Small helpers ───────────────────────────────────────────────────────── */

/** Seeded PRNG (mulberry32) so a run is reproducible: --seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;
const M_PER_DEG_LAT = 111320;

/** Move a point by metres east / north. */
function offsetLatLon(lat: number, lon: number, eastM: number, northM: number): { lat: number; lon: number } {
  return { lat: lat + northM / M_PER_DEG_LAT, lon: lon + eastM / (M_PER_DEG_LAT * Math.cos(lat * DEG)) };
}

function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ─── The simulation ──────────────────────────────────────────────────────── */

class Simulation {
  readonly entries: EntrySim[];
  /** Cumulative route metres of the start, every exchange, and the finish. */
  readonly exchanges: number[];
  readonly stopM: number;
  readonly startMs: number;
  readonly eventStartMs: number;
  readonly dtMs: number;
  /** Seconds per metre at the base pace (--pace), before team/runner factors. */
  readonly basePaceSecPerM: number;
  readonly unitM: number;
  readonly unitLabel: string;
  endMs: number;
  tickNo = 0;
  stopping = false;
  private lastLogMs: number;
  private pending: { dueMs: number; d: Delivery }[] = [];
  private readonly rand: () => number;
  private readonly clockFmt: Intl.DateTimeFormat;
  private readonly deadzones: { entry: EntrySim; startMs: number; endMs: number; spec: Deadzone }[];
  private readonly missTap: { entry: EntrySim; legNo: number } | null;
  private readonly lateTap: { entry: EntrySim; legNo: number; min: number } | null;
  private readonly offroute: { entry: EntrySim; min: number; metres: number } | null;

  constructor(
    readonly cfg: EventConfig,
    readonly index: RouteIndex,
    readonly args: SimArgs,
    readonly poster: Poster,
    startMs: number,
  ) {
    this.rand = mulberry32(args.seed);
    this.startMs = startMs;
    this.endMs = startMs;
    this.lastLogMs = startMs;
    this.eventStartMs = Date.parse(cfg.start_time);
    this.dtMs = args.interval * 1000;
    this.unitM = cfg.units === "imperial" ? MI : 1000;
    this.unitLabel = cfg.units === "imperial" ? "mi" : "km";
    this.basePaceSecPerM = args.paceS / this.unitM;
    this.stopM = index.lengthM * args.fraction;
    this.clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: cfg.timezone });

    // Exchange points are places on the course, shared by every entry (the
    // teams hand off at the same spots, at different times). As many legs
    // as --leg-km divides the route into, each ±15 % around the mean, and
    // scaled so they add up to the route exactly — no odd stub at the end.
    const n = Math.max(1, Math.round(index.lengthM / (args.legKm * 1000)));
    const weights = Array.from({ length: n }, () => 0.85 + 0.3 * this.rand());
    const scale = index.lengthM / weights.reduce((a, b) => a + b, 0);
    const ex = [0];
    for (let i = 0; i < n - 1; i++) ex.push(ex[i] + weights[i] * scale);
    ex.push(index.lengthM);
    this.exchanges = ex;

    this.entries = cfg.entries.map((e, i) => {
      // A slot needs a runner: two slots on a one-runner roster is one slot.
      const slots = Math.max(1, Math.min(e.slots ?? 1, e.participants.length));
      return {
        cfg: e,
        id: ids.entry(cfg.slug, e.short_name),
        short: e.short_name.toUpperCase(),
        paceFactor: 1 + TEAM_SPREAD * i,
        runners: e.participants.map((p, j) => ({
          n1: j + 1,
          id: ids.participant(cfg.slug, e.short_name, j + 1, p),
          name: p.name,
          initials: p.initials,
          tag: `${e.short_name.toUpperCase()}${j + 1}`,
          device: p.device,
          paceFactor: 1 + (this.rand() * 2 - 1) * RUNNER_SPREAD,
          battery: 60 + 40 * this.rand(),
          legs: 0,
          distanceM: 0,
        })),
        progressM: 0,
        legNo: 1,
        legStartMs: startMs,
        legStartM: 0,
        slots,
        onCourse: Array.from({ length: slots }, (_, s) => s),
        vanM: 0,
      vanTargetM: ex[1],
      vanBattery: 70 + 30 * this.rand(),
        finished: false,
        finishedMs: null,
        hold: null,
        offrouteDone: false,
      };
    });

    const entryFor = (spec: string | null, flag: string): EntrySim => {
      if (spec === null) return this.entries[0];
      const en = this.entries.find((e) => e.short === spec.toUpperCase());
      if (!en) throw new Error(`${flag}: no entry "${spec}" (have ${this.entries.map((e) => e.short).join(", ")})`);
      return en;
    };
    const legRef = (r: LegRef | null, flag: string) => (r ? { entry: entryFor(r.entry, flag), legNo: r.legNo, min: r.min } : null);
    this.deadzones = args.deadzones.map((z) => ({
      entry: entryFor(z.entry, "--deadzone"),
      startMs: startMs + z.startMin * 60e3,
      endMs: startMs + (z.startMin + z.durMin) * 60e3,
      spec: z,
    }));
    this.missTap = legRef(args.missTap, "--miss-tap");
    this.lateTap = legRef(args.lateTap, "--late-tap");
    const or: OffRoute | null = args.offroute;
    this.offroute = or ? { entry: entryFor(or.entry, "--offroute"), min: or.min, metres: or.metres } : null;
    if (args.deadphone && !this.entries.some((e) => e.runners.some((r) => this.isDeadphone(r)))) {
      throw new Error(`--deadphone: no runner "${args.deadphone.who}" (use a tag like A3, or the initials from the yaml)`);
    }
  }

  /* ── formatting ── */
  clock(ms: number): string {
    return this.clockFmt.format(new Date(ms));
  }
  dist(m: number): string {
    return `${(m / this.unitM).toFixed(1)}${this.unitLabel}`;
  }
  pace(secPerM: number): string {
    const s = Math.round(secPerM * this.unitM);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} /${this.unitLabel}`;
  }
  private note(ms: number, msg: string): void {
    console.log(`${this.clock(ms)}  ${msg}`);
  }

  /* ── randomness ── */
  private gauss(): number {
    const u = 1 - this.rand();
    const v = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private isDeadphone(r: Runner): boolean {
    const d = this.args.deadphone;
    return Boolean(d && (d.who === r.tag || d.who === r.initials.toUpperCase()));
  }

  /* ── the run ── */

  async run(): Promise<void> {
    // Leg 1 starts with a tap at the start line for every entry (spec §9:
    // the on-course runner is whoever the latest tap names), and the van
    // leaves for the first exchange at once.
    const first: Delivery[] = [];
    for (const en of this.entries) this.tap(en, this.startMs, first);
    await this.poster.send(first);

    let t = this.startMs;
    while (!this.stopping && this.entries.some((e) => !e.finished)) {
      const realTick = Date.now();
      const tPrev = t;
      t += this.dtMs;
      this.tickNo++;
      const out: Delivery[] = [];
      this.release(t, out);
      for (const en of this.entries) this.advance(en, tPrev, t, out);
      await this.poster.send(out);
      this.endMs = t;
      if (t - this.lastLogMs >= this.args.logEvery * 1000) {
        this.lastLogMs = t;
        console.log(this.statusLine(t));
      }
      if (this.args.speed > 0) {
        const budget = this.dtMs / this.args.speed - (Date.now() - realTick);
        if (budget > 0) await sleep(budget);
      }
    }
    // Whatever a dead zone or a late tap still holds goes out when the run
    // ends: a phone back in coverage uploads everything it kept.
    const tail: Delivery[] = [];
    this.release(Number.POSITIVE_INFINITY, tail);
    await this.poster.send(tail);
  }

  /** Dead-zone bursts and late taps whose time has come, oldest first. */
  private release(t: number, out: Delivery[]): void {
    for (const en of this.entries) {
      if (en.hold && t >= en.hold.untilMs) {
        this.note(Math.min(t, en.hold.untilMs), `${en.short} back in coverage — ${en.hold.items.length} held fixes upload in one burst, oldest first`);
        out.push(...en.hold.items);
        en.hold = null;
      }
    }
    if (this.pending.length) {
      this.pending.sort((a, b) => a.dueMs - b.dueMs);
      while (this.pending.length && this.pending[0].dueMs <= t) {
        const { d } = this.pending.shift()!;
        if (d.kind === "handoff") this.note(Math.min(t, d.tapMs + this.lateMs()), `${d.label} — tap sent now, ${fmtDur(t - d.tapMs)} late, with the true time`);
        out.push(d);
      }
    }
  }
  private lateMs(): number {
    return (this.lateTap?.min ?? 0) * 60e3;
  }

  /** The runners on course right now, slot order. */
  private onCourse(en: EntrySim): Runner[] {
    return en.onCourse.map((i) => en.runners[i]);
  }

  /** "A3" for one slot, "A3+A4" for a pair. */
  private tags(en: EntrySim): string {
    return this.onCourse(en)
      .map((r) => r.tag)
      .join("+");
  }

  /** The label of slot `s` (1-based) as the yaml names it, else its number. */
  private slotLabel(en: EntrySim, s: number): string {
    return en.cfg.slot_names?.[s - 1] ?? String(s);
  }

  /**
   * This tick's speed: the entry's pace factor times the on-course
   * runners' (a pair runs at the mean of theirs — side by side, one
   * progress), with per-tick noise. One slot: exactly the old draw.
   */
  private speedOf(en: EntrySim): number {
    const rs = this.onCourse(en);
    const runnerFactor = rs.reduce((a, r) => a + r.paceFactor, 0) / rs.length;
    const secPerM = this.basePaceSecPerM * en.paceFactor * runnerFactor;
    return Math.max(0.5, (1 / secPerM) * (1 + PACE_NOISE * this.gauss()));
  }

  private advance(en: EntrySim, tPrev: number, t: number, out: Delivery[]): void {
    if (en.finished) return;
    const v = this.speedOf(en);
    let mPrev = en.progressM;
    let tFrom = tPrev;
    const mNew = mPrev + (v * (t - tPrev)) / 1000;

    // Crossing an exchange inside this tick: the finishing runners' phones
    // report once more from the exchange, the crew taps (one tap per slot),
    // and the next runners carry on for the rest of the tick. Never at the
    // finish line.
    while (en.legNo < this.exchanges.length - 1 && mNew >= this.exchanges[en.legNo] && this.exchanges[en.legNo] < this.stopM) {
      const xM = this.exchanges[en.legNo];
      const tapMs = tFrom + ((xM - mPrev) / (mNew - mPrev)) * (t - tFrom);
      const done = this.onCourse(en);
      this.runnerFixes(en, xM, tapMs, v, out);
      for (const r of done) r.distanceM += xM - en.legStartM;
      const legTime = tapMs - en.legStartMs;
      const legDist = xM - en.legStartM;
      en.legNo += 1;
      // The roster rotates `slots` at a time: R1+R2, then R3+R4, … and round again.
      en.onCourse = en.onCourse.map((i) => (i + en.slots) % en.runners.length);
      en.legStartMs = tapMs;
      en.legStartM = xM;
      en.vanTargetM = this.exchanges[en.legNo]; // the van leaves for the next exchange
      const who = done.map((r) => r.tag).join("+");
      this.note(tapMs, `${en.short}  exchange ${en.legNo - 1} at ${this.dist(xM)}: ${who} ran ${(legDist / 1000).toFixed(1)} km in ${fmtDur(legTime)} (${this.pace(legTime / 1000 / legDist)})`);
      this.tap(en, tapMs, out);
      mPrev = xM;
      tFrom = tapMs;
    }

    if (mNew >= this.stopM) {
      const finMs = tFrom + ((this.stopM - mPrev) / (mNew - mPrev)) * (t - tFrom);
      en.progressM = this.stopM;
      en.finished = true;
      en.finishedMs = finMs;
      for (const r of this.onCourse(en)) r.distanceM += this.stopM - en.legStartM;
      this.runnerFixes(en, this.stopM, finMs, v, out);
      const what = this.stopM >= this.index.lengthM ? "FINISHED" : `reached ${Math.round(this.args.fraction * 100)} % of the route (--fraction)`;
      this.note(finMs, `${en.short}  ${what} after ${fmtDur(finMs - this.startMs)} — ${en.legNo} legs${en.slots > 1 ? ` × ${en.slots} slots` : ""}`);
    } else {
      en.progressM = mNew;
      this.runnerFixes(en, mNew, t, v, out);
    }
    this.vanTick(en, tPrev, t, out);
    if (this.args.allPhones && this.tickNo % IN_VAN_EVERY === 0) this.inVanFixes(en, t, out);
  }

  /**
   * The crew taps that start the entry's current leg, at `tapMs`: one per
   * slot, slot B's a second after A's (PAIR_TAP_GAP_S) the way two thumbs
   * really land. A classic relay sends no `slot` at all, as its crew page
   * does. --miss-tap and --late-tap act on slot A's tap of that exchange;
   * the other slots' taps go out normally, which is what a crew that forgot
   * one of two taps looks like.
   */
  private tap(en: EntrySim, tapMs: number, out: Delivery[]): void {
    const legNo = en.legNo;
    for (let s = 1; s <= en.slots; s++) {
      const r = en.runners[en.onCourse[s - 1]];
      r.legs++;
      const slotTapMs = tapMs + (s - 1) * PAIR_TAP_GAP_S * 1000;
      const slotTag = en.slots > 1 ? `/${this.slotLabel(en, s)}` : "";
      const d: HandoffDelivery = {
        kind: "handoff",
        entryShort: en.short,
        legNo,
        tapMs: slotTapMs,
        label: `${en.short} leg ${legNo}${slotTag} → ${r.tag} ${r.name}`,
        req: {
          client_event_id: randomUUID(),
          entry_id: en.id,
          participant_id: r.id,
          // The crew phone's clock is off by --skew, so the time IT recorded is
          // off by the same amount; the server corrects it from client_now.
          time: new Date(slotTapMs + this.args.skewS * 1000).toISOString(),
          client_now: "", // stamped at send time (Poster)
          source: "simulator",
          ...(en.slots > 1 ? { slot: s } : {}),
        },
      };
      if (s === 1 && this.missTap && this.missTap.entry === en && this.missTap.legNo === legNo) {
        this.note(slotTapMs, `${d.label} — tap NOT sent (--miss-tap)`);
        continue;
      }
      if (s === 1 && this.lateTap && this.lateTap.entry === en && this.lateTap.legNo === legNo) {
        this.note(slotTapMs, `${d.label} — tap held for ${this.lateTap.min} min (--late-tap)`);
        this.pending.push({ dueMs: slotTapMs + this.lateTap.min * 60e3, d });
        continue;
      }
      this.note(slotTapMs, `${d.label} — tap sent`);
      out.push(d);
    }
  }

  /**
   * A fix from every on-course runner's phone at progress `m`: slot A's
   * runner at `m`, each further slot's PAIR_GAP_M behind (never before the
   * start line) — side by side on the road, one progress for the entry.
   */
  private runnerFixes(en: EntrySim, m: number, tMs: number, v: number, out: Delivery[]): void {
    en.onCourse.forEach((idx, s) => this.runnerFix(en, en.runners[idx], Math.max(0, m - s * PAIR_GAP_M), tMs, v, out));
  }

  /** A fix from one on-course runner's own phone (unless it is dead / held). */
  private runnerFix(en: EntrySim, r: Runner, m: number, tMs: number, v: number, out: Delivery[]): void {
    if (!r.device) return;
    // --deadphone: silent while on course, on the first leg (or all of them).
    if (this.isDeadphone(r) && (this.args.deadphone!.all || r.legs === 1)) return;
    let perpM = 0;
    if (this.offroute && this.offroute.entry === en && !en.offrouteDone && tMs >= this.startMs + this.offroute.min * 60e3) {
      perpM = this.offroute.metres;
      en.offrouteDone = true;
      this.note(tMs, `${en.short}  ${r.tag}'s fix placed ${perpM} m off the route (--offroute) — must not move progress`);
    }
    r.battery = Math.max(1, r.battery - (0.1 * this.args.interval) / 60); // GPS on: ~0.1 %/min
    this.emit(en, this.fix(r.device, m, tMs, v, r.battery, `${en.short} · ${r.tag} runner`, perpM), out);
  }

  /** The support van: drives to the next exchange at VAN_MPS, then waits there. */
  private vanTick(en: EntrySim, tPrev: number, t: number, out: Delivery[]): void {
    const dev = en.cfg.vehicle_device;
    if (!dev) return;
    const dtS = (t - tPrev) / 1000;
    let v = 0;
    if (en.vanM < en.vanTargetM) {
      en.vanM = Math.min(en.vanTargetM, en.vanM + VAN_MPS * dtS);
      v = en.vanM < en.vanTargetM ? VAN_MPS : 0;
    }
    en.vanBattery = Math.max(1, en.vanBattery - (0.03 * dtS) / 60);
    // Not subject to the dead zone: the van reports on its own (cell) path.
    out.push(this.fix(dev, en.vanM, t, v, en.vanBattery, `${en.short} van`));
  }

  /** --all-phones: everyone not running is in the van, phone still tracking. */
  private inVanFixes(en: EntrySim, t: number, out: Delivery[]): void {
    const running = new Set(this.onCourse(en));
    for (const r of en.runners) {
      if (!r.device || running.has(r)) continue;
      r.battery = Math.max(1, r.battery - (0.02 * this.args.interval * IN_VAN_EVERY) / 60);
      this.emit(en, this.fix(r.device, en.vanM, t, 0, r.battery, `${en.short} · ${r.tag} in van`), out);
    }
  }

  /** Route the runner fix through the entry's dead zone, if one covers its time. */
  private emit(en: EntrySim, d: FixDelivery, out: Delivery[]): void {
    const z = this.deadzones.find((z) => z.entry === en && d.fixTimeMs >= z.startMs && d.fixTimeMs < z.endMs);
    if (!z) {
      out.push(d);
      return;
    }
    if (!en.hold) {
      en.hold = { untilMs: z.endMs, items: [] };
      this.note(d.fixTimeMs, `${en.short} entered a dead zone until ${this.clock(z.endMs)} — runner fixes are held (--deadzone)`);
    }
    en.hold.items.push(d);
  }

  /** A GPS fix `m` metres along the route, with noise (and an optional perpendicular shove). */
  private fix(dev: DeviceRef, m: number, tMs: number, speedMps: number, battery: number, label: string, perpM = 0): FixDelivery {
    const p = pointAtRouteM(this.index, m);
    let east = GPS_NOISE_M * this.gauss();
    let north = GPS_NOISE_M * this.gauss();
    if (perpM) {
      // Perpendicular to the direction of travel at m, to the left.
      const a = pointAtRouteM(this.index, Math.max(0, m - 20));
      const b = pointAtRouteM(this.index, Math.min(this.index.lengthM, m + 20));
      const dx = (b.lon - a.lon) * M_PER_DEG_LAT * Math.cos(p.lat * DEG);
      const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
      const len = Math.hypot(dx, dy) || 1;
      east += (-dy / len) * perpM;
      north += (dx / len) * perpM;
    }
    const { lat, lon } = offsetLatLon(p.lat, p.lon, east, north);
    return {
      kind: "fix",
      source: dev.source,
      externalId: dev.external_id,
      fixTimeMs: tMs,
      lat,
      lon,
      accuracyM: 5 + 20 * this.rand(),
      speedMps: Math.max(0, speedMps * (1 + 0.1 * this.gauss())),
      batteryPct: battery,
      altitudeM: p.ele,
      routeM: m,
      label,
    };
  }

  /* ── output ── */

  private statusLine(t: number): string {
    const parts = this.entries.map((en) => {
      const bits = [`${en.short} ${this.dist(en.progressM).padStart(7)} L${en.legNo} ${this.tags(en)}`];
      if (en.cfg.vehicle_device) bits.push(`van ${this.dist(en.vanM)}`);
      if (en.hold) bits.push(`held ${en.hold.items.length}`);
      if (en.finished) bits.push("done");
      return bits.join(" ");
    });
    const q = this.pending.length ? ` │ queued ${this.pending.length}` : "";
    return `${this.clock(t)}  ${parts.join(" │ ")}${q} │ ${this.poster.tally.flushDelta()}`;
  }

  header(nowWall: number): void {
    const { cfg, args, index } = this;
    const legLens = this.exchanges.slice(1).map((m, i) => m - this.exchanges[i]);
    const km = (m: number) => (m / 1000).toFixed(1);
    console.log(`track-simulate · ${cfg.slug} · ${cfg.name}`);
    console.log(`  route ${km(index.lengthM)} km (${this.dist(index.lengthM)}) · stop at ${Math.round(args.fraction * 100)} % (${this.dist(this.stopM)}) · ${legLens.length} legs of ${km(Math.min(...legLens))}–${km(Math.max(...legLens))} km`);
    for (const en of this.entries) {
      const dev = en.cfg.vehicle_device;
      const pairs = en.slots > 1 ? ` · ${en.slots} on course at once (slots ${Array.from({ length: en.slots }, (_, s) => this.slotLabel(en, s + 1)).join("+")}, roster rotates ${en.slots} at a time)` : "";
      console.log(`  ${en.short}  ${en.cfg.name} · ${en.runners.length} runners (${en.runners.filter((r) => r.device).length} with phones)${pairs} · ${dev ? `van ${dev.source}:${dev.external_id}` : "no van"} · pace ×${en.paceFactor.toFixed(2)}`);
    }
    const est = this.estimatedMs();
    const real = args.speed > 0 ? ` (≈ ${fmtDur(est / args.speed)} real at ${args.speed}×)` : " (as fast as the server takes it)";
    console.log(`  pace ${args.paceText} /${this.unitLabel} · a fix every ${args.interval} s · about ${fmtDur(est)} of race${real}`);
    console.log(`  sim clock starts ${new Date(this.startMs).toISOString()} = ${this.clock(this.startMs)} ${cfg.timezone} (${this.startMs === this.eventStartMs ? "the event start" : "--start"}) · wall clock ${new Date(nowWall).toISOString()}`);
    console.log(`  server ${args.base} · ${args.dryRun ? "DRY RUN, nothing is sent" : `secret ${args.secret ? "--secret" : "env TRACKER_TRACCAR_SECRET"} · crew key ${args.crew ? "--crew" : cfg.crew_key_from_env ? "from env" : "dev fallback"}`}`);

    // Ingest will drop what the clocks make impossible (spec §8 rule 4); say so now.
    const lead = args.speed > 0 ? this.startMs - nowWall + est * (1 - 1 / args.speed) : this.startMs + est - nowWall;
    if (lead > INGEST_RULES.maxFutureS * 1000) {
      console.log(`  ! the sim clock will run up to ${fmtDur(lead)} AHEAD of the wall clock: fixes stamped more than ${INGEST_RULES.maxFutureS / 60} min ahead are dropped as "future".`);
      console.log(`    Start earlier (--start -${Math.ceil(est / 3600e3)}h) or set start_time in events/${cfg.slug}.yaml to the past and \`npm run track:sync\`.`);
    }
    const beforeLimit = this.eventStartMs - INGEST_RULES.beforeStartS * 1000;
    if (this.startMs < beforeLimit) {
      console.log(`  ! the sim starts before the event's start − 1 h (${new Date(beforeLimit).toISOString()}): those fixes are dropped as "before_start".`);
      console.log(`    Set start_time in events/${cfg.slug}.yaml to ${new Date(this.startMs).toISOString()} or earlier and \`npm run track:sync\`, or use --start.`);
    }

    const look: string[] = [];
    for (const z of this.deadzones) look.push(`deadzone ${z.entry.short} ${this.clock(z.startMs)}–${this.clock(z.endMs)}: the dot should go stale / "showing support van", then the burst lands and legs + pace correct themselves`);
    if (args.deadphone) look.push(`deadphone ${args.deadphone.who}${args.deadphone.all ? " (all legs)" : " (first leg)"}: only the van reports — the dot shows the van waiting AHEAD at the next exchange and progress must hold until the next runner reports`);
    const slotA = (en: EntrySim) => (en.slots > 1 ? ` (slot ${this.slotLabel(en, 1)}'s tap; the other slot's goes out)` : "");
    if (this.missTap) look.push(`miss-tap ${this.missTap.entry.short} leg ${this.missTap.legNo}${slotA(this.missTap.entry)}: never sent — the previous runner appears to run two legs back to back until the crew adds it`);
    if (this.lateTap) look.push(`late-tap ${this.lateTap.entry.short} leg ${this.lateTap.legNo}${slotA(this.lateTap.entry)}: arrives ${this.lateTap.min} min late with the true time — Legs tab shows the old runner on course until then, then corrects`);
    if (args.dupes) look.push(`dupes: every fix and tap goes twice — expect "duplicate" for each second copy and no doubled totals`);
    if (this.offroute) look.push(`offroute ${this.offroute.entry.short} at minute ${this.offroute.min}: one fix ${this.offroute.metres} m off — may show off-route on the map, must not move progress`);
    if (args.skewS) look.push(`skew ${args.skewS} s: tap times arrive ${args.skewS} s off with client_now off by the same — stored time must equal the sim tap time ("handoff skew corrected" in the tally)`);
    if (args.allPhones) look.push(`all-phones: off-course phones report from the van (ahead of the runner) — they must never be the dot or advance progress`);
    if (look.length) console.log(`  hard cases:\n    - ${look.join("\n    - ")}`);
    console.log("");
  }

  /** Rough race duration: the slowest team at the base pace, plus margin. */
  estimatedMs(): number {
    const slowest = 1 + TEAM_SPREAD * (this.entries.length - 1);
    return this.stopM * this.basePaceSecPerM * slowest * 1.03 * 1000;
  }

  summary(realStartMs: number): void {
    console.log(`\n── summary ──`);
    console.log(`  sim ${this.clock(this.startMs)} → ${this.clock(this.endMs)} (${fmtDur(this.endMs - this.startMs)} of race in ${fmtDur(Date.now() - realStartMs)} real) · ${this.tickNo} ticks${this.stopping ? " · STOPPED by Ctrl-C" : ""}`);
    for (const en of this.entries) {
      const elapsed = (en.finishedMs ?? this.endMs) - this.startMs;
      const avg = en.progressM > 0 && elapsed > 0 ? this.pace(elapsed / 1000 / en.progressM) : "—";
      const state = en.finished ? `${this.stopM >= this.index.lengthM ? "finished" : "stopped"} ${this.clock(en.finishedMs!)}` : `at ${Math.round((100 * en.progressM) / this.index.lengthM)} %`;
      const legs = en.slots > 1 ? `${String(en.legNo).padStart(2)} legs × ${en.slots}` : `${String(en.legNo).padStart(2)} legs`;
      console.log(`  ${en.short}  ${en.cfg.name.padEnd(12)} ${this.dist(en.progressM).padStart(8)}  ${legs}  ${state}  elapsed ${fmtDur(elapsed)}  avg ${avg}`);
      console.log(`      ${en.runners.map((r) => `${r.tag} ${r.legs}L ${this.dist(r.distanceM)}`).join(" · ")}`);
    }
    if (this.entries.length > 1) {
      // Distance while they run; once both have stopped at the same place, time.
      const sorted = [...this.entries].sort((a, b) => b.progressM - a.progressM || (a.finishedMs ?? Infinity) - (b.finishedMs ?? Infinity));
      const [lead, next] = sorted;
      const gap = lead.finished && next.finished && lead.progressM === next.progressM ? fmtDur(next.finishedMs! - lead.finishedMs!) : this.dist(lead.progressM - next.progressM);
      console.log(`  gap ${lead.short} → ${next.short}: ${gap}`);
    }
    const t = this.poster.tally.total;
    console.log(`  requests: ${t.size ? [...t.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString("en-US")}`).join(" · ") : "none"}`);
    if (this.args.dryRun) {
      const rec = this.poster.recorded;
      console.log(`\n── would post: first ${rec.fixes.length} of ${rec.fixCount.toLocaleString("en-US")} fixes ──`);
      for (const f of rec.fixes) {
        const path = f.source === "traccar" ? "/api/track/ingest/traccar/<secret>" : `/api/track/${this.cfg.slug}/ingest/web?k=…`;
        console.log(`  ${this.clock(f.fixTimeMs)}  POST ${path}  ${f.externalId.padEnd(14)} ${f.label.padEnd(16)} ${f.lat.toFixed(5)},${f.lon.toFixed(5)}  ±${f.accuracyM.toFixed(0)} m  ${f.speedMps.toFixed(1)} m/s  batt ${Math.round(f.batteryPct)} %  @ ${this.dist(f.routeM)}`);
      }
      console.log(`\n── would post: all ${rec.handoffs.length} handoffs (POST /api/track/${this.cfg.slug}/handoffs?k=…) ──`);
      for (const h of rec.handoffs) {
        const slot = h.req.slot !== undefined ? `  slot=${h.req.slot}` : "";
        console.log(`  ${this.clock(h.tapMs)}  ${h.label.padEnd(30)} time=${h.req.time}${slot}  participant_id=${h.req.participant_id}  client_event_id=${h.req.client_event_id.slice(0, 8)}…`);
      }
    }
  }
}

/* ─── main ────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  let slug = args.event;
  if (!slug) {
    const all = listEventSlugs();
    if (all.length !== 1) throw new Error(`--event is required (events/ has ${all.length ? all.join(", ") : "no event files"})`);
    slug = all[0];
  }
  const cfg = loadEventConfig(slug);
  const { index } = routeIndexFromGpx(readRouteGpx(cfg.route));
  if (index.lengthM < 1000) throw new Error(`events/${cfg.route}: route is only ${index.lengthM.toFixed(0)} m long`);

  const nowWall = Date.now();
  const eventStartMs = Date.parse(cfg.start_time);
  const startMs = parseStart(args.start, nowWall) ?? (eventStartMs <= nowWall ? eventStartMs : nowWall);

  const secret = args.secret ?? (process.env.TRACKER_TRACCAR_SECRET ?? "").trim();
  // The sim drives the one `vehicle_device`; the extra `vehicle_devices` (the web van page's fallback) stay silent.
  const usesTraccar = cfg.entries.some((e) => e.participants.some((p) => p.device?.source === "traccar") || e.vehicle_device?.source === "traccar");
  if (!secret && usesTraccar && !args.dryRun) {
    throw new Error("no Traccar secret: pass --secret or set TRACKER_TRACCAR_SECRET in .env.local (the dev server reads the same file)");
  }
  const crewKey = args.crew ?? cfg.crew_key ?? "";
  if (!crewKey && !args.dryRun) throw new Error(`no crew key for ${slug}: pass --crew or set TRACKER_CREW_KEY_${slug.toUpperCase()}`);

  const poster = new Poster({ base: args.base, slug, secret: secret || "<secret>", crewKey: crewKey || "<crew>", dupes: args.dupes, skewMs: args.skewS * 1000, dryRun: args.dryRun });
  const sim = new Simulation(cfg, index, args, poster, startMs);
  sim.header(nowWall);

  if (args.reset) console.log(`  reset: ${await poster.reset()}\n`);

  let interrupts = 0;
  process.on("SIGINT", () => {
    interrupts++;
    if (interrupts > 1) process.exit(130);
    sim.stopping = true;
    console.log("\n  Ctrl-C — finishing this batch, then the summary (press again to quit at once)");
  });

  const realStart = Date.now();
  try {
    await sim.run();
  } finally {
    sim.summary(realStart);
  }
  if (sim.stopping) process.exitCode = 130;
}

main().catch((err: unknown) => {
  if (err instanceof SimFatal) {
    console.error(`\nFATAL: ${err.message}`);
    if (err.body) console.error(`  response: ${err.body.slice(0, 2000)}`);
    process.exit(2);
  }
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  if (process.argv.includes("--debug") && err instanceof Error) console.error(err.stack);
  process.exit(1);
});
