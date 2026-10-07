/**
 * The pure parts of ingest (TRACKER_SPEC.md §8): the Traccar and web
 * adapters and the junk-rule classifier. Nothing here opens a database —
 * ingestRules.ts and the adapters have no Prisma import.
 */
import { describe, expect, it } from "vitest";
import { INGEST_RULES, type NormalizedFix } from "./types";
import { classifyFix, describeOutcomes, toIsoTime } from "./ingestRules";
import { KNOTS_TO_MPS, normalizeTraccar, isTraccarError } from "./adapters/traccar";
import { normalizeWebBatch, isWebFixError, goodFixes } from "./adapters/web";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ConfigError,
  buildConfigHash,
  configHashChanges,
  databaseIsLocal,
  ids,
  loadEventConfig,
  parseConfigHash,
  participantId,
  resolveSecret,
} from "./config";

/* A forward payload as Traccar 6.x sends it (research/traccar.md): one
 * position per POST, { position, device }, nulls omitted. */
const traccarBody = {
  position: {
    id: 48213,
    deviceId: 7,
    protocol: "osmand",
    serverTime: "2026-10-23T12:35:03.000+00:00",
    deviceTime: "2026-10-23T12:35:00.000+00:00",
    fixTime: "2026-10-23T12:34:58.000+00:00",
    valid: true,
    latitude: 33.9802,
    longitude: -118.4602,
    altitude: 12.4,
    speed: 5.2, // knots
    course: 171,
    accuracy: 8.5,
    attributes: { batteryLevel: 81, distance: 42.1, totalDistance: 18233.5, motion: true },
  },
  device: { id: 7, name: "Runner A1", uniqueId: "lasd26-a1", status: "online" },
};

describe("normalizeTraccar", () => {
  it("maps a real forward payload: knots → m/s, batteryLevel, fixTime wins", () => {
    const r = normalizeTraccar(traccarBody);
    expect(isTraccarError(r)).toBe(false);
    const fix = r as NormalizedFix;
    expect(fix.source).toBe("traccar");
    expect(fix.externalId).toBe("lasd26-a1");
    expect(fix.fixTime).toBe("2026-10-23T12:34:58.000Z");
    expect(fix.lat).toBeCloseTo(33.9802, 6);
    expect(fix.lon).toBeCloseTo(-118.4602, 6);
    expect(fix.speedMps).toBeCloseTo(5.2 * KNOTS_TO_MPS, 6);
    expect(fix.speedMps).toBeCloseTo(2.675, 2);
    expect(fix.accuracyM).toBe(8.5);
    expect(fix.altitudeM).toBe(12.4);
    expect(fix.batteryPct).toBe(81);
  });

  it("falls back fixTime → deviceTime → serverTime", () => {
    const noFix = structuredClone(traccarBody) as { position: Record<string, unknown> };
    delete noFix.position.fixTime;
    expect((normalizeTraccar(noFix) as NormalizedFix).fixTime).toBe("2026-10-23T12:35:00.000Z");
    delete noFix.position.deviceTime;
    expect((normalizeTraccar(noFix) as NormalizedFix).fixTime).toBe("2026-10-23T12:35:03.000Z");
    delete noFix.position.serverTime;
    expect(normalizeTraccar(noFix)).toEqual({ error: "missing fixTime" });
  });

  it("accepts epoch numbers for the stamps (seconds or milliseconds)", () => {
    const body = { position: { fixTime: 1792 * 1e6, latitude: 1, longitude: 2 }, device: { uniqueId: "x" } };
    expect((normalizeTraccar(body) as NormalizedFix).fixTime).toBe(new Date(1792e6 * 1000).toISOString());
    const ms = { position: { fixTime: 1792e9, latitude: 1, longitude: 2 }, device: { uniqueId: "x" } };
    expect((normalizeTraccar(ms) as NormalizedFix).fixTime).toBe(new Date(1792e9).toISOString());
  });

  it("drops valid=false as junk", () => {
    const body = structuredClone(traccarBody);
    body.position.valid = false;
    expect(normalizeTraccar(body)).toEqual({ error: "invalid" });
  });

  it("needs a device identity, from device.uniqueId or attributes.uniqueId", () => {
    const noDevice = { position: traccarBody.position };
    expect(normalizeTraccar(noDevice)).toEqual({ error: "missing device.uniqueId" });
    const inAttrs = { position: { ...traccarBody.position, attributes: { uniqueId: "lasd26-b3", batt: 55 } } };
    const fix = normalizeTraccar(inAttrs) as NormalizedFix;
    expect(fix.externalId).toBe("lasd26-b3");
    expect(fix.batteryPct).toBe(55);
  });

  it("leaves optional metrics out rather than inventing them", () => {
    const body = { position: { fixTime: "2026-10-23T12:00:00Z", latitude: 34, longitude: -118 }, device: { uniqueId: "d" } };
    const fix = normalizeTraccar(body) as NormalizedFix;
    expect(fix.accuracyM).toBeUndefined();
    expect(fix.speedMps).toBeUndefined();
    expect(fix.batteryPct).toBeUndefined();
    expect(fix.altitudeM).toBeUndefined();
  });

  it("rejects junk bodies and bad coordinates", () => {
    expect(normalizeTraccar(null)).toEqual({ error: "body is not an object" });
    expect(normalizeTraccar({})).toEqual({ error: "missing position" });
    const bad = { position: { fixTime: "2026-10-23T12:00:00Z", latitude: 91, longitude: 0 }, device: { uniqueId: "d" } };
    expect(normalizeTraccar(bad)).toEqual({ error: "bad coordinates" });
    // A battery reported as a voltage is not a percentage.
    const volts = { position: { fixTime: "2026-10-23T12:00:00Z", latitude: 1, longitude: 1, attributes: { battery: 3.9e3 } }, device: { uniqueId: "d" } };
    expect((normalizeTraccar(volts) as NormalizedFix).batteryPct).toBeUndefined();
  });
});

