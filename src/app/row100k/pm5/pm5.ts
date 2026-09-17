/* THE PM5 OVER BLUETOOTH — the pure half (owner, 2026-09-16: a barebones UI
 * to try live results in the gym). UUIDs, the enums, the byte parsers and
 * the formatters. NO DOM, NO REACT: this file is what the scratchpad check
 * feeds synthetic DataViews through, and what Pm5Live.tsx calls from its
 * notification handlers.
 *
 * SOURCE: Concept2 "PM Bluetooth Smart Communications Interface
 * Definition" rev 1.30 (2022-03-02), cross-checked against ergarcade/pm5-base
 * and ErgometerJS. Every multi-byte field is LITTLE-ENDIAN (the spec lists
 * Lo, Mid, Hi); a "uint24" is three bytes Lo/Mid/Hi. Offsets are 0-based in
 * the characteristic value. On the multiplexed characteristic 0x0080 byte 0
 * is the ID and every offset moves +1 — and some payloads differ from the
 * direct ones, which is what the `multiplexed` flags below handle.
 *
 * The parsers are DEFENSIVE: every one checks byteLength before reading and
 * hands back null on a short packet rather than throwing inside a BLE event
 * handler where nobody would see it. */

/* ---- UUIDs ------------------------------------------------------------ */

/* CE06xxxx-43E5-11E4-916C-0800200C9A66, lowercase for Web Bluetooth. */
const uuid = (xxxx: string) => `ce06${xxxx}-43e5-11e4-916c-0800200c9a66`;

export const PM5_UUID = {
  /* The advertised service both open-source bridges filter on. */
  discovery: uuid("0000"),
  infoService: uuid("0010"),
  serialNumber: uuid("0012"),
  controlService: uuid("0020"),
  rowingService: uuid("0030"),
  generalStatus: uuid("0031"),
  additionalStatus1: uuid("0032"),
  additionalStatus2: uuid("0033"),
  /* 1 byte, WRITE: 0 = 1 s, 1 = 500 ms (default), 2 = 250 ms, 3 = 100 ms. */
  sampleRate: uuid("0034"),
  strokeData: uuid("0035"),
  additionalStrokeData: uuid("0036"),
  splitData: uuid("0037"),
  additionalSplitData: uuid("0038"),
  workoutSummary: uuid("0039"),
  additionalWorkoutSummary1: uuid("003a"),
  heartRateBelt: uuid("003b"),
  additionalWorkoutSummary2: uuid("003c"),
  multiplexed: uuid("0080"),
  /* The rest of the information service and the force curve (owner,
   * 2026-09-17: a live telemetry screen like a rocket launch). The race
   * board never reads these; the telemetry page reads all of them. */
  modelNumber: uuid("0011"),
  hardwareRevision: uuid("0013"),
  firmwareRevision: uuid("0014"),
  manufacturer: uuid("0015"),
  ergMachineType: uuid("0016"),
  /* 2 to 288 bytes over several notifications; not on PM5v1. */
  forceCurve: uuid("003d"),
} as const;

/* What requestDevice() is called with. Filtering on the discovery service
 * is what both bridges do; the rowing service HAS to be in optionalServices
 * or getPrimaryService fails later; the info service is there so a card
 * can read the serial. */
export const PM5_REQUEST = {
  filters: [{ services: [PM5_UUID.discovery] }],
  optionalServices: [PM5_UUID.infoService, PM5_UUID.rowingService],
} as const;

/* The ID byte on 0x0080, per payload. */
export const MUX_ID = {
  generalStatus: 0x31,
  additionalStatus1: 0x32,
  additionalStatus2: 0x33,
  strokeData: 0x35,
  additionalStrokeData: 0x36,
  splitData: 0x37,
  additionalSplitData: 0x38,
  workoutSummary: 0x39,
  additionalWorkoutSummary1: 0x3a,
  heartRateBelt: 0x3b,
  additionalWorkoutSummary2: 0x3c,
} as const;

/* Sample rate values for 0x0034. */
export const SAMPLE_RATE = { s1: 0, ms500: 1, ms250: 2, ms100: 3 } as const;

/* ---- enums ------------------------------------------------------------ */

/* OBJ_WORKOUTSTATE_T, spec Appendix A. */
export const WorkoutState = {
  WAITTOBEGIN: 0,
  WORKOUTROW: 1,
  COUNTDOWNPAUSE: 2,
  INTERVALREST: 3,
  INTERVALWORKTIME: 4,
  INTERVALWORKDISTANCE: 5,
  INTERVALRESTENDTOWORKTIME: 6,
  INTERVALRESTENDTOWORKDISTANCE: 7,
  INTERVALWORKTIMETOREST: 8,
  INTERVALWORKDISTANCETOREST: 9,
  WORKOUTEND: 10,
  TERMINATE: 11,
  WORKOUTLOGGED: 12,
  REARM: 13,
} as const;

