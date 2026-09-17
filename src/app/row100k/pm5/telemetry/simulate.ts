import { DurationType, MUX_ID, PM5_UUID, RowingState, StrokeState, WorkoutState, WorkoutType } from "../pm5";

/* A SYNTHETIC PM5 (owner, 2026-09-17: a live telemetry screen like a rocket
 * launch — and a way to see the whole console with no monitor in the
 * room). It rows a 2,000 m piece and BUILDS THE REAL BYTE PACKETS, laid out
 * exactly as the spec tables in pm5.ts describe them, so the console reads
 * them through the same parsers the Bluetooth path uses. Nothing here is a
 * shortcut past the bytes.
 *
 * THE PIECE: five seconds on WAIT TO BEGIN, then a stroke every ~2.1 s at
 * 28–32 SPM, 180–260 W a stroke (the pace follows the watts by the
 * Concept2 cube law, which lands around 1:58 /500 m), heart rate climbing
 * 120 → 168 over the distance, drag 122, a bell-shaped 32-point force
 * curve peaking about 180 lbf sent as four 0x3D notifications, split
 * packets at every 500 m, the three summaries at the line (0x3C rides on
 * 0x80, as it does on a real monitor), then WORKOUT END.
 *
 * DRIVEN BY VIRTUAL TIME: step(dtMs) advances the erg and hands back every
 * packet due in that slice — the page calls it from a timer at the chosen
 * sample rate, the scratchpad check calls it in a tight loop. The random
 * numbers are seeded so a check sees the same piece every run. */

export const SIM_DEVICE_NAME = "SIMULATED PM5";

export const SIM_INFO = {
  model: "PM5",
  serial: "000000000",
  hardware: "SIM",
  firmware: "SIM 1.0 (no radio)",
  manufacturer: "Concept2 (simulated)",
  machineType: 0,
} as const;

export type SimPacket = { uuid: string; dv: DataView };

export type Pm5Sim = {
  /* Advance by dtMs of virtual time; the packets due in that slice. */
  step(dtMs: number): SimPacket[];
  /* The status cadence, the way 0x34 sets it on a real monitor. */
  setStatusEvery(ms: number): void;
  readonly done: boolean;
  readonly nowMs: number;
};

const WARM_IN_MS = 5000;
/* Two seconds of status packets on WORKOUT END, then the monitor is quiet. */
const AFTER_END_MS = 2000;
const DRAG = 122;
const SPLIT_M = 500;
const FORCE_POINTS = 32;

/* mulberry32 — small, seedable, good enough for a rowing stroke. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- byte builders: little-endian, like the monitor ---- */

class Packet {
  readonly bytes: Uint8Array;
  private i = 0;
  constructor(n: number) {
    this.bytes = new Uint8Array(n);
  }
  u8(v: number) {
    this.bytes[this.i++] = Math.max(0, Math.min(255, Math.round(v))) & 0xff;
    return this;
  }
  u16(v: number) {
    const x = Math.max(0, Math.min(0xffff, Math.round(v)));
    this.bytes[this.i++] = x & 0xff;
    this.bytes[this.i++] = (x >> 8) & 0xff;
    return this;
  }
  u24(v: number) {
    const x = Math.max(0, Math.min(0xffffff, Math.round(v)));
    this.bytes[this.i++] = x & 0xff;
    this.bytes[this.i++] = (x >> 8) & 0xff;
    this.bytes[this.i++] = (x >> 16) & 0xff;
    return this;
  }
  u32(v: number) {
    const x = Math.max(0, Math.min(0xffffffff, Math.round(v)));
    this.bytes[this.i++] = x & 0xff;
    this.bytes[this.i++] = (x >> 8) & 0xff;
    this.bytes[this.i++] = (x >> 16) & 0xff;
    this.bytes[this.i++] = (x >>> 24) & 0xff;
    return this;
  }
  dv(): DataView {
    return new DataView(this.bytes.buffer);
  }
}

const pkt = (uuid: string, p: Packet): SimPacket => ({ uuid, dv: p.dv() });

/* Concept2: watts = 2.80 / (seconds per metre)^3, so a stroke's speed
 * follows from its watts. 220 W is 1:56.8 /500 m. */
const speedFromWatts = (w: number) => 1 / Math.cbrt(2.8 / w);

/* A packed log date/time the way the monitor would fill it — any value
 * works for the console, it only prints them. */
const LOG_DATE = 0x2b31;
const LOG_TIME = 0x0512;

type Split = { n: number; startS: number; startCal: number; strokes: number; spmSum: number; hrSum: number; wattSum: number; wattN: number };