describe("normalizeWebBatch", () => {
  it("reads the van page's snake_case batch and keeps the result aligned", () => {
    const body = {
      external_id: "lasd26-van-a",
      fixes: [
        { fix_time: "2026-10-23T12:00:00Z", lat: 33.9, lon: -118.4, accuracy_m: 12, speed_mps: 14.2, battery_pct: 64, altitude_m: 20 },
        { fix_time: "2026-10-23T12:00:10Z", lat: 95, lon: -118.4 },
        { fixTime: 1792000000000, latitude: 33.91, longitude: -118.41, accuracyM: 5 },
        "nope",
      ],
    };
    const r = normalizeWebBatch(body);
    if ("error" in r) throw new Error(r.error);
    expect(r.externalId).toBe("lasd26-van-a");
    expect(r.fixes).toHaveLength(4);
    const first = r.fixes[0] as NormalizedFix;
    expect(first).toEqual({
      source: "web",
      externalId: "lasd26-van-a",
      fixTime: "2026-10-23T12:00:00.000Z",
      lat: 33.9,
      lon: -118.4,
      accuracyM: 12,
      speedMps: 14.2,
      batteryPct: 64,
      altitudeM: 20,
    });
    expect(r.fixes[1]).toEqual({ error: "bad lat" });
    expect((r.fixes[2] as NormalizedFix).fixTime).toBe(new Date(1792000000000).toISOString());
    expect(r.fixes[3]).toEqual({ error: "fix is not an object" });
    const good = goodFixes(r);
    expect(good.indexes).toEqual([0, 2]);
    expect(good.fixes.every((f) => !isWebFixError(f))).toBe(true);
  });

  it("is strict about numbers", () => {
    const r = normalizeWebBatch({ external_id: "v", fixes: [{ fix_time: "2026-10-23T12:00:00Z", lat: "33.9", lon: Infinity }] });
    if ("error" in r) throw new Error(r.error);
    // A numeric string is tolerated for lat (JSON from a form), Infinity is not a longitude.
    expect(r.fixes[0]).toEqual({ error: "bad lon" });
    const nan = normalizeWebBatch({ external_id: "v", fixes: [{ fix_time: "2026-10-23T12:00:00Z", lat: NaN, lon: 1 }] });
    if ("error" in nan) throw new Error(nan.error);
    expect(nan.fixes[0]).toEqual({ error: "bad lat" });
    const neg = normalizeWebBatch({ external_id: "v", fixes: [{ fix_time: "2026-10-23T12:00:00Z", lat: 1, lon: 1, accuracy_m: -3 }] });
    if ("error" in neg) throw new Error(neg.error);
    expect(neg.fixes[0]).toEqual({ error: "bad accuracy_m" });
  });

  it("rejects an unusable body as a whole", () => {
    expect(normalizeWebBatch(null)).toEqual({ error: "body is not an object" });
    expect(normalizeWebBatch({ fixes: [] })).toEqual({ error: "missing external_id" });
    expect(normalizeWebBatch({ external_id: "v" })).toEqual({ error: "missing fixes[]" });
    expect(normalizeWebBatch({ external_id: "v", fixes: new Array(1001).fill({}) })).toMatchObject({ error: expect.stringContaining("too many") });
  });

  it("accepts a single top-level fix and another source", () => {
    const r = normalizeWebBatch({ external_id: "sat-1", fix: { fix_time: "2026-10-23T12:00:00Z", lat: 1, lon: 2 } }, "satellite");
    if ("error" in r) throw new Error(r.error);
    expect(r.fixes).toHaveLength(1);
    expect((r.fixes[0] as NormalizedFix).source).toBe("satellite");
  });
});