/* The enum in plain words, for the card. An unknown value prints as its
 * number so a firmware surprise is visible rather than blank. */
const WORKOUT_STATE_WORDS: Record<number, string> = {
  0: "WAITING TO BEGIN",
  1: "ROWING",
  2: "COUNTDOWN PAUSE",
  3: "INTERVAL REST",
  4: "INTERVAL WORK (TIME)",
  5: "INTERVAL WORK (DISTANCE)",
  6: "REST ENDING (TIME)",
  7: "REST ENDING (DISTANCE)",
  8: "WORK TO REST (TIME)",
  9: "WORK TO REST (DISTANCE)",
  10: "WORKOUT END",
  11: "TERMINATED",
  12: "WORKOUT LOGGED",
  13: "RE-ARM",
};

export function workoutStateWord(state: number): string {
  return WORKOUT_STATE_WORDS[state] ?? `STATE ${state}`;
}

/* OBJ_ROWINGSTATE_T */
export const RowingState = { INACTIVE: 0, ACTIVE: 1 } as const;

/* OBJ_STROKESTATE_T */
export const StrokeState = {
  WAITING_FOR_WHEEL_TO_REACH_MIN_SPEED: 0,
  WAITING_FOR_WHEEL_TO_ACCELERATE: 1,
  DRIVING: 2,
  DWELLING_AFTER_DRIVE: 3,
  RECOVERY: 4,
} as const;

/* OBJ_WORKOUTTYPE_T */
export const WorkoutType = {
  JUSTROW_NOSPLITS: 0,
  JUSTROW_SPLITS: 1,
  FIXEDDIST_NOSPLITS: 2,
  FIXEDDIST_SPLITS: 3,
  FIXEDTIME_NOSPLITS: 4,
  FIXEDTIME_SPLITS: 5,
  FIXEDTIME_INTERVAL: 6,
  FIXEDDIST_INTERVAL: 7,
  VARIABLE_INTERVAL: 8,
  VARIABLE_UNDEFINEDREST_INTERVAL: 9,
  FIXED_CALORIE: 10,
  FIXED_WATTMINUTES: 11,
  FIXEDCALS_INTERVAL: 12,
} as const;

/* Workout Duration Type, byte 17 of general status. */
export const DurationType = { TIME: 0x00, CALORIES: 0x40, DISTANCE: 0x80, WATTS: 0xc0 } as const;

/* Heart rate byte: 255 means no belt / invalid. */
export const HR_INVALID = 255;

/* ---- byte helpers ----------------------------------------------------- */

const u8 = (dv: DataView, i: number) => dv.getUint8(i);
const u16 = (dv: DataView, i: number) => dv.getUint16(i, true);
const u24 = (dv: DataView, i: number) => dv.getUint8(i) | (dv.getUint8(i + 1) << 8) | (dv.getUint8(i + 2) << 16);

/* Room for `need` bytes from `o`? The one check every parser makes first. */
const fits = (dv: DataView, o: number, need: number) => o >= 0 && dv.byteLength >= o + need;

/* ---- 0x0031 general status (19 bytes; same layout on 0x0080) ---------- */

export type GeneralStatus = {
  /* Hundredths of a second, as the monitor sends them — the finish time is
   * rounded to tenths from this integer, never from a float. */
  elapsedHundredths: number;
  elapsedS: number;
  distanceM: number;
  workoutType: number;
  intervalType: number;
  workoutState: number;
  rowingState: number;
  strokeState: number;
  totalWorkDistanceM: number;
  /* Raw; scale depends on workoutDurationType (0.01 s when TIME). */
  workoutDuration: number;
  workoutDurationType: number;
  dragFactor: number;
};

export function parseGeneralStatus(dv: DataView, o = 0): GeneralStatus | null {
  if (!fits(dv, o, 19)) return null;
  const elapsedHundredths = u24(dv, o);
  return {
    elapsedHundredths,
    elapsedS: elapsedHundredths / 100,
    distanceM: u24(dv, o + 3) / 10,
    workoutType: u8(dv, o + 6),
    intervalType: u8(dv, o + 7),
    workoutState: u8(dv, o + 8),
    rowingState: u8(dv, o + 9),
    strokeState: u8(dv, o + 10),
    totalWorkDistanceM: u24(dv, o + 11),
    workoutDuration: u24(dv, o + 14),
    workoutDurationType: u8(dv, o + 17),
    dragFactor: u8(dv, o + 18),
  };
}

/* ---- 0x0032 additional status 1 (17 bytes direct, 19 multiplexed) ----- */

