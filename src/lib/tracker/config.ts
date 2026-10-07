/**
 * Event config loader: events/<slug>.yaml (+ the GPX next to it) → EventConfig.
 *
 * v1 has no admin UI; the file is the source of truth and sync.ts upserts it
 * into the Tracker* tables. Node-only (fs) — the API sync route, the
 * `npm run track:sync` script and the simulator read it. Not `server-only`
 * on purpose: the simulator runs under plain tsx, where that package throws.
 *
 * Secrets: the repo is public, so a value written as "$SOME_ENV_VAR" is
 * resolved from the environment. When the variable is unset the key becomes
 * "" and the crew/van pages refuse every key — EXCEPT when the database the
 * process talks to is local (databaseIsLocal), where a predictable dev key
 * keeps the simulator and local pages usable. Review 2026-10-06: the old
 * rule was "fallback whenever NODE_ENV !== production", and `npm run
 * track:sync` runs under tsx (NODE_ENV unset) against the database in
 * .env.local, which on the owner's laptop IS the live Neon database — so the
 * live event accepted a key printed verbatim in this public repo.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import {
  CHECKPOINT_KINDS,
  DEVICE_SOURCES,
  type CheckpointConfig,
  type DeviceRef,
  type EntryConfig,
  type EventConfig,
  type ParticipantConfig,
} from "./types";

export class ConfigError extends Error {
  problems: string[];
  constructor(slug: string, problems: string[]) {
    super(`events/${slug}.yaml: ${problems.join("; ")}`);
    this.problems = problems;
  }
}

export const EVENTS_DIR = path.join(process.cwd(), "events");

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
/** An explicit participant `id:` — slug-safe, so it reads well in URLs and logs. */
const PARTICIPANT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MI = 1609.344;

/** A participant as loadEventConfig returns it: the config line plus its resolved stable id. */
export type LoadedParticipant = ParticipantConfig & {
  /** The TrackerParticipant.id this line maps to (see `participantId`). */
  id: string;
};

/** EventConfig plus what sync needs to detect changes and explain the crew key. */
export type LoadedEventConfig = EventConfig & {
  /** The env var the file names for crew_key ("$NAME" → "NAME"); null when the key is a literal. */
  crew_key_env: string | null;
  /** True when crew_key is the predictable dev fallback (local database only). */
  crew_key_dev_fallback: boolean;
  /** sha256 (hex) of every GPX the file names, by file name: the event route and per-entry routes. */
  gpx_sha256: Record<string, string>;
};

export function listEventSlugs(dir: string = EVENTS_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => f.replace(/\.ya?ml$/, ""))
    .filter((s) => SLUG_RE.test(s))
    .sort();
}

function configPath(slug: string, dir: string): string {
  const a = path.join(dir, `${slug}.yaml`);
  if (fs.existsSync(a)) return a;
  return path.join(dir, `${slug}.yml`);
}

/**
 * Is the database this process writes to a LOCAL one? Decided from the
 * connection string's host, never from NODE_ENV: `tsx` leaves NODE_ENV
 * unset whatever database .env.local points at. Local means localhost,
 * 127.0.0.1, ::1, or a host ending in .local / .test. Anything unparsable,
 * unset or unknown is NOT local — the safe answer, since this gate decides
 * whether a predictable key may be written.
 */
export function databaseIsLocal(url: string | null | undefined = process.env.POSTGRES_URL): boolean {
  const s = (url ?? "").trim();
  if (!s) return false;
  let host: string;
  try {
    // WHATWG URL parses the authority of any "scheme://" URL, postgres:// included.
    host = new URL(s).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  return host.endsWith(".local") || host.endsWith(".test") || host.endsWith(".localhost");
}

export interface ResolvedSecret {
  value: string;
  /** True when the value came from the environment variable the file names. */
  fromEnv: boolean;
  /** The variable the file names ("$NAME" → "NAME"); null for a literal. */
  envName: string | null;
  /** True when `value` is the predictable dev fallback. */
  devFallback: boolean;
}

/**
 * "$VAR" → process.env.VAR. Anything else is taken literally.
 *
 * An unset variable resolves to "" (the pages refuse every key) unless the
 * database is local AND this is not a production build, in which case the
 * dev fallback is used so the simulator and local pages work without
 * setup. Both conditions on purpose: the database check is the one that
 * matters (see the header), NODE_ENV is belt and braces.
 */
export function resolveSecret(raw: unknown, devFallback: string, opts: { databaseUrl?: string | null } = {}): ResolvedSecret {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.startsWith("$")) {
    const name = s.slice(1);
    const v = (process.env[name] ?? "").trim();
    if (v) return { value: v, fromEnv: true, envName: name, devFallback: false };
    const local = databaseIsLocal(opts.databaseUrl === undefined ? process.env.POSTGRES_URL : opts.databaseUrl);
    if (process.env.NODE_ENV !== "production" && local) return { value: devFallback, fromEnv: false, envName: name, devFallback: true };
    return { value: "", fromEnv: false, envName: name, devFallback: false };
  }
  return { value: s, fromEnv: false, envName: null, devFallback: false };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function parseDevice(v: unknown, where: string, problems: string[]): DeviceRef | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isRecord(v)) {
    problems.push(`${where}: device must be a map { source, external_id }`);
    return undefined;
  }
  const source = str(v.source) as DeviceRef["source"];
  const external_id = str(v.external_id);
  if (!DEVICE_SOURCES.includes(source)) problems.push(`${where}: device.source must be one of ${DEVICE_SOURCES.join("|")}`);
  if (!external_id) problems.push(`${where}: device.external_id is required`);
  if (external_id.length > 64) problems.push(`${where}: device.external_id is too long (64 max)`);
  return { source, external_id };
}

