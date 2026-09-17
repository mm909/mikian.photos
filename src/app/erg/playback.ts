import { Packet, encodeForceCurve, hrByte, pkt, type Pm5Packet } from "@/lib/pm5/encode";
import { DurationType, MUX_ID, PM5_UUID, RowingState, StrokeState, WorkoutState } from "@/lib/pm5/pm5";
import { thinBy, type TelemetryDoc } from "@/lib/pm5/session";
import type { SourceDriver } from "./hub";

/* PLAYBACK (owner, 2026-09-17: "I want to be able to play back a row like
 * how simulate data simulates data").
 *
 * A saved session is a document of integers. This turns it back into the
 * BYTE PACKETS the monitor sent, in the order and at the spacing it sent
 * them, and hands them to the hub through the same seam the simulator uses.
 * The console is not told: every tile, every chart, every split row and the
 * force curve are built by the code that builds them for an erg in the
 * room. If a replay reads wrong, the live screen reads wrong too, which is
 * the point of doing it the long way.
 *
 * THE TRANSPORT is the difference from the simulator: a piece that already
 * happened can be paused, run at half speed or eight times, scrubbed and
 * restarted. PlaybackBar.tsx drives all of that; nothing here touches
 * React or the DOM.
 *
 * SEEKING DOES NOT REPLAY FROM ZERO. The events are a sorted index into
 * the document, so a seek moves a cursor and then rebuilds the console from
 * the document — every stroke and split up to that point, the status ticks
 * thinned to a few hundred, the force curves of the last handful of
 * strokes. A forty-five minute row scrubs in one tick instead of pushing
 * two hundred thousand packets through the parsers.
 *
 * WHAT IS DERIVED, AND SAID SO. The document keeps what the monitor sends
 * and no more, so four fields on the way back out are worked out rather
 * than remembered: the distance of one stroke (the gap to the stroke
 * before it), calories to this point (the piece total by how far in it is),
 * calories an hour (the Concept2 4W + 300), and the projected finish (this
 * pace held to the target). They are marked at each site. Everything else
 * is the number the monitor sent.
 *
 * NO HEART RATE is shown anywhere on the erg screens this month (owner,
 * 2026-09-17: no belt), but the HR byte is written from the document
 * regardless — it is in the middle of two packets and every field after it
 * moves if it is wrong. */

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/* What the transport strip drives. It is a SourceDriver first: the hub
 * steps it exactly like the simulator and knows nothing of the rest. */
export type PlaybackDriver = SourceDriver & {
  /* The whole piece, in milliseconds of erg time. */
  readonly totalMs: number;
  readonly elapsedMs: number;
  readonly playing: boolean;
  readonly speed: number;
  /* The playhead has run off the end. `done` says the same thing to the
   * hub, which then lets the timer go; PLAY re-arms it. */
  readonly finished: boolean;
  readonly title: string;
  /* Elapsed of every stroke, for SEEK TO A STROKE. */
  readonly strokeTimesMs: number[];
  play(): void;
  pause(): void;
  setSpeed(x: number): void;
  /* Both of these leave the console holding whatever it held: the caller
   * clears the slot first (see PlaybackBar), then the next step rebuilds
   * the piece up to the new playhead. */
  seekMs(ms: number): void;
  seekStroke(n: number): void;
  restart(): void;
};

/* How much of a rebuilt history is worth pushing through the parsers. The
 * charts roll over the last two minutes, so a few hundred status ticks is
 * already more than any of them draw; the strokes are what the per-stroke
 * panel reads, so they are kept far longer. */
const REBUILD_STATUS = 400;
const REBUILD_STROKES = 1_500;
const REBUILD_FORCE = 8;

type Kind = "status" | "stroke" | "force" | "split" | "summary" | "end";
type Ev = { t: number; kind: Kind; i: number };

/* Sorted by time, and at one instant in the order the monitor sends them:
 * the status tick first, so the stroke that lands under it is tagged with
 * the pace and rate showing at the time. */
const RANK: Record<Kind, number> = { status: 0, stroke: 1, force: 2, split: 3, summary: 4, end: 5 };