export type AdditionalStatus1 = {
  elapsedS: number;
  speedMps: number;
  strokeRate: number;
  /* Null when the byte is 255 (no belt). */
  heartRate: number | null;
  /* Seconds per 500 m. */
  currentPaceS: number;
  averagePaceS: number;
  restDistanceM: number;
  restTimeS: number;
  /* Only on the multiplexed payload; null on the direct one. */
  averagePowerW: number | null;
  ergMachineType: number;
};

export function parseAdditionalStatus1(dv: DataView, o = 0, multiplexed = false): AdditionalStatus1 | null {
  if (!fits(dv, o, multiplexed ? 19 : 17)) return null;
  const hr = u8(dv, o + 6);
  return {
    elapsedS: u24(dv, o) / 100,
    speedMps: u16(dv, o + 3) / 1000,
    strokeRate: u8(dv, o + 5),
    heartRate: hr === HR_INVALID ? null : hr,
    currentPaceS: u16(dv, o + 7) / 100,
    averagePaceS: u16(dv, o + 9) / 100,
    restDistanceM: u16(dv, o + 11),
    restTimeS: u24(dv, o + 13) / 100,
    averagePowerW: multiplexed ? u16(dv, o + 16) : null,
    ergMachineType: u8(dv, o + (multiplexed ? 18 : 16)),
  };
}

/* ---- 0x0033 additional status 2 (20 bytes direct, 18 multiplexed) ----- */

export type AdditionalStatus2 = {
  elapsedS: number;
  intervalCount: number;
  /* Omitted on the multiplexed payload (it rides on 0x32 there instead). */
  averagePowerW: number | null;
  totalCalories: number;
  splitAvgPaceS: number;
  splitAvgPowerW: number;
  splitAvgCalories: number;
  /* 0.1 s lsb on the wire — note, not hundredths like the others. */
  lastSplitTimeS: number;
  lastSplitDistanceM: number;
};

export function parseAdditionalStatus2(dv: DataView, o = 0, multiplexed = false): AdditionalStatus2 | null {
  if (!fits(dv, o, multiplexed ? 18 : 20)) return null;
  /* Everything after Interval Count sits two bytes earlier when Average
   * Power is not there (pm5-base: p = multiplexed ? 0 : 2). */
  const p = multiplexed ? 0 : 2;
  return {
    elapsedS: u24(dv, o) / 100,
    intervalCount: u8(dv, o + 3),
    averagePowerW: multiplexed ? null : u16(dv, o + 4),
    totalCalories: u16(dv, o + 4 + p),
    splitAvgPaceS: u16(dv, o + 6 + p) / 100,
    splitAvgPowerW: u16(dv, o + 8 + p),
    splitAvgCalories: u16(dv, o + 10 + p),
    lastSplitTimeS: u24(dv, o + 12 + p) / 10,
    lastSplitDistanceM: u24(dv, o + 15 + p),
  };
}

/* ---- 0x0039 end of workout summary (20 bytes direct, 18 multiplexed) -- */

export type WorkoutSummary = {
  logDate: number;
  logTime: number;
  elapsedHundredths: number;
  elapsedS: number;
  distanceM: number;
  avgStrokeRate: number;
  endingHeartRate: number | null;
  avgHeartRate: number | null;
  minHeartRate: number | null;
  maxHeartRate: number | null;
  dragFactorAvg: number;
  /* Zero on the first summary; the PM5 sends the summary AGAIN after a
   * minute of rest with this filled in. Expect two of these per piece. */
  recoveryHeartRate: number;
  workoutType: number;
  /* 0.1 s lsb, per 500 m; omitted on the multiplexed payload (0x3C has it). */
  avgPaceS: number | null;
};

const hrOrNull = (v: number) => (v === HR_INVALID ? null : v);

export function parseWorkoutSummary(dv: DataView, o = 0, multiplexed = false): WorkoutSummary | null {
  if (!fits(dv, o, multiplexed ? 18 : 20)) return null;
  const elapsedHundredths = u24(dv, o + 4);
  return {
    logDate: u16(dv, o),
    logTime: u16(dv, o + 2),
    elapsedHundredths,
    elapsedS: elapsedHundredths / 100,
    distanceM: u24(dv, o + 7) / 10,
    avgStrokeRate: u8(dv, o + 10),
    endingHeartRate: hrOrNull(u8(dv, o + 11)),
    avgHeartRate: hrOrNull(u8(dv, o + 12)),
    minHeartRate: hrOrNull(u8(dv, o + 13)),
    maxHeartRate: hrOrNull(u8(dv, o + 14)),
    dragFactorAvg: u8(dv, o + 15),
    recoveryHeartRate: u8(dv, o + 16),
    workoutType: u8(dv, o + 17),
    avgPaceS: multiplexed ? null : u16(dv, o + 18) / 10,
  };
}