describe("classifyFix (section 8 rule 4)", () => {
  const start = new Date("2026-10-23T12:00:00Z");
  const now = new Date("2026-10-23T15:00:00Z");
  const base: NormalizedFix = { source: "traccar", externalId: "d", fixTime: "2026-10-23T14:59:00Z", lat: 33.9, lon: -118.4, accuracyM: 10 };

  it("keeps a normal fix", () => {
    expect(classifyFix(base, start, now)).toBeNull();
    expect(classifyFix({ ...base, accuracyM: undefined }, start, now)).toBeNull();
    expect(classifyFix({ ...base, accuracyM: INGEST_RULES.maxAccuracyM }, start, now)).toBeNull();
  });

  it("drops accuracy worse than 100 m", () => {
    expect(classifyFix({ ...base, accuracyM: INGEST_RULES.maxAccuracyM + 0.1 }, start, now)).toBe("bad_accuracy");
    expect(classifyFix({ ...base, accuracyM: 2500 }, start, now)).toBe("bad_accuracy");
  });

  it("drops stamps more than 5 minutes in the future, keeps 5 minutes exactly", () => {
    const plus5 = new Date(now.getTime() + INGEST_RULES.maxFutureS * 1000).toISOString();
    expect(classifyFix({ ...base, fixTime: plus5 }, start, now)).toBeNull();
    const plus6 = new Date(now.getTime() + (INGEST_RULES.maxFutureS + 1) * 1000).toISOString();
    expect(classifyFix({ ...base, fixTime: plus6 }, start, now)).toBe("future");
  });

  it("drops stamps before event start minus 1 h, keeps the hour itself", () => {
    const edge = new Date(start.getTime() - INGEST_RULES.beforeStartS * 1000).toISOString();
    expect(classifyFix({ ...base, fixTime: edge }, start, now)).toBeNull();
    const early = new Date(start.getTime() - (INGEST_RULES.beforeStartS + 1) * 1000).toISOString();
    expect(classifyFix({ ...base, fixTime: early }, start, now)).toBe("before_start");
  });

  it("a buffered fix from a dead zone (old, but after start) is fine", () => {
    expect(classifyFix({ ...base, fixTime: "2026-10-23T12:30:00Z" }, start, now)).toBeNull();
  });

  it("calls the unplaceable invalid", () => {
    expect(classifyFix({ ...base, lat: 91 }, start, now)).toBe("invalid");
    expect(classifyFix({ ...base, lon: -181 }, start, now)).toBe("invalid");
    expect(classifyFix({ ...base, fixTime: "yesterday" }, start, now)).toBe("invalid");
    expect(classifyFix({ ...base, accuracyM: -1 }, start, now)).toBe("invalid");
    expect(classifyFix({ ...base, accuracyM: NaN }, start, now)).toBe("invalid");
  });

  it("checks accuracy before time, as the spec lists them", () => {
    const far = new Date(now.getTime() + 3600 * 1000).toISOString();
    expect(classifyFix({ ...base, fixTime: far, accuracyM: 500 }, start, now)).toBe("bad_accuracy");
  });
});