export function createPm5Sim(opts: { distanceM?: number; seed?: number; statusEveryMs?: number } = {}): Pm5Sim {
  const target = opts.distanceM ?? 2000;
  const rnd = prng(opts.seed ?? 20260917);

  let now = 0;
  let done = false;
  let ended = false;
  let endedAt = 0;
  let sentSummary = false;
  let sentBelt = false;

  /* The erg. */
  let distance = 0;
  let speed = 0;
  let watts = 0;
  let strokeCount = 0;
  let strokeStartMs = 0;
  let strokePeriodS = 2.1;
  let driveTimeS = 0.75;
  let nextStrokeMs = WARM_IN_MS + 2100;
  let calories = 0;
  let wattSum = 0;
  let wattN = 0;
  let spmSum = 0;
  let hrMin = 999;
  let hrMax = 0;
  let hrSum = 0;
  let hrN = 0;
  let lastSplit: { timeS: number; distM: number } | null = null;
  let splitsDone = 0;
  let split: Split = { n: 1, startS: 0, startCal: 0, strokes: 0, spmSum: 0, hrSum: 0, wattSum: 0, wattN: 0 };
  let nextStatusMs = 0;
  let statusEveryMs = opts.statusEveryMs ?? 250;

  const elapsedS = () => Math.max(0, (now - WARM_IN_MS) / 1000);
  const rowing = () => now >= WARM_IN_MS && !ended;
  const hr = () => Math.round(120 + 48 * Math.min(1, distance / target));
  const spm = () => (rowing() && strokeCount > 0 ? Math.round(60 / strokePeriodS) : 0);
  const paceS = () => (speed > 0 ? 500 / speed : 0);
  const avgPaceS = () => (distance > 0 ? (elapsedS() / distance) * 500 : 0);
  const avgWatts = () => (wattN ? wattSum / wattN : 0);
  const state = () => (ended ? WorkoutState.WORKOUTEND : now >= WARM_IN_MS ? WorkoutState.WORKOUTROW : WorkoutState.WAITTOBEGIN);
  const strokeState = () => {
    if (!rowing() || strokeCount === 0) return StrokeState.WAITING_FOR_WHEEL_TO_REACH_MIN_SPEED;
    return now - strokeStartMs < driveTimeS * 1000 ? StrokeState.DRIVING : StrokeState.RECOVERY;
  };

  /* ---- the packets, one builder per characteristic ---- */

  const generalStatus = (): SimPacket =>
    pkt(
      PM5_UUID.generalStatus,
      new Packet(19)
        .u24(elapsedS() * 100)
        .u24(distance * 10)
        .u8(WorkoutType.FIXEDDIST_SPLITS)
        .u8(1)
        .u8(state())
        .u8(rowing() ? RowingState.ACTIVE : RowingState.INACTIVE)
        .u8(strokeState())
        .u24(target)
        .u24(target)
        .u8(DurationType.DISTANCE)
        .u8(DRAG),
    );

  const additionalStatus1 = (): SimPacket =>
    pkt(
      PM5_UUID.additionalStatus1,
      new Packet(17)
        .u24(elapsedS() * 100)
        .u16(speed * 1000)
        .u8(spm())
        .u8(rowing() || ended ? hr() : 255)
        .u16(paceS() * 100)
        .u16(avgPaceS() * 100)
        .u16(0)
        .u24(0)
        .u8(SIM_INFO.machineType),
    );

  const splitAvgPace = () => {
    const d = distance - splitsDone * SPLIT_M;
    const t = elapsedS() - split.startS;
    return d > 0 ? (t / d) * 500 : 0;
  };
  const splitAvgWatts = () => (split.wattN ? split.wattSum / split.wattN : 0);

  const additionalStatus2 = (): SimPacket =>
    pkt(
      PM5_UUID.additionalStatus2,
      new Packet(20)
        .u24(elapsedS() * 100)
        .u8(0)
        .u16(avgWatts())
        .u16(calories)
        .u16(splitAvgPace() * 100)
        .u16(splitAvgWatts())
        .u16(4 * splitAvgWatts() + 300)
        .u24((lastSplit?.timeS ?? 0) * 10)
        .u24(lastSplit?.distM ?? 0),
    );

  const heartRateBelt = (): SimPacket => pkt(PM5_UUID.heartRateBelt, new Packet(6).u8(1).u8(120).u32(0x00c2a5e1));

  const strokePackets = (s: {
    driveLengthM: number;
    recoveryS: number;
    strokeDistM: number;
    peakLbf: number;
    avgLbf: number;
    workJ: number;
    projTimeS: number;
  }): SimPacket[] => {
    const stroke = pkt(
      PM5_UUID.strokeData,
      new Packet(20)
        .u24(elapsedS() * 100)
        .u24(distance * 10)
        .u8(s.driveLengthM * 100)
        .u8(driveTimeS * 100)
        .u16(s.recoveryS * 100)
        .u16(s.strokeDistM * 100)
        .u16(s.peakLbf * 10)
        .u16(s.avgLbf * 10)
        .u16(s.workJ * 10)
        .u16(strokeCount),
    );
    const more = pkt(
      PM5_UUID.additionalStrokeData,
      new Packet(15)
        .u24(elapsedS() * 100)
        .u16(watts)
        .u16(4 * watts + 300)
        .u16(strokeCount)
        .u24(s.projTimeS)
        .u24(target),
    );
    return [stroke, more, ...forceCurvePackets(s.peakLbf)];
  };

  /* A bell over 32 samples, peak a third of the way through the drive, in
   * four notifications of 9, 9, 9 and 5 points: byte 0 = total chunks in
   * the high nibble and this chunk's point count in the low one, byte 1 =
   * the sequence, then uint16 LE points. Zeros at the start, as the real
   * channel shows. */
  const forceCurvePackets = (peakLbf: number): SimPacket[] => {
    const pts: number[] = [];
    for (let i = 0; i < FORCE_POINTS; i++) {
      const x = (i - 11) / 7.5;
      const f = i < 2 ? 0 : peakLbf * Math.exp(-x * x) * (i > 26 ? (FORCE_POINTS - i) / 6 : 1);
      pts.push(Math.round(f));
    }
    const chunks: number[][] = [];
    for (let i = 0; i < pts.length; i += 9) chunks.push(pts.slice(i, i + 9));
    return chunks.map((c, seq) => {
      const p = new Packet(2 + c.length * 2).u8((chunks.length << 4) | c.length).u8(seq);
      for (const v of c) p.u16(v);
      return pkt(PM5_UUID.forceCurve, p);
    });
  };

  const splitPackets = (n: number, timeS: number, avgSpm: number, avgHr: number, avgW: number, cal: number): SimPacket[] => [
    pkt(
      PM5_UUID.splitData,
      new Packet(18)
        .u24(elapsedS() * 100)
        .u24(distance * 10)
        .u24(timeS * 10)
        .u24(SPLIT_M)
        .u16(0)
        .u16(0)
        .u8(1)
        .u8(n),
    ),
    pkt(
      PM5_UUID.additionalSplitData,
      new Packet(19)
        .u24(elapsedS() * 100)
        .u8(avgSpm)
        .u8(avgHr)
        .u8(255)
        .u16((timeS / SPLIT_M) * 500 * 10)
        .u16(cal)
        .u16(4 * avgW + 300)
        .u16((SPLIT_M / timeS) * 1000)
        .u16(avgW)
        .u8(DRAG)
        .u8(n)
        .u8(SIM_INFO.machineType),
    ),
  ];

  const summaryPackets = (): SimPacket[] => {
    const avgSpm = strokeCount ? Math.round(spmSum / strokeCount) : 0;
    const avgHr = hrN ? Math.round(hrSum / hrN) : 0;
    const avgPace = avgPaceS();
    const summary = pkt(
      PM5_UUID.workoutSummary,
      new Packet(20)
        .u16(LOG_DATE)
        .u16(LOG_TIME)
        .u24(elapsedS() * 100)
        .u24(distance * 10)
        .u8(avgSpm)
        .u8(hr())
        .u8(avgHr)
        .u8(hrMin)
        .u8(hrMax)
        .u8(DRAG)
        .u8(0)
        .u8(WorkoutType.FIXEDDIST_SPLITS)
        .u16(avgPace * 10),
    );
    const summary1 = pkt(
      PM5_UUID.additionalWorkoutSummary1,
      new Packet(19)
        .u16(LOG_DATE)
        .u16(LOG_TIME)
        .u8(1)
        .u16(SPLIT_M)
        .u8(splitsDone)
        .u16(calories)
        .u16(avgWatts())
        .u24(0)
        .u16(0)
        .u16(4 * avgWatts() + 300),
    );
    /* 0x3C only exists on 0x80: ID byte, then the ten bytes. */
    const summary2 = pkt(
      PM5_UUID.multiplexed,
      new Packet(11)
        .u8(MUX_ID.additionalWorkoutSummary2)
        .u16(LOG_DATE)
        .u16(LOG_TIME)
        .u16(avgPace * 10)
        .u8(1 << 4)
        .u16(0)
        .u8(SIM_INFO.machineType),
    );
    return [summary, summary1, summary2];
  };

  /* ---- the stroke: new watts, new speed, the packets ---- */

  const takeStroke = (): SimPacket[] => {
    strokeCount++;
    strokeStartMs = now;
    watts = Math.round(180 + rnd() * 80);
    speed = speedFromWatts(watts);
    const spmNow = 28 + rnd() * 4;
    strokePeriodS = 60 / spmNow;
    driveTimeS = 0.7 + rnd() * 0.1;
    const driveLengthM = 1.35 + rnd() * 0.1;
    const recoveryS = strokePeriodS - driveTimeS;
    const peakLbf = 150 + rnd() * 50;
    const avgLbf = peakLbf * (0.55 + rnd() * 0.1);
    const workJ = watts * strokePeriodS;
    const remaining = Math.max(0, target - distance);
    const projTimeS = elapsedS() + remaining / speed;
    nextStrokeMs = now + strokePeriodS * 1000;

    wattSum += watts;
    wattN++;
    spmSum += Math.round(spmNow);
    const h = hr();
    hrSum += h;
    hrN++;
    hrMin = Math.min(hrMin, h);
    hrMax = Math.max(hrMax, h);
    split.strokes++;
    split.spmSum += Math.round(spmNow);
    split.hrSum += h;
    split.wattSum += watts;
    split.wattN++;

    return strokePackets({ driveLengthM, recoveryS, strokeDistM: speed * strokePeriodS, peakLbf, avgLbf, workJ, projTimeS });
  };

  /* Distance and calories between events, at the current stroke's speed. */
  const integrate = (toMs: number) => {
    const dt = (toMs - now) / 1000;
    if (dt > 0 && rowing() && speed > 0) {
      distance = Math.min(target, distance + speed * dt);
      calories += ((4 * watts + 300) * dt) / 3600;
    }
    now = toMs;
  };

  const crossSplit = (): SimPacket[] => {
    const out: SimPacket[] = [];
    while (distance >= (splitsDone + 1) * SPLIT_M - 1e-9 && splitsDone < target / SPLIT_M) {
      const n = splitsDone + 1;
      const timeS = elapsedS() - split.startS;
      const cal = Math.round(calories - split.startCal);
      const avgSpm = split.strokes ? Math.round(split.spmSum / split.strokes) : 0;
      const avgHr = split.strokes ? Math.round(split.hrSum / split.strokes) : 0;
      out.push(...splitPackets(n, timeS, avgSpm, avgHr, Math.round(splitAvgWatts()), cal));
      lastSplit = { timeS, distM: SPLIT_M };
      splitsDone = n;
      split = { n: n + 1, startS: elapsedS(), startCal: calories, strokes: 0, spmSum: 0, hrSum: 0, wattSum: 0, wattN: 0 };
    }
    return out;
  };

  const statusPackets = (): SimPacket[] => {
    const out: SimPacket[] = [];
    if (!sentBelt) {
      sentBelt = true;
      out.push(heartRateBelt());
    }
    out.push(generalStatus(), additionalStatus1(), additionalStatus2());
    return out;
  };

  return {
    get done() {
      return done;
    },
    get nowMs() {
      return now;
    },
    step(dtMs: number): SimPacket[] {
      if (done || dtMs <= 0) return [];
      const out: SimPacket[] = [];
      const until = now + dtMs;
      /* Events in time order: whichever of the status tick and the next
       * stroke comes first, until the slice is used up. */
      for (;;) {
        const strokeDue = rowing() ? nextStrokeMs : Number.POSITIVE_INFINITY;
        const next = Math.min(nextStatusMs, strokeDue);
        if (next > until) break;
        integrate(next);
        if (next === strokeDue) {
          out.push(...takeStroke());
        } else {
          out.push(...statusPackets());
          nextStatusMs += statusEveryMs;
        }
        out.push(...crossSplit());
        if (!ended && distance >= target) {
          ended = true;
          endedAt = now;
          speed = 0;
          if (!sentSummary) {
            sentSummary = true;
            out.push(...summaryPackets(), generalStatus());
          }
        }
        if (ended && now - endedAt >= AFTER_END_MS) {
          done = true;
          break;
        }
      }
      if (!done) integrate(until);
      return out;
    },
    setStatusEvery(ms: number) {
      if (ms > 0) statusEveryMs = ms;
    },
  };
}