/* ---- 0x0080 multiplexed --------------------------------------------- */

export type MuxPacket =
  | { kind: "general"; data: GeneralStatus }
  | { kind: "additional1"; data: AdditionalStatus1 }
  | { kind: "additional2"; data: AdditionalStatus2 }
  | { kind: "summary"; data: WorkoutSummary }
  /* The rest of the IDs (owner, 2026-09-17: the telemetry screen reads
   * every one). The race board's chain ignores these, as it ignored
   * "other" before. */
  | { kind: "stroke"; data: StrokeData }
  | { kind: "additionalStroke"; data: AdditionalStrokeData }
  | { kind: "split"; data: SplitData }
  | { kind: "additionalSplit"; data: AdditionalSplitData }
  | { kind: "additionalSummary1"; data: AdditionalSummary1 }
  | { kind: "heartRateBelt"; data: HeartRateBelt }
  | { kind: "additionalSummary2"; data: AdditionalSummary2 }
  /* An ID nobody here reads. */
  | { kind: "other"; id: number };

/* Byte 0 is the ID (the spec's attribute table and both bridges agree; the
 * overview sentence saying "last byte" is wrong). Payload offsets +1. */
export function parseMultiplexed(dv: DataView): MuxPacket | null {
  if (dv.byteLength < 1) return null;
  const id = u8(dv, 0);
  const o = 1;
  switch (id) {
    case MUX_ID.generalStatus: {
      const data = parseGeneralStatus(dv, o);
      return data ? { kind: "general", data } : null;
    }
    case MUX_ID.additionalStatus1: {
      const data = parseAdditionalStatus1(dv, o, true);
      return data ? { kind: "additional1", data } : null;
    }
    case MUX_ID.additionalStatus2: {
      const data = parseAdditionalStatus2(dv, o, true);
      return data ? { kind: "additional2", data } : null;
    }
    case MUX_ID.workoutSummary: {
      const data = parseWorkoutSummary(dv, o, true);
      return data ? { kind: "summary", data } : null;
    }
    case MUX_ID.strokeData: {
      const data = parseStrokeData(dv, o, true);
      return data ? { kind: "stroke", data } : null;
    }
    case MUX_ID.additionalStrokeData: {
      const data = parseAdditionalStrokeData(dv, o, true);
      return data ? { kind: "additionalStroke", data } : null;
    }
    case MUX_ID.splitData: {
      const data = parseSplitData(dv, o);
      return data ? { kind: "split", data } : null;
    }
    case MUX_ID.additionalSplitData: {
      const data = parseAdditionalSplitData(dv, o, true);
      return data ? { kind: "additionalSplit", data } : null;
    }
    case MUX_ID.additionalWorkoutSummary1: {
      const data = parseAdditionalSummary1(dv, o, true);
      return data ? { kind: "additionalSummary1", data } : null;
    }
    case MUX_ID.heartRateBelt: {
      const data = parseHeartRateBelt(dv, o);
      return data ? { kind: "heartRateBelt", data } : null;
    }
    case MUX_ID.additionalWorkoutSummary2: {
      const data = parseAdditionalSummary2(dv, o);
      return data ? { kind: "additionalSummary2", data } : null;
    }
    default:
      return { kind: "other", id };
  }
}

/* ---- the per-stroke, split and summary payloads the telemetry page reads
 * (owner, 2026-09-17: a live telemetry screen like a rocket launch). Same
 * rules as above: little-endian, byteLength checked first, null on a
 * short packet, `multiplexed` where the 0x0080 payload differs. ---------- */

/* 0x0035 stroke data: 20 bytes direct, 18 multiplexed (work per stroke is
 * dropped there and rides on 0x36 instead; stroke count moves up). */
export type StrokeData = {
  elapsedS: number;
  distanceM: number;
  driveLengthM: number;
  driveTimeS: number;
  recoveryTimeS: number;
  strokeDistanceM: number;
  peakDriveForceLbf: number;
  avgDriveForceLbf: number;
  /* Null on the multiplexed payload. */
  workPerStrokeJ: number | null;
  strokeCount: number;
};

export function parseStrokeData(dv: DataView, o = 0, multiplexed = false): StrokeData | null {
  if (!fits(dv, o, multiplexed ? 18 : 20)) return null;
  return {
    elapsedS: u24(dv, o) / 100,
    distanceM: u24(dv, o + 3) / 10,
    driveLengthM: u8(dv, o + 6) / 100,
    driveTimeS: u8(dv, o + 7) / 100,
    recoveryTimeS: u16(dv, o + 8) / 100,
    strokeDistanceM: u16(dv, o + 10) / 100,
    peakDriveForceLbf: u16(dv, o + 12) / 10,
    avgDriveForceLbf: u16(dv, o + 14) / 10,
    workPerStrokeJ: multiplexed ? null : u16(dv, o + 16) / 10,
    strokeCount: u16(dv, o + (multiplexed ? 16 : 18)),
  };
}