describe("helpers", () => {
  it("toIsoTime handles ISO, epoch s, epoch ms, numeric strings and junk", () => {
    expect(toIsoTime("2026-10-23T05:00:00-07:00")).toBe("2026-10-23T12:00:00.000Z");
    const iso = new Date(1792000000000).toISOString();
    expect(iso.startsWith("2026-10-14T")).toBe(true);
    expect(toIsoTime(1792000000)).toBe(iso);
    expect(toIsoTime(1792000000000)).toBe(iso);
    expect(toIsoTime("1792000000")).toBe(iso);
    expect(toIsoTime("")).toBeNull();
    expect(toIsoTime("soon")).toBeNull();
    expect(toIsoTime(-5)).toBeNull();
    expect(toIsoTime(undefined)).toBeNull();
  });

  it("describeOutcomes counts for the log line", () => {
    const d = describeOutcomes([
      { ok: true, stored: true, deviceId: "d", positionId: 1 },
      { ok: true, stored: true, deviceId: "d", positionId: 2 },
      { ok: true, stored: false, reason: "duplicate", deviceId: "d" },
      { ok: false, reason: "bad_accuracy" },
      { ok: false, reason: "unknown_device" },
    ]);
    expect(d).toMatchObject({ total: 5, stored: 2, duplicates: 1, rejected: 2, reasons: { bad_accuracy: 1, unknown_device: 1 } });
    expect(d.line).toBe("stored 2, duplicate 1, rejected 2 (bad_accuracy 1, unknown_device 1)");
  });
});

/* ─── Config loader: the pure rules changed in the 2026-10-06 review ─────────
 * (databaseIsLocal, the guarded dev-key fallback, participant ids and the
 * part-wise config hash). Here rather than a config.test.ts of their own
 * only because this file was the one in the review's remit. */

describe("databaseIsLocal", () => {
  it("is true only for a local host in the connection string", () => {
    expect(databaseIsLocal("postgresql://postgres:postgres@localhost:5432/mikian?schema=public")).toBe(true);
    expect(databaseIsLocal("postgres://u:p@127.0.0.1/db")).toBe(true);
    expect(databaseIsLocal("postgres://u:p@[::1]:5432/db")).toBe(true);
    expect(databaseIsLocal("postgres://u:p@db.local:5432/db")).toBe(true);
    expect(databaseIsLocal("postgres://u:p@pg.test/db")).toBe(true);
    expect(databaseIsLocal("postgres://u:p@LOCALHOST/db")).toBe(true);
  });

  it("is false for a hosted database, an unset or unparsable value — the safe answer", () => {
    expect(databaseIsLocal("postgres://u:p@ep-snowy-glitter-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require")).toBe(false);
    expect(databaseIsLocal("postgres://u:p@localhost.example.com/db")).toBe(false);
    expect(databaseIsLocal("postgres://u:p@notlocal.tests/db")).toBe(false);
    expect(databaseIsLocal("")).toBe(false);
    expect(databaseIsLocal(undefined)).toBe(false);
    expect(databaseIsLocal(null)).toBe(false);
    expect(databaseIsLocal("not a url")).toBe(false);
  });
});