/** Initials from a name: "Taylor Rockwell" → "TR"; one word → first two letters. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The stable id of a participant line. Review 2026-10-06: a positional id
 * ("<slug>:p:<short>:<n>") re-attributed existing handoffs to a different
 * person when a runner line was deleted or reordered, and left a ghost. So:
 *   1. an explicit `id:` on the line wins;
 *   2. else, when the line has a device, the device's external_id — for
 *      this event the device identity IS the runner identity, so swapping
 *      phones means editing the YAML's external_id, not the person;
 *   3. else the 1-based position, as before (a line with neither has
 *      nothing better to hang on to).
 * All three are prefixed "<slug>:p:<SHORT>:" because TrackerParticipant.id
 * is a global primary key — two events may both have a runner "taylor".
 */
export function participantId(slug: string, short: string, n1: number, line: { explicit_id?: string; device?: DeviceRef } = {}): string {
  const tail = line.explicit_id ? line.explicit_id : line.device ? line.device.external_id : String(n1);
  return `${slug}:p:${short.toUpperCase()}:${tail}`;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** The parts of the config hash, each a 16-hex sha256 prefix. */
export type ConfigPart = "config" | "route" | "key";
export const CONFIG_PARTS: readonly ConfigPart[] = ["config", "route", "key"];

/**
 * TrackerEvent.configHash is "config=…;route=…;key=…" so sync can say WHICH
 * part changed. Review 2026-10-06: the hash covered only the parsed YAML, so
 * swapping the GPX file (same name) or rotating the crew key env var was a
 * silent no-op without --force.
 */
export function buildConfigHash(parts: { doc: unknown; gpx: Record<string, string>; key: string }): string {
  const doc = sha256(JSON.stringify(parts.doc)).slice(0, 16);
  const route = sha256(
    JSON.stringify(
      Object.entries(parts.gpx)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([file, h]) => [file, h]),
    ),
  ).slice(0, 16);
  const key = sha256(parts.key).slice(0, 16);
  return `config=${doc};route=${route};key=${key}`;
}

/** Parse a stored configHash; null for the pre-2026-10-06 single-hash format or "". */
export function parseConfigHash(hash: string | null | undefined): Record<ConfigPart, string> | null {
  if (!hash) return null;
  const out: Partial<Record<ConfigPart, string>> = {};
  for (const piece of hash.split(";")) {
    const [k, v] = piece.split("=");
    if ((CONFIG_PARTS as readonly string[]).includes(k) && v) out[k as ConfigPart] = v;
  }
  return CONFIG_PARTS.every((p) => out[p]) ? (out as Record<ConfigPart, string>) : null;
}

/** Which parts differ between the stored hash and the file's. An unparsable stored hash → every part. */
export function configHashChanges(stored: string | null | undefined, current: string): ConfigPart[] {
  const a = parseConfigHash(stored);
  const b = parseConfigHash(current);
  if (!a || !b) return [...CONFIG_PARTS];
  return CONFIG_PARTS.filter((p) => a[p] !== b[p]);
}

/**
 * Load and validate one event. Throws ConfigError listing every problem at
 * once (so the owner fixes the file in one pass).
 */