/* 0x0036 additional stroke data: 15 bytes direct, 17 multiplexed (work per
 * stroke, 0.1 J, is appended there). */
export type AdditionalStrokeData = {
  elapsedS: number;
  strokePowerW: number;
  /* cals/hr, as the monitor's own display shows it. */
  strokeCalories: number;
  strokeCount: number;
  projectedWorkTimeS: number;
  projectedWorkDistanceM: number;
  /* Only on the multiplexed payload. */
  workPerStrokeJ: number | null;
};

export function parseAdditionalStrokeData(dv: DataView, o = 0, multiplexed = false): AdditionalStrokeData | null {
  if (!fits(dv, o, multiplexed ? 17 : 15)) return null;
  return {
    elapsedS: u24(dv, o) / 100,
    strokePowerW: u16(dv, o + 3),
    strokeCalories: u16(dv, o + 5),
    strokeCount: u16(dv, o + 7),
    projectedWorkTimeS: u24(dv, o + 9),
    projectedWorkDistanceM: u24(dv, o + 12),
    workPerStrokeJ: multiplexed ? u16(dv, o + 15) / 10 : null,
  };
}

/* 0x0037 split/interval data: 18 bytes, same on 0x0080. */
export type SplitData = {
  elapsedS: number;
  distanceM: number;
  /* 0.1 s lsb on the wire. */
  splitTimeS: number;
  splitDistanceM: number;
  intervalRestTimeS: number;
  intervalRestDistanceM: number;
  splitType: number;
  splitNumber: number;
};

export function parseSplitData(dv: DataView, o = 0): SplitData | null {
  if (!fits(dv, o, 18)) return null;
  return {
    elapsedS: u24(dv, o) / 100,
    distanceM: u24(dv, o + 3) / 10,
    splitTimeS: u24(dv, o + 6) / 10,
    splitDistanceM: u24(dv, o + 9),
    intervalRestTimeS: u16(dv, o + 12),
    intervalRestDistanceM: u16(dv, o + 14),
    splitType: u8(dv, o + 16),
    splitNumber: u8(dv, o + 17),
  };
}

/* 0x0038 additional split/interval data: 19 bytes direct, 18 multiplexed
 * (the payload there stops at the split number, no machine type). */
export type AdditionalSplitData = {
  elapsedS: number;
  avgStrokeRate: number;
  workHeartRate: number | null;
  restHeartRate: number | null;
  /* 0.1 s lsb per 500 m. */
  avgPaceS: number;
  totalCalories: number;
  /* cal/hr */
  avgCalories: number;
  speedMps: number;
  powerW: number;
  avgDragFactor: number;
  splitNumber: number;
  /* Null on the multiplexed payload. */
  ergMachineType: number | null;
};

export function parseAdditionalSplitData(dv: DataView, o = 0, multiplexed = false): AdditionalSplitData | null {
  if (!fits(dv, o, multiplexed ? 18 : 19)) return null;
  return {
    elapsedS: u24(dv, o) / 100,
    avgStrokeRate: u8(dv, o + 3),
    workHeartRate: hrOrNull(u8(dv, o + 4)),
    restHeartRate: hrOrNull(u8(dv, o + 5)),
    avgPaceS: u16(dv, o + 6) / 10,
    totalCalories: u16(dv, o + 8),
    avgCalories: u16(dv, o + 10),
    speedMps: u16(dv, o + 12) / 1000,
    powerW: u16(dv, o + 14),
    avgDragFactor: u8(dv, o + 16),
    splitNumber: u8(dv, o + 17),
    ergMachineType: multiplexed ? null : u8(dv, o + 18),
  };
}

/* 0x003A additional end of workout summary 1: 19 bytes direct, 18
 * multiplexed (the split type byte is dropped and everything after the
 * log time sits one byte earlier; pm5-base: s = multiplexed ? 4 : 5). */
export type AdditionalSummary1 = {
  logDate: number;
  logTime: number;
  /* Null on the multiplexed payload. */
  splitType: number | null;
  /* Metres or seconds, by the split type. */
  splitSize: number;
  splitCount: number;
  totalCalories: number;
  watts: number;
  totalRestDistanceM: number;
  intervalRestTimeS: number;
  /* cals/hr */
  avgCalories: number;
};