describe("resolveSecret", () => {
  // Next's types make process.env.NODE_ENV read-only; the tests set it through the index signature.
  const env = process.env as Record<string, string | undefined>;
  const saved = { NODE_ENV: env.NODE_ENV, POSTGRES_URL: env.POSTGRES_URL, TEST_CREW: env.TEST_CREW };
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  };

  it("takes the env var when it is set, whatever the database", () => {
    process.env.TEST_CREW = " real-key ";
    try {
      expect(resolveSecret("$TEST_CREW", "dev-x", { databaseUrl: "postgres://u:p@host.neon.tech/db" })).toEqual({
        value: "real-key",
        fromEnv: true,
        envName: "TEST_CREW",
        devFallback: false,
      });
    } finally {
      restore();
    }
  });

  it("falls back to the dev key ONLY against a local database (the live database never gets the key printed in the repo)", () => {
    delete process.env.TEST_CREW;
    env.NODE_ENV = "test";
    try {
      expect(resolveSecret("$TEST_CREW", "dev-x", { databaseUrl: "postgres://u:p@localhost/db" })).toMatchObject({ value: "dev-x", fromEnv: false, devFallback: true });
      const live = resolveSecret("$TEST_CREW", "dev-x", { databaseUrl: "postgres://u:p@ep-x-pooler.us-west-2.aws.neon.tech/db" });
      expect(live).toEqual({ value: "", fromEnv: false, envName: "TEST_CREW", devFallback: false });
      expect(resolveSecret("$TEST_CREW", "dev-x", { databaseUrl: null })).toMatchObject({ value: "", devFallback: false });
      env.NODE_ENV = "production";
      expect(resolveSecret("$TEST_CREW", "dev-x", { databaseUrl: "postgres://u:p@localhost/db" })).toMatchObject({ value: "", devFallback: false });
    } finally {
      restore();
    }
  });

  it("reads process.env.POSTGRES_URL when no url is passed", () => {
    delete process.env.TEST_CREW;
    env.NODE_ENV = "test";
    try {
      process.env.POSTGRES_URL = "postgres://u:p@127.0.0.1/db";
      expect(resolveSecret("$TEST_CREW", "dev-x").value).toBe("dev-x");
      process.env.POSTGRES_URL = "postgres://u:p@somewhere.neon.tech/db";
      expect(resolveSecret("$TEST_CREW", "dev-x").value).toBe("");
    } finally {
      restore();
    }
  });

  it("takes anything not starting with $ literally", () => {
    expect(resolveSecret(" literal ", "dev-x")).toEqual({ value: "literal", fromEnv: false, envName: null, devFallback: false });
    expect(resolveSecret(undefined, "dev-x")).toEqual({ value: "", fromEnv: false, envName: null, devFallback: false });
  });
});

describe("participant ids", () => {
  const dev = { source: "traccar" as const, external_id: "lasd26-a1" };

  it("explicit id → device external_id → position, always under the event/entry prefix", () => {
    expect(participantId("lasd26", "a", 1, { explicit_id: "taylor", device: dev })).toBe("lasd26:p:A:taylor");
    expect(participantId("lasd26", "A", 1, { device: dev })).toBe("lasd26:p:A:lasd26-a1");
    expect(participantId("lasd26", "A", 3)).toBe("lasd26:p:A:3");
  });

  it("ids.participant uses the loaded line's id and otherwise the same rule", () => {
    expect(ids.participant("lasd26", "A", 1, { id: "lasd26:p:A:taylor", name: "T", initials: "T", device: dev })).toBe("lasd26:p:A:taylor");
    expect(ids.participant("lasd26", "A", 1, { name: "T", initials: "T", device: dev })).toBe("lasd26:p:A:lasd26-a1");
    expect(ids.participant("lasd26", "A", 2)).toBe("lasd26:p:A:2");
  });
});

describe("config hash parts", () => {
  const gpx = { "x.gpx": "a".repeat(64) };
  it("changes only the part that changed", () => {
    const base = buildConfigHash({ doc: { a: 1 }, gpx, key: "k1" });
    expect(parseConfigHash(base)).toMatchObject({ config: expect.any(String), route: expect.any(String), key: expect.any(String) });
    expect(configHashChanges(base, base)).toEqual([]);
    expect(configHashChanges(base, buildConfigHash({ doc: { a: 2 }, gpx, key: "k1" }))).toEqual(["config"]);
    expect(configHashChanges(base, buildConfigHash({ doc: { a: 1 }, gpx: { "x.gpx": "b".repeat(64) }, key: "k1" }))).toEqual(["route"]);
    expect(configHashChanges(base, buildConfigHash({ doc: { a: 1 }, gpx, key: "k2" }))).toEqual(["key"]);
    // Which file holds which hash matters, not the order the files were hashed in.
    const two = buildConfigHash({ doc: {}, gpx: { "a.gpx": "1", "b.gpx": "2" }, key: "" });
    expect(buildConfigHash({ doc: {}, gpx: { "b.gpx": "2", "a.gpx": "1" }, key: "" })).toBe(two);
  });

  it("treats the old single-hash format and an empty hash as everything changed", () => {
    const now = buildConfigHash({ doc: {}, gpx, key: "" });
    expect(parseConfigHash("0123456789abcdef")).toBeNull();
    expect(configHashChanges("0123456789abcdef", now)).toEqual(["config", "route", "key"]);
    expect(configHashChanges("", now)).toEqual(["config", "route", "key"]);
    expect(configHashChanges(undefined, now)).toEqual(["config", "route", "key"]);
  });
});