export function loadEventConfig(slug: string, dir: string = EVENTS_DIR): LoadedEventConfig {
  const problems: string[] = [];
  if (!SLUG_RE.test(slug)) throw new ConfigError(slug, ["slug must be lowercase letters, digits and dashes"]);
  const file = configPath(slug, dir);
  if (!fs.existsSync(file)) throw new ConfigError(slug, ["file not found"]);
  const text = fs.readFileSync(file, "utf8");
  let doc: unknown;
  try {
    doc = YAML.parse(text);
  } catch (err) {
    throw new ConfigError(slug, [`YAML parse error: ${(err as Error).message}`]);
  }
  if (!isRecord(doc)) throw new ConfigError(slug, ["top level must be a map"]);

  const fileSlug = str(doc.slug);
  if (fileSlug && fileSlug !== slug) problems.push(`slug "${fileSlug}" does not match the file name "${slug}"`);

  const name = str(doc.name);
  if (!name) problems.push("name is required");

  const kind = str(doc.kind);
  if (kind !== "relay" && kind !== "solo") problems.push("kind must be relay or solo");

  const start_time = str(doc.start_time);
  if (!start_time || !Number.isFinite(Date.parse(start_time))) problems.push("start_time must be an ISO 8601 date-time with offset");

  const timezone = str(doc.timezone) || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    problems.push(`timezone "${timezone}" is not a valid IANA zone`);
  }

  const units = str(doc.units) || "metric";
  if (units !== "imperial" && units !== "metric") problems.push("units must be imperial or metric");

  // Every GPX the file names is hashed here so the change detector sees a
  // swapped file (same name, new content) — syncRoute re-reads the text when
  // it actually rebuilds the points.
  const gpx_sha256: Record<string, string> = {};
  const hashRoute = (fileName: string, where: string): void => {
    const p = path.join(dir, fileName);
    if (!fs.existsSync(p)) {
      problems.push(`${where}route file events/${fileName} not found`);
      return;
    }
    if (!gpx_sha256[fileName]) gpx_sha256[fileName] = sha256(fs.readFileSync(p, "utf8"));
  };
  const route = str(doc.route);
  if (!route) problems.push("route (GPX file name) is required");
  else hashRoute(route, "");

  const public_delay_s = doc.public_delay_s === undefined ? 0 : Number(doc.public_delay_s);
  if (!Number.isFinite(public_delay_s) || public_delay_s < 0 || public_delay_s > 6 * 3600) {
    problems.push("public_delay_s must be 0..21600");
  }

  // An unset env var is NOT fatal: the event still syncs and the crew/van
  // pages refuse every key until the variable is set (sync.ts warns loudly).
  const crew = resolveSecret(doc.crew_key, `dev-${slug}-crew`);

  /* Entries */
  const entries: EntryConfig[] = [];
  const shortNames = new Set<string>();
  const deviceIds = new Set<string>();
  /* Participant ids are checked across the whole event: the id is a global primary key. */
  const participantIds = new Map<string, string>();
  const rawEntries = Array.isArray(doc.entries) ? doc.entries : [];
  if (rawEntries.length === 0) problems.push("entries: at least one entry is required");
  rawEntries.forEach((raw, i) => {
    const where = `entries[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${where}: must be a map`);
      return;
    }
    const ename = str(raw.name);
    const short_name = str(raw.short_name) || ename.slice(0, 2).toUpperCase();
    const color = str(raw.color);
    if (!ename) problems.push(`${where}: name is required`);
    if (!short_name) problems.push(`${where}: short_name is required`);
    if (short_name.length > 4) problems.push(`${where}: short_name is 1–4 characters`);
    if (!/^[A-Za-z0-9]+$/.test(short_name)) problems.push(`${where}: short_name must be letters/digits`);
    if (shortNames.has(short_name.toUpperCase())) problems.push(`${where}: short_name "${short_name}" is used twice`);
    shortNames.add(short_name.toUpperCase());
    if (!HEX_RE.test(color)) problems.push(`${where}: color must be a #rrggbb hex`);

    const participants: LoadedParticipant[] = [];
    const rawP = Array.isArray(raw.participants) ? raw.participants : [];
    if (rawP.length === 0) problems.push(`${where}: at least one participant is required`);
    if (kind === "solo" && rawP.length !== 1) problems.push(`${where}: a solo entry has exactly one participant`);
    rawP.forEach((p, j) => {
      const pw = `${where}.participants[${j}]`;
      if (!isRecord(p)) {
        problems.push(`${pw}: must be a map`);
        return;
      }
      const pname = str(p.name);
      if (!pname) problems.push(`${pw}: name is required`);
      const initials = (str(p.initials) || initialsOf(pname)).toUpperCase().slice(0, 3);
      const device = parseDevice(p.device, pw, problems);
      if (device) {
        const key = `${device.source}:${device.external_id}`;
        if (deviceIds.has(key)) problems.push(`${pw}: device ${key} is assigned twice`);
        deviceIds.add(key);
      }
      const explicitId = p.id === undefined || p.id === null ? "" : str(p.id);
      if (p.id !== undefined && p.id !== null && !PARTICIPANT_ID_RE.test(explicitId)) {
        problems.push(`${pw}: id must be lowercase letters, digits and dashes (1–64 chars)`);
      }
      const id = participantId(slug, short_name, j + 1, { explicit_id: explicitId || undefined, device });
      const clash = participantIds.get(id);
      if (clash) problems.push(`${pw}: participant id "${id}" collides with ${clash} — give one of them an explicit id:`);
      else participantIds.set(id, pw);
      participants.push({ id, name: pname, initials, device });
    });

    const vehicle_device = parseDevice(raw.vehicle_device, `${where}.vehicle_device`, problems);
    if (vehicle_device) {
      const key = `${vehicle_device.source}:${vehicle_device.external_id}`;
      if (deviceIds.has(key)) problems.push(`${where}: vehicle_device ${key} is assigned twice`);
      deviceIds.add(key);
    }
    const baton_device = parseDevice(raw.baton_device, `${where}.baton_device`, problems);
    if (baton_device) {
      const key = `${baton_device.source}:${baton_device.external_id}`;
      if (deviceIds.has(key)) problems.push(`${where}: baton_device ${key} is assigned twice`);
      deviceIds.add(key);
    }
    const entryRoute = str(raw.route) || undefined;
    if (entryRoute) hashRoute(entryRoute, `${where}: `);

    entries.push({ name: ename, short_name, color, route: entryRoute, participants, vehicle_device, baton_device });
  });

  /* Checkpoints */
  const checkpoints: CheckpointConfig[] = [];
  const rawCps = Array.isArray(doc.checkpoints) ? doc.checkpoints : [];
  rawCps.forEach((raw, i) => {
    const where = `checkpoints[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${where}: must be a map`);
      return;
    }
    const cname = str(raw.name);
    const ckind = str(raw.kind) as CheckpointConfig["kind"];
    if (!cname) problems.push(`${where}: name is required`);
    if (!CHECKPOINT_KINDS.includes(ckind)) problems.push(`${where}: kind must be one of ${CHECKPOINT_KINDS.join("|")}`);
    const given = ["mile", "km", "route_m"].filter((k) => raw[k] !== undefined && raw[k] !== null);
    if (given.length !== 1) problems.push(`${where}: give exactly one of mile, km, route_m`);
    const cp: CheckpointConfig = { name: cname, kind: ckind };
    for (const k of given) {
      const v = Number(raw[k]);
      if (!Number.isFinite(v) || v < 0) problems.push(`${where}: ${k} must be a non-negative number`);
      if (k === "mile") cp.mile = v;
      else if (k === "km") cp.km = v;
      else cp.route_m = v;
    }
    checkpoints.push(cp);
  });

  if (problems.length) throw new ConfigError(slug, problems);

  const hash = buildConfigHash({ doc, gpx: gpx_sha256, key: crew.value });

  return {
    slug,
    name,
    kind: kind as EventConfig["kind"],
    start_time,
    timezone,
    units: units as EventConfig["units"],
    route,
    public_delay_s,
    crew_key: crew.value,
    crew_key_from_env: crew.fromEnv,
    crew_key_env: crew.envName,
    crew_key_dev_fallback: crew.devFallback,
    entries,
    checkpoints,
    hash,
    gpx_sha256,
  };
}