export function parseAdditionalSummary1(dv: DataView, o = 0, multiplexed = false): AdditionalSummary1 | null {
  if (!fits(dv, o, multiplexed ? 18 : 19)) return null;
  const s = multiplexed ? o + 4 : o + 5;
  return {
    logDate: u16(dv, o),
    logTime: u16(dv, o + 2),
    splitType: multiplexed ? null : u8(dv, o + 4),
    splitSize: u16(dv, s),
    splitCount: u8(dv, s + 2),
    totalCalories: u16(dv, s + 3),
    watts: u16(dv, s + 5),
    totalRestDistanceM: u24(dv, s + 7),
    intervalRestTimeS: u16(dv, s + 10),
    avgCalories: u16(dv, s + 12),
  };
}

/* 0x003B heart rate belt information: 6 bytes, same on 0x0080. */
export type HeartRateBelt = {
  manufacturerId: number;
  deviceType: number;
  beltId: number;
};

export function parseHeartRateBelt(dv: DataView, o = 0): HeartRateBelt | null {
  if (!fits(dv, o, 6)) return null;
  return {
    manufacturerId: u8(dv, o),
    deviceType: u8(dv, o + 1),
    beltId: dv.getUint32(o + 2, true),
  };
}

/* 0x003C additional end of workout summary 2: 10 bytes, multiplexed only
 * per the spec (pm5-base also lists it as a direct characteristic, so the
 * parser takes a plain offset either way). */
export type AdditionalSummary2 = {
  logDate: number;
  logTime: number;
  /* 0.1 s lsb per 500 m. */
  avgPaceS: number;
  gameId: number;
  workoutVerified: number;
  gameScore: number;
  ergMachineType: number;
};

export function parseAdditionalSummary2(dv: DataView, o = 0): AdditionalSummary2 | null {
  if (!fits(dv, o, 10)) return null;
  const g = u8(dv, o + 6);
  return {
    logDate: u16(dv, o),
    logTime: u16(dv, o + 2),
    avgPaceS: u16(dv, o + 4) / 10,
    gameId: g & 0x0f,
    workoutVerified: g >> 4,
    gameScore: u16(dv, o + 7),
    ergMachineType: u8(dv, o + 9),
  };
}

/* ---- 0x003D force curve ---------------------------------------------- */

/* One notification of a force curve. Spec rev 1.30 p.23: byte 0 carries
 * "MS Nibble = Total number of characteristics for this force curve, LS
 * Nibble = Number of 16-bit data points in the current characteristic",
 * byte 1 is the sequence number, then the points as uint16 little-endian,
 * up to nine per notification (2 + 18 bytes). The points are pounds of
 * force (pm5-force-logger checked the peak of every curve against the
 * 0x35 peak force). Footnote 13: PM5v1 does not support this feature. */
export type ForceCurveChunk = {
  totalChunks: number;
  pointCount: number;
  sequence: number;
  pointsLbf: number[];
};

export function parseForceCurve(dv: DataView, o = 0): ForceCurveChunk | null {
  if (!fits(dv, o, 2)) return null;
  const head = u8(dv, o);
  const totalChunks = head >> 4;
  const pointCount = head & 0x0f;
  if (!fits(dv, o, 2 + pointCount * 2)) return null;
  const pointsLbf: number[] = [];
  for (let i = 0; i < pointCount; i++) pointsLbf.push(u16(dv, o + 2 + i * 2));
  return { totalChunks, pointCount, sequence: u8(dv, o + 1), pointsLbf };
}

export type ForceCurve = {
  pointsLbf: number[];
  peakLbf: number;
  peakIndex: number;
  chunks: number;
};

/* Puts the chunks of one stroke back together. The sequence numbers are
 * taken relative to the first chunk seen (0- or 1-based both work); a
 * sequence that does not move forward, or a chunk count that changes,
 * starts a new curve — so a stroke that lost a notification is thrown
 * away (counted in `dropped`) rather than stitched to the next stroke's
 * chunks; the curve is handed back once every slot is filled. */
export function createForceCurveAssembler() {
  let total = 0;
  let base = -1;
  let lastSeq = -1;
  let parts: (number[] | null)[] = [];
  let dropped = 0;
  const reset = () => {
    total = 0;
    base = -1;
    lastSeq = -1;
    parts = [];
  };
  return {
    reset,
    /* Partial curves discarded because a new one began first. */
    get dropped() {
      return dropped;
    },
    push(chunk: ForceCurveChunk): ForceCurve | null {
      if (chunk.totalChunks < 1) return null;
      if (base < 0 || chunk.totalChunks !== total || chunk.sequence <= lastSeq || chunk.sequence - base >= total) {
        if (base >= 0) dropped++;
        total = chunk.totalChunks;
        base = chunk.sequence;
        parts = new Array<number[] | null>(total).fill(null);
      }
      lastSeq = chunk.sequence;
      parts[chunk.sequence - base] = chunk.pointsLbf;
      if (parts.some((p) => p === null)) return null;
      const pointsLbf = parts.flatMap((p) => p ?? []);
      let peakIndex = 0;
      for (let i = 1; i < pointsLbf.length; i++) if (pointsLbf[i] > pointsLbf[peakIndex]) peakIndex = i;
      const done = { pointsLbf, peakLbf: pointsLbf[peakIndex] ?? 0, peakIndex, chunks: total };
      reset();
      return done;
    },
  };
}