describe("loadEventConfig (participant ids and change detection)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trk-cfg-"));
  const write = (slug: string, yaml: string) => fs.writeFileSync(path.join(dir, `${slug}.yaml`), yaml);
  fs.writeFileSync(path.join(dir, "r.gpx"), "<gpx/>");
  const head = `slug: ev
name: Ev
kind: relay
start_time: "2026-10-23T05:00:00-07:00"
timezone: America/Los_Angeles
units: imperial
route: r.gpx
crew_key: literal-key
`;

  it("gives each line its resolved id: explicit, then device, then position", () => {
    write(
      "ev",
      head +
        `entries:
  - name: Team A
    short_name: A
    color: "#D4FF3A"
    participants:
      - { name: Taylor, id: taylor, device: { source: traccar, external_id: ev-a1 } }
      - { name: Two, device: { source: traccar, external_id: ev-a2 } }
      - { name: Three }
`,
    );
    const cfg = loadEventConfig("ev", dir);
    const ps = cfg.entries[0].participants as ((typeof cfg.entries)[0]["participants"][number] & { id: string })[];
    expect(ps.map((p) => p.id)).toEqual(["ev:p:A:taylor", "ev:p:A:ev-a2", "ev:p:A:3"]);
    expect(ps.map((p, j) => ids.participant("ev", "A", j + 1, p))).toEqual(["ev:p:A:taylor", "ev:p:A:ev-a2", "ev:p:A:3"]);
    expect(cfg.crew_key).toBe("literal-key");
    expect(cfg.crew_key_env).toBeNull();
    expect(cfg.gpx_sha256["r.gpx"]).toMatch(/^[0-9a-f]{64}$/);
    expect(parseConfigHash(cfg.hash)).not.toBeNull();
  });

  it("rejects colliding participant ids and a malformed explicit id", () => {
    write(
      "ev",
      head +
        `entries:
  - name: Team A
    short_name: A
    color: "#D4FF3A"
    participants:
      - { name: One, id: "2" }
      - { name: Two }
      - { name: Bad, id: "Not Slug Safe" }
`,
    );
    let err: unknown;
    try {
      loadEventConfig("ev", dir);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConfigError);
    const problems = (err as ConfigError).problems.join("\n");
    expect(problems).toContain('participant id "ev:p:A:2" collides');
    expect(problems).toContain("participants[2]: id must be lowercase");
  });

  it("the hash moves with the GPX text and with the resolved key, and names the part", () => {
    write(
      "ev",
      head +
        `entries:
  - name: Team A
    short_name: A
    color: "#D4FF3A"
    participants:
      - { name: One, device: { source: traccar, external_id: ev-a1 } }
`,
    );
    const before = loadEventConfig("ev", dir).hash;
    fs.writeFileSync(path.join(dir, "r.gpx"), "<gpx>v2</gpx>");
    const afterGpx = loadEventConfig("ev", dir).hash;
    expect(configHashChanges(before, afterGpx)).toEqual(["route"]);
    write("ev", fs.readFileSync(path.join(dir, "ev.yaml"), "utf8").replace("crew_key: literal-key", "crew_key: other-key"));
    const afterKey = loadEventConfig("ev", dir).hash;
    // The YAML text changed too (that is where the literal lives), so both parts move.
    expect(configHashChanges(afterGpx, afterKey)).toEqual(["config", "key"]);
  });
});