/* The largest of the three clocks in the document. A piece saved mid-row
 * has no summary, so the last packet is the end of it. */
function docTotalMs(doc: TelemetryDoc): number {
  const lastSample = doc.samples.length ? doc.samples[doc.samples.length - 1].elapsedHundredths : 0;
  const lastStroke = doc.strokes.length ? doc.strokes[doc.strokes.length - 1].elapsedHundredths : 0;
  return Math.max(lastSample * 10, lastStroke * 10, doc.totals.tenths * 100);
}

export function createPlayback(doc: TelemetryDoc, title?: string): PlaybackDriver {
  const totalMs = docTotalMs(doc);
  const name = title ?? `${doc.device.name} · ${doc.totals.meters.toLocaleString("en-US")} m`;

  /* The target the projected finish is measured against: the workout's own
   * when the monitor set one, the piece as rowed otherwise. */
  const byTime = doc.workout.durationType === DurationType.TIME && doc.workout.target > 0;
  const byDistance = doc.workout.durationType === DurationType.DISTANCE && doc.workout.target > 0;
  const targetM = byDistance ? doc.workout.target : doc.totals.meters;
  const targetS = byTime ? doc.workout.target / 100 : doc.totals.tenths / 10;

  /* Split times, for the status packet to name the last one crossed. */
  const splitAt = doc.splits.map((s) => (s.a ? s.a.elapsedS * 1000 : s.b ? s.b.elapsedS * 1000 : totalMs));

  /* Every force curve against the stroke it belongs to. A curve whose
   * stroke is not in the document (the two lists thin independently) rides
   * with the nearest stroke at or before its number. */
  const strokeAt = new Map<number, number>();
  doc.strokes.forEach((s, i) => strokeAt.set(s.n, i));

  /* ---- the index ------------------------------------------------------ */

  const events: Ev[] = [];
  doc.samples.forEach((s, i) => events.push({ t: s.elapsedHundredths * 10, kind: "status", i }));
  doc.strokes.forEach((s, i) => events.push({ t: s.elapsedHundredths * 10, kind: "stroke", i }));
  doc.forceCurves.forEach((c, i) => {
    const si = strokeAt.get(c.n);
    const t = si === undefined ? totalMs : doc.strokes[si].elapsedHundredths * 10;
    events.push({ t, kind: "force", i });
  });
  doc.splits.forEach((_, i) => events.push({ t: splitAt[i], kind: "split", i }));
  /* The three summaries land together at the line, and the monitor then
   * sits on WORKOUT END — but only when this piece really ended. A session
   * saved mid-row simply runs out of packets, which is what happened. */
  if (doc.summary.s39 || doc.summary.s3a || doc.summary.s3c) {
    events.push({ t: totalMs, kind: "summary", i: 0 });
    events.push({ t: totalMs, kind: "end", i: 0 });
  }
  events.sort((a, b) => a.t - b.t || RANK[a.kind] - RANK[b.kind] || a.i - b.i);

  const strokeTimesMs = doc.strokes.map((s) => s.elapsedHundredths * 10);

  /* ---- the packets ---------------------------------------------------- */

  /* The last split crossed at time t, by bisection — a seek cannot keep a
   * walking pointer honest. */
  const splitBefore = (t: number): number => {
    let lo = 0;
    let hi = splitAt.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (splitAt[mid] <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  };

  const statusPackets = (i: number): Pm5Packet[] => {
    const s = doc.samples[i];
    const meters = s.distanceTenths / 10;
    /* DERIVED: calories to this point. The document keeps the piece total
     * and the monitor never sends a running count on 0x33 that survives
     * thinning, so the total is spread over the distance rowed. */
    const calories = targetM > 0 ? Math.round((doc.totals.calories ?? 0) * Math.min(1, meters / targetM)) : 0;
    const sp = splitBefore(s.elapsedHundredths * 10);
    const sb = sp >= 0 ? doc.splits[sp].b : null;
    const sa = sp >= 0 ? doc.splits[sp].a : null;
    /* Metres a second from the split the monitor reported, which is the
     * same number the pace is. */
    const speedMps = s.paceHundredths > 0 ? 50_000 / s.paceHundredths : 0;

    const general = pkt(
      PM5_UUID.generalStatus,
      new Packet(19)
        .u24(s.elapsedHundredths)
        .u24(s.distanceTenths)
        .u8(doc.workout.type)
        .u8(255)
        .u8(WorkoutState.WORKOUTROW)
        .u8(RowingState.ACTIVE)
        .u8(StrokeState.RECOVERY)
        .u24(targetM)
        .u24(doc.workout.target)
        .u8(doc.workout.durationType)
        .u8(s.drag),
    );
    const a1 = pkt(
      PM5_UUID.additionalStatus1,
      new Packet(17)
        .u24(s.elapsedHundredths)
        .u16(speedMps * 1000)
        .u8(s.spm)
        .u8(hrByte(s.hr))
        .u16(s.paceHundredths)
        .u16(s.avgPaceHundredths)
        .u16(0)
        .u24(0)
        .u8(0),
    );
    const a2 = pkt(
      PM5_UUID.additionalStatus2,
      new Packet(20)
        .u24(s.elapsedHundredths)
        .u8(0)
        .u16(doc.totals.avgWatts ?? 0)
        .u16(calories)
        .u16(sb ? sb.avgPaceS * 100 : 0)
        .u16(sb ? sb.powerW : 0)
        .u16(sb ? sb.avgCalories : 0)
        .u24(sa ? sa.splitTimeS * 10 : 0)
        .u24(sa ? sa.splitDistanceM : 0),
    );
    return [general, a1, a2];
  };

  const strokePackets = (i: number): Pm5Packet[] => {
    const s = doc.strokes[i];
    const prev = i > 0 ? doc.strokes[i - 1] : null;
    /* DERIVED: the distance of this stroke. 0x35 carries it; the document
     * does not, so it is the gap to the stroke before — which is what the
     * monitor measured, give or take a thinned stroke. */
    const strokeDistM = prev ? Math.max(0, (s.distanceTenths - prev.distanceTenths) / 10) : s.distanceTenths / 10;
    const elapsedS = s.elapsedHundredths / 100;
    const meters = s.distanceTenths / 10;
    /* DERIVED: the projected finish, this pace held to the target. */
    const projTimeS = byTime ? targetS : meters > 0 && targetM > 0 ? elapsedS * (targetM / meters) : 0;
    const projDistM = byTime ? (elapsedS > 0 ? meters * (targetS / elapsedS) : 0) : targetM;

    const stroke = pkt(
      PM5_UUID.strokeData,
      new Packet(20)
        .u24(s.elapsedHundredths)
        .u24(s.distanceTenths)
        .u8(s.driveLengthCm)
        .u8(s.driveTimeHundredths)
        .u16(s.recoveryTimeHundredths)
        .u16(strokeDistM * 100)
        .u16(s.peakForceTenthsLbf)
        .u16(s.avgForceTenthsLbf)
        .u16(s.workTenthsJ)
        .u16(s.n),
    );
    const more = pkt(
      PM5_UUID.additionalStrokeData,
      new Packet(15)
        .u24(s.elapsedHundredths)
        .u16(s.watts)
        /* DERIVED: calories an hour, the Concept2 4W + 300. */
        .u16(4 * s.watts + 300)
        .u16(s.n)
        .u24(projTimeS)
        .u24(projDistM),
    );
    return [stroke, more];
  };

  const forcePackets = (i: number): Pm5Packet[] => encodeForceCurve(doc.forceCurves[i].points);

  const splitPackets = (i: number): Pm5Packet[] => {
    const { a, b } = doc.splits[i];
    const out: Pm5Packet[] = [];
    if (a) {
      out.push(
        pkt(
          PM5_UUID.splitData,
          new Packet(18)
            .u24(a.elapsedS * 100)
            .u24(a.distanceM * 10)
            .u24(a.splitTimeS * 10)
            .u24(a.splitDistanceM)
            .u16(a.intervalRestTimeS)
            .u16(a.intervalRestDistanceM)
            .u8(a.splitType)
            .u8(a.splitNumber),
        ),
      );
    }
    if (b) {
      out.push(
        pkt(
          PM5_UUID.additionalSplitData,
          new Packet(19)
            .u24(b.elapsedS * 100)
            .u8(b.avgStrokeRate)
            .u8(hrByte(b.workHeartRate))
            .u8(hrByte(b.restHeartRate))
            .u16(b.avgPaceS * 10)
            .u16(b.totalCalories)
            .u16(b.avgCalories)
            .u16(b.speedMps * 1000)
            .u16(b.powerW)
            .u8(b.avgDragFactor)
            .u8(b.splitNumber)
            .u8(b.ergMachineType ?? 0),
        ),
      );
    }
    return out;
  };

  const summaryPackets = (): Pm5Packet[] => {
    const out: Pm5Packet[] = [];
    const s39 = doc.summary.s39;
    const s3a = doc.summary.s3a;
    const s3c = doc.summary.s3c;
    if (s39) {
      out.push(
        pkt(
          PM5_UUID.workoutSummary,
          new Packet(20)
            .u16(s39.logDate)
            .u16(s39.logTime)
            .u24(s39.elapsedHundredths)
            .u24(s39.distanceM * 10)
            .u8(s39.avgStrokeRate)
            .u8(hrByte(s39.endingHeartRate))
            .u8(hrByte(s39.avgHeartRate))
            .u8(hrByte(s39.minHeartRate))
            .u8(hrByte(s39.maxHeartRate))
            .u8(s39.dragFactorAvg)
            .u8(s39.recoveryHeartRate)
            .u8(s39.workoutType)
            .u16((s39.avgPaceS ?? 0) * 10),
        ),
      );
    }
    if (s3a) {
      out.push(
        pkt(
          PM5_UUID.additionalWorkoutSummary1,
          new Packet(19)
            .u16(s3a.logDate)
            .u16(s3a.logTime)
            .u8(s3a.splitType ?? 255)
            .u16(s3a.splitSize)
            .u8(s3a.splitCount)
            .u16(s3a.totalCalories)
            .u16(s3a.watts)
            .u24(s3a.totalRestDistanceM)
            .u16(s3a.intervalRestTimeS)
            .u16(s3a.avgCalories),
        ),
      );
    }
    /* 0x3C lives on 0x80 only, exactly as it does on a monitor. */
    if (s3c) {
      out.push(
        pkt(
          PM5_UUID.multiplexed,
          new Packet(11)
            .u8(MUX_ID.additionalWorkoutSummary2)
            .u16(s3c.logDate)
            .u16(s3c.logTime)
            .u16(s3c.avgPaceS * 10)
            .u8(((s3c.workoutVerified & 0x0f) << 4) | (s3c.gameId & 0x0f))
            .u16(s3c.gameScore)
            .u8(s3c.ergMachineType),
        ),
      );
    }
    return out;
  };

  /* The monitor sitting on WORKOUT END with the piece frozen on it. */
  const endPackets = (): Pm5Packet[] => {
    const s39 = doc.summary.s39;
    const hundredths = s39 ? s39.elapsedHundredths : doc.totals.tenths * 10;
    const tenthsOfM = Math.round((s39 ? s39.distanceM : doc.totals.meters) * 10);
    return [
      pkt(
        PM5_UUID.generalStatus,
        new Packet(19)
          .u24(hundredths)
          .u24(tenthsOfM)
          .u8(doc.workout.type)
          .u8(255)
          .u8(WorkoutState.WORKOUTEND)
          .u8(RowingState.INACTIVE)
          .u8(StrokeState.WAITING_FOR_WHEEL_TO_REACH_MIN_SPEED)
          .u24(targetM)
          .u24(doc.workout.target)
          .u8(doc.workout.durationType)
          .u8(doc.totals.dragFactor ?? 0),
      ),
    ];
  };

  const make = (e: Ev): Pm5Packet[] => {
    if (e.kind === "status") return statusPackets(e.i);
    if (e.kind === "stroke") return strokePackets(e.i);
    if (e.kind === "force") return forcePackets(e.i);
    if (e.kind === "split") return splitPackets(e.i);
    if (e.kind === "summary") return summaryPackets();
    return endPackets();
  };

  /* ---- the playhead --------------------------------------------------- */

  let clock = 0;
  let cursor = 0;
  let playing = true;
  let finished = false;
  let speed: number = 1;
  /* Set by a seek: the next step hands back the piece up to the playhead
   * instead of advancing. */
  let rebuilding = false;

  /* THE REBUILD. Everything before the playhead, at a density the console
   * can swallow in one tick: every split, every summary, the strokes and
   * the status ticks thinned evenly so the whole piece is still there at a
   * coarser step, and only the last few force curves (a chart draws one). */
  const rebuild = (): Pm5Packet[] => {
    const status: number[] = [];
    const strokes: number[] = [];
    const forces: number[] = [];
    for (let i = 0; i < cursor; i++) {
      const k = events[i].kind;
      if (k === "status") status.push(i);
      else if (k === "stroke") strokes.push(i);
      else if (k === "force") forces.push(i);
    }
    const keep = new Set<number>(thinBy(status, Math.max(1, Math.ceil(status.length / REBUILD_STATUS))));
    for (const i of thinBy(strokes, Math.max(1, Math.ceil(strokes.length / REBUILD_STROKES)))) keep.add(i);
    for (const i of forces.slice(-REBUILD_FORCE)) keep.add(i);

    const out: Pm5Packet[] = [];
    for (let i = 0; i < cursor; i++) {
      const e = events[i];
      if ((e.kind === "status" || e.kind === "stroke" || e.kind === "force") && !keep.has(i)) continue;
      out.push(...make(e));
    }
    return out;
  };

  const moveTo = (ms: number) => {
    clock = Math.max(0, Math.min(totalMs, ms));
    let i = 0;
    while (i < events.length && events[i].t <= clock) i++;
    cursor = i;
    finished = false;
    rebuilding = true;
  };

  return {
    label: `PLAYBACK · ${name}`,
    title: name,
    totalMs,
    strokeTimesMs,
    get elapsedMs() {
      return Math.min(clock, totalMs);
    },
    get playing() {
      return playing;
    },
    get speed() {
      return speed;
    },
    get finished() {
      return finished;
    },
    get done() {
      return finished;
    },
    step(dtMs: number): Pm5Packet[] {
      if (rebuilding) {
        rebuilding = false;
        return rebuild();
      }
      if (!playing || finished || dtMs <= 0) return [];
      clock += dtMs * speed;
      const out: Pm5Packet[] = [];
      while (cursor < events.length && events[cursor].t <= clock) out.push(...make(events[cursor++]));
      if (cursor >= events.length && clock >= totalMs) {
        finished = true;
        playing = false;
      }
      return out;
    },
    /* PLAY only lifts the pause. A driver that has run off the end needs a
     * seek first, and a seek is the caller's business because the console
     * has to be emptied in the same breath — see PlaybackBar. */
    play() {
      playing = true;
    },
    pause() {
      playing = false;
    },
    setSpeed(x: number) {
      if (x > 0) speed = x;
    },
    seekMs(ms: number) {
      moveTo(ms);
    },
    seekStroke(n: number) {
      const i = doc.strokes.findIndex((s) => s.n === n);
      moveTo(i >= 0 ? doc.strokes[i].elapsedHundredths * 10 : 0);
    },
    restart() {
      moveTo(0);
      playing = true;
    },
  };
}

/* ---- which slot is playing what --------------------------------------- */

/* The hub holds slots, not drivers: a SourceDriver goes in and is stepped,
 * and nothing asks it anything afterwards. The transport does ask — it
 * needs the playhead of THIS erg — so the drivers are kept here against
 * their slot id. A module map rather than React state for the same reason
 * the hub is one: walking from the monitors list into an erg and back must
 * not lose the playhead. */
const drivers = new Map<string, PlaybackDriver>();

export function rememberPlayback(id: string, driver: PlaybackDriver) {
  drivers.set(id, driver);
}

export function playbackFor(id: string): PlaybackDriver | null {
  return drivers.get(id) ?? null;
}

export function forgetPlayback(id: string) {
  drivers.delete(id);
}