/* ---- words and units for the telemetry head ---------------------------- */

const WORKOUT_TYPE_WORDS: Record<number, string> = {
  0: "JUST ROW",
  1: "JUST ROW · SPLITS",
  2: "FIXED DISTANCE",
  3: "FIXED DISTANCE · SPLITS",
  4: "FIXED TIME",
  5: "FIXED TIME · SPLITS",
  6: "TIME INTERVALS",
  7: "DISTANCE INTERVALS",
  8: "VARIABLE INTERVALS",
  9: "VARIABLE INTERVALS · OPEN REST",
  10: "FIXED CALORIES",
  11: "FIXED WATT-MINUTES",
  12: "CALORIE INTERVALS",
};

export function workoutTypeWord(t: number): string {
  return WORKOUT_TYPE_WORDS[t] ?? `TYPE ${t}`;
}

const ROWING_STATE_WORDS: Record<number, string> = { 0: "INACTIVE", 1: "ACTIVE" };

export function rowingStateWord(s: number): string {
  return ROWING_STATE_WORDS[s] ?? `ROWING ${s}`;
}

const STROKE_STATE_WORDS: Record<number, string> = {
  0: "WAITING FOR MIN SPEED",
  1: "WAITING TO ACCELERATE",
  2: "DRIVE",
  3: "DWELL",
  4: "RECOVERY",
};

export function strokeStateWord(s: number): string {
  return STROKE_STATE_WORDS[s] ?? `STROKE ${s}`;
}

const INTERVAL_TYPE_WORDS: Record<number, string> = {
  0: "TIME",
  1: "DISTANCE",
  2: "REST",
  3: "TIME · OPEN REST",
  4: "DISTANCE · OPEN REST",
  5: "OPEN REST",
  6: "CALORIES",
  7: "CALORIES · OPEN REST",
  8: "WATT-MINUTES",
  9: "WATT-MINUTES · OPEN REST",
  255: "NONE",
};

export function intervalTypeWord(t: number): string {
  return INTERVAL_TYPE_WORDS[t] ?? `INTERVAL ${t}`;
}

const ERG_MACHINE_WORDS: Record<number, string> = {
  0: "ROWERG MODEL D",
  1: "MODEL C",
  2: "MODEL A",
  3: "MODEL B",
  5: "ROWERG MODEL E",
  7: "SIMULATOR",
  8: "DYNAMIC",
  16: "SLIDES A",
  17: "SLIDES B",
  18: "SLIDES C",
  19: "SLIDES D",
  20: "SLIDES E",
  32: "SLIDES DYNAMIC",
  64: "DYNO",
  128: "SKIERG",
  143: "SKI SIMULATOR",
  192: "BIKEERG",
  193: "BIKE · ARMS",
  194: "BIKE · NO ARMS",
  207: "BIKE SIMULATOR",
  224: "MULTIERG ROW",
  225: "MULTIERG SKI",
  226: "MULTIERG BIKE",
};

export function ergMachineTypeWord(t: number): string {
  return ERG_MACHINE_WORDS[t] ?? `MACHINE ${t}`;
}

/* The workout target off general status: "2,000 m", "20:00", "300 cal",
 * "1,200 watt-min". The duration scale follows byte 17. */
export function fmtWorkoutTarget(duration: number, durationType: number): string {
  if (durationType === DurationType.TIME) return fmtClock(duration / 100);
  if (durationType === DurationType.DISTANCE) return fmtMeters(duration);
  if (durationType === DurationType.CALORIES) return `${duration.toLocaleString("en-US")} cal`;
  if (durationType === DurationType.WATTS) return `${duration.toLocaleString("en-US")} watt-min`;
  return `${duration} (type ${durationType})`;
}