/** The GPX text for the event route (or a per-entry override). */
export function readRouteGpx(fileName: string, dir: string = EVENTS_DIR): string {
  return fs.readFileSync(path.join(dir, fileName), "utf8");
}

/** Checkpoint distance in metres from whichever unit the file used. */
export function checkpointRouteM(cp: CheckpointConfig): number {
  if (cp.route_m !== undefined) return cp.route_m;
  if (cp.km !== undefined) return cp.km * 1000;
  if (cp.mile !== undefined) return cp.mile * MI;
  return 0;
}

/* Stable ids for the upsert (see the schema comments). */
export const ids = {
  route: (slug: string, file: string) => `${slug}:route:${file.replace(/\.gpx$/i, "").toLowerCase()}`,
  entry: (slug: string, short: string) => `${slug}:entry:${short.toUpperCase()}`,
  /**
   * Pass the participant as loadEventConfig returned it (it carries its
   * resolved `id`). Without it this falls back to the device-or-position
   * rule, and with no device to the OLD positional id, which only matches
   * a line that has neither an explicit id nor a device. See `participantId`.
   */
  participant: (slug: string, short: string, n1: number, p?: ParticipantConfig & { id?: string }) =>
    p?.id ?? participantId(slug, short, n1, { device: p?.device }),
  device: (slug: string, d: DeviceRef) => `${slug}:dev:${d.source}:${d.external_id}`,
  checkpoint: (slug: string, n1: number) => `${slug}:cp:${n1}`,
};