/* Whole seconds -> "m:ss" (or "h:mm:ss" past the hour). */
export function fmtClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ms = `${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
  return h ? `${h}:${ms}` : ms;
}

export function fmtWatts(w: number | null | undefined): string {
  if (w === null || w === undefined || !Number.isFinite(w)) return "—";
  return `${Math.round(w)} W`;
}

/* The monitor reports force in pounds; ErgData shows newtons. Both go on
 * the page. */
export const LBF_TO_N = 4.4482216152605;

export function lbfToNewtons(lbf: number): number {
  return lbf * LBF_TO_N;
}

export function fmtForce(lbf: number | null | undefined): string {
  if (lbf === null || lbf === undefined || !Number.isFinite(lbf)) return "—";
  return `${lbf.toFixed(1)} lbf · ${Math.round(lbfToNewtons(lbf))} N`;
}

/* ---- the finish --------------------------------------------------- */

/* A 5,000 m that reads a hair short on the monitor is still the piece —
 * the board wants the time, not a re-row over ten metres of rounding. */
export const FINISH_MIN_M = 4990;

/* Hundredths off the wire -> tenths for the board. Integer arithmetic; a
 * half rounds up (113235 -> 11324). */
export function hundredthsToTenths(hundredths: number): number {
  return Math.round(hundredths / 10);
}

/* 11323 -> "18:52.3", the exact string parseRaceTime on the route reads.
 * (Same shape as raceResults.ts fmtTenths; repeated here so this file
 * stays importable without the database behind that module.) */
export function fmtTenths(tenths: number): string {
  const t = Math.max(0, Math.round(tenths));
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${t % 10}`;
}

/* 113230 hundredths -> "18:52.3". */
export function fmtElapsedHundredths(hundredths: number): string {
  return fmtTenths(hundredthsToTenths(hundredths));
}

/* Seconds per 500 m -> "1:53.2". Zero (no stroke yet) prints as a dash. */
export function fmtPace(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return fmtTenths(Math.round(seconds * 10));
}

/* Metres to the whole metre, with a thin separator. */
export function fmtMeters(m: number): string {
  return `${Math.floor(m).toLocaleString("en-US")} m`;
}

/* The piece is over: WORKOUT END (10), TERMINATE (11, a Menu press before
 * the last metre) or WORKOUT LOGGED (12, where the monitor sits once it
 * has logged the piece — and where a reconnect, a reload or a late pairing
 * finds it). */
const ENDED = new Set<number>([WorkoutState.WORKOUTEND, WorkoutState.TERMINATE, WorkoutState.WORKOUTLOGGED]);

export function isEnded(workoutState: number): boolean {
  return ENDED.has(workoutState);
}

/* Has this piece ended as a finish the board can take? Any ended state
 * counts — a first packet at WORKOUT LOGGED still carries the frozen time
 * — and the distance guard is what stops a 2 k warm-up or a bailed piece
 * landing on the sheet. */
export function isFinish(workoutState: number, distanceM: number): boolean {
  return isEnded(workoutState) && distanceM >= FINISH_MIN_M;
}

/* The monitor is armed for a new piece: the guard that lets one erg row
 * twice in a night without the second finish being swallowed. */
export function isNewPiece(prevState: number | null, state: number): boolean {
  if (prevState === null) return false;
  if (state === WorkoutState.WAITTOBEGIN || state === WorkoutState.REARM) return prevState !== state;
  return false;
}

/* The wave start: the first erg going from waiting to rowing. */
export function isPieceStart(prevState: number | null, state: number): boolean {
  return prevState === WorkoutState.WAITTOBEGIN && state === WorkoutState.WORKOUTROW;
}

/* ---- Web Bluetooth types ---------------------------------------------- */

/* The DOM lib in this TypeScript (5.9) does not ship Bluetooth types and
 * @types/web-bluetooth is not installed, so the slice this page uses is
 * declared here — as PLAIN INTERFACES, not a Navigator augmentation, so
 * installing the real types one day cannot collide. Pm5Live.tsx reaches
 * navigator.bluetooth through a cast. */

export type BleRequestOptions = {
  filters?: ReadonlyArray<{ services?: ReadonlyArray<string>; namePrefix?: string }>;
  optionalServices?: ReadonlyArray<string>;
};

export interface BleCharacteristic {
  readonly uuid: string;
  readonly value: DataView | null;
  startNotifications(): Promise<BleCharacteristic>;
  stopNotifications(): Promise<BleCharacteristic>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  addEventListener(type: "characteristicvaluechanged", listener: (ev: Event) => void): void;
  removeEventListener(type: "characteristicvaluechanged", listener: (ev: Event) => void): void;
}

export interface BleService {
  readonly uuid: string;
  getCharacteristic(uuid: string): Promise<BleCharacteristic>;
}

export interface BleGattServer {
  readonly connected: boolean;
  connect(): Promise<BleGattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleService>;
}

export interface BleDevice {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BleGattServer;
  addEventListener(type: "gattserverdisconnected", listener: (ev: Event) => void): void;
  removeEventListener(type: "gattserverdisconnected", listener: (ev: Event) => void): void;
}

export interface BleBluetooth {
  requestDevice(options: BleRequestOptions): Promise<BleDevice>;
  getAvailability?(): Promise<boolean>;
}

/* "PM5 430343693" -> "430343693"; anything else comes back as it is. */
export function serialFromName(name: string | undefined): string {
  if (!name) return "PM5";
  const m = /^PM\d\s+(\d+)/.exec(name);
  return m ? m[1] : name;
}
