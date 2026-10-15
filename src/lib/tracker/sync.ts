/**
 * Config sync (TRACKER_SPEC.md §7): events/<slug>.yaml + its GPX → the
 * Tracker* tables, by upsert, with stable ids (config.ts `ids`) so running
 * it twice is a no-op and editing a runner's name keeps their handoffs.
 *
 * Run from `npm run track:sync [-- --event lasd26 --force]` and from
 * POST /api/track/sync (admin). No "server-only" import here on purpose:
 * the script runs under plain tsx, where that package throws; the API route
 * adds the gate.
 *
 * What is never destroyed by a config edit:
 *   - devices: a device dropped from the file keeps its row (positions hang
 *     off it) and loses its participant/entry links;
 *   - entries and participants: handoffs hang off them, so a row that left
 *     the file stays and the summary warns about it, by name and with the
 *     number of handoffs that point at it.
 * Checkpoints have no children and are replaced to match the file.
 *
 * Change detection: TrackerEvent.configHash holds three parts (config.ts
 * buildConfigHash) — the parsed YAML, the GPX texts and the RESOLVED crew
 * key — so a swapped GPX or a rotated key env var is a real change, not a
 * silent no-op. The stored rows are checked too (route sourceHash, the
 * event's crewKey): belt and braces against a sync that died halfway.
 */

import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  checkpointRouteM,
  configHashChanges,
  ids,
  listEventSlugs,
  loadEventConfig,
  readRouteGpx,
  ConfigError,
  type ConfigPart,
  type LoadedEventConfig,
} from "./config";
import { routeIndexFromGpx } from "./routeIndex";
import type { DeviceRef, EntryConfig, EventConfig } from "./types";

/** Where the event's crew key came from — the CLI prints a banner for "missing". */
export type CrewKeyStatus = "env" | "dev-fallback" | "literal" | "missing";

export interface SyncSummary {
  slug: string;
  /** False when nothing differed from the database and nothing was written. */
  changed: boolean;
  /** Which parts differed: "config" (the YAML), "route" (a GPX), "key" (the crew key). All three for a new event. */
  changes: ConfigPart[];
  /** True when the run was --force'd. */
  forced: boolean;
  crewKey: CrewKeyStatus;
  entries: number;
  participants: number;
  devices: number;
  checkpoints: number;
  lengthM: number;
  warnings: string[];
  /** Set when the event could not be synced at all (bad YAML, missing GPX…). */
  error?: string;
}

export interface SyncOptions {
  force?: boolean;
  /** Override the events directory (tests). */
  dir?: string;
}

type Tx = Prisma.TransactionClient;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** The entry's vehicle devices: `vehicle_device` plus every `vehicle_devices` entry (owner, 2026-10-15: the van phone on Traccar Client AND the web van page). */
function vehicleDevices(e: EntryConfig): DeviceRef[] {
  return [...(e.vehicle_device ? [e.vehicle_device] : []), ...(e.vehicle_devices ?? [])];
}

function countDevices(config: EventConfig): number {
  let n = 0;
  for (const e of config.entries) {
    n += e.participants.filter((p) => p.device).length;
    n += vehicleDevices(e).length;
    if (e.baton_device) n++;
  }
  return n;
}

/** The crew key status and the warnings that go with it (the loud one names the variable and the fix). */
export function crewKeyStatus(config: LoadedEventConfig): { status: CrewKeyStatus; warnings: string[] } {
  const envName = config.crew_key_env ?? `TRACKER_CREW_KEY_${config.slug.toUpperCase().replace(/-/g, "_")}`;
  if (config.crew_key_from_env) return { status: "env", warnings: [] };
  if (config.crew_key_dev_fallback) {
    return { status: "dev-fallback", warnings: [`crew_key is the dev fallback "${config.crew_key}" (${envName} unset; allowed because the database is local)`] };
  }
  if (config.crew_key) {
    return { status: "literal", warnings: ["crew_key is a literal in the file, not from an env var — the repo is public"] };
  }
  return {
    status: "missing",
    warnings: [
      `CREW KEY NOT SET: ${envName} is unset and the database is not local, so crewKey syncs as "" and the crew and van pages refuse every key. ` +
        `Fix: set ${envName} (Vercel → Environment Variables, or .env.local on a laptop) and re-run npm run track:sync.`,
    ],
  };
}

/**
 * Upsert one route file. Points are only rewritten when the GPX text
 * changed (sourceHash): the blob is ~400 KB and the index is rebuilt from
 * it on every snapshot anyway.
 */
async function syncRoute(tx: Tx, slug: string, file: string, dir: string | undefined, warnings: string[]): Promise<{ id: string; lengthM: number }> {
  const id = ids.route(slug, file);
  const gpx = readRouteGpx(file, dir);
  const sourceHash = sha256(gpx);
  const existing = await tx.trackerRoute.findUnique({ where: { id }, select: { sourceHash: true, lengthM: true, pointCount: true } });
  const name = file.replace(/\.gpx$/i, "");
  if (existing && existing.sourceHash === sourceHash && existing.pointCount > 0) {
    await tx.trackerRoute.update({ where: { id }, data: { name, eventId: slug } });
    return { id, lengthM: existing.lengthM };
  }
  const { stored, index } = routeIndexFromGpx(gpx);
  if (stored.length < 2) throw new ConfigError(slug, [`route ${file}: no track points found`]);
  if (index.lengthM < 1000) warnings.push(`route ${file} is only ${Math.round(index.lengthM)} m long — is that the right file?`);
  const data = {
    eventId: slug,
    name,
    lengthM: index.lengthM,
    pointCount: stored.length,
    points: stored as unknown as Prisma.InputJsonValue,
    bbox: index.bbox as unknown as Prisma.InputJsonValue,
    sourceHash,
  };
  await tx.trackerRoute.upsert({ where: { id }, create: { id, ...data }, update: data });
  return { id, lengthM: index.lengthM };
}

/**
 * What differs between the file and the database. The hash parts first,
 * then the rows themselves: a route row whose sourceHash is not the file's
 * (or that has no points), an event row whose crewKey is not the resolved
 * value. A missing event row means everything.
 */
async function detectChanges(slug: string, config: LoadedEventConfig, existing: { configHash: string; crewKey: string } | null): Promise<Set<ConfigPart>> {
  const changes = new Set<ConfigPart>(configHashChanges(existing?.configHash, config.hash));
  if (!existing) return new Set<ConfigPart>(["config", "route", "key"]);
  if (existing.crewKey !== config.crew_key) changes.add("key");
  const routeRows = await db.trackerRoute.findMany({ where: { eventId: slug }, select: { id: true, sourceHash: true, pointCount: true } });
  for (const [file, hash] of Object.entries(config.gpx_sha256)) {
    const row = routeRows.find((r) => r.id === ids.route(slug, file));
    if (!row || row.sourceHash !== hash || row.pointCount === 0) changes.add("route");
  }
  return changes;
}

/** Sync one event. Throws ConfigError for a file that does not validate. */
export async function syncEvent(slug: string, opts: SyncOptions = {}): Promise<SyncSummary> {
  const config = loadEventConfig(slug, opts.dir);
  const key = crewKeyStatus(config);
  const warnings: string[] = [...key.warnings];
  const force = Boolean(opts.force);

  const existing = await db.trackerEvent.findUnique({ where: { id: slug }, select: { configHash: true, crewKey: true } });
  const base = {
    slug,
    forced: force,
    crewKey: key.status,
    entries: config.entries.length,
    participants: config.entries.reduce((n, e) => n + e.participants.length, 0),
    devices: countDevices(config),
    checkpoints: config.checkpoints.length,
  };
  const changes = await detectChanges(slug, config, existing);
  const changeList = [...changes];

  if (!force && changes.size === 0) {
    const route = await db.trackerRoute.findUnique({ where: { id: ids.route(slug, config.route) }, select: { lengthM: true } });
    return { ...base, changed: false, changes: [], lengthM: route?.lengthM ?? 0, warnings };
  }

  // Only the key differs (rotated env var, or an earlier sync wrote the dev
  // fallback into a non-local database): one cheap update, no transaction.
  if (!force && existing && changes.size === 1 && changes.has("key")) {
    await db.trackerEvent.update({ where: { id: slug }, data: { crewKey: config.crew_key, configHash: config.hash } });
    const route = await db.trackerRoute.findUnique({ where: { id: ids.route(slug, config.route) }, select: { lengthM: true } });
    return { ...base, changed: true, changes: changeList, lengthM: route?.lengthM ?? 0, warnings };
  }

  const lengthM = await db.$transaction(
    async (tx) => {
      const routeId = ids.route(slug, config.route);
      // The event row first: routes, entries and devices hang off it. The
      // hash is written LAST so a sync that dies halfway reruns next time.
      const eventData = {
        name: config.name,
        kind: config.kind,
        startTime: new Date(config.start_time),
        timezone: config.timezone,
        units: config.units,
        publicDelayS: Math.round(config.public_delay_s),
        crewKey: config.crew_key,
        defaultRouteId: routeId,
      };
      await tx.trackerEvent.upsert({
        where: { id: slug },
        create: { id: slug, ...eventData, configHash: "" },
        update: { ...eventData, configHash: "" },
      });

      const route = await syncRoute(tx, slug, config.route, opts.dir, warnings);

      // Per-entry route overrides (phase 6 in the spec; the config already
      // parses them, so they sync — only compute decides what to do with them).
      const entryRouteIds = new Map<string, string>();
      for (const e of config.entries) {
        if (e.route && e.route !== config.route && !entryRouteIds.has(e.route)) {
          const r = await syncRoute(tx, slug, e.route, opts.dir, warnings);
          entryRouteIds.set(e.route, r.id);
        }
      }

      /* Checkpoints: replaced to match the file (no children). */
      const cpIds: string[] = [];
      for (const [i, cp] of config.checkpoints.entries()) {
        const id = ids.checkpoint(slug, i + 1);
        cpIds.push(id);
        const wanted = checkpointRouteM(cp);
        const routeM = Math.min(wanted, route.lengthM);
        if (wanted > route.lengthM + 1) warnings.push(`checkpoint "${cp.name}" is past the route end (${Math.round(wanted)} m > ${Math.round(route.lengthM)} m) — clamped to the finish`);
        const data = { routeId: route.id, name: cp.name, kind: cp.kind, routeM, sortOrder: i };
        await tx.trackerCheckpoint.upsert({ where: { id }, create: { id, ...data }, update: data });
      }
      await tx.trackerCheckpoint.deleteMany({ where: { route: { eventId: slug }, id: { notIn: cpIds } } });

      /* Entries, participants, devices. */
      const entryIds: string[] = [];
      const participantIds: string[] = [];
      const deviceIds: string[] = [];
      for (const [i, e] of config.entries.entries()) {
        const entryId = ids.entry(slug, e.short_name);
        entryIds.push(entryId);
        const entryData = {
          eventId: slug,
          name: e.name,
          shortName: e.short_name.toUpperCase(),
          color: e.color,
          routeId: e.route && e.route !== config.route ? entryRouteIds.get(e.route) ?? null : null,
          sortOrder: i,
          // Pairs (owner, 2026-10-15): 1 = a classic relay; the labels as the
          // file lists them, empty when it does not (compute numbers them).
          slots: e.slots ?? 1,
          slotNames: e.slot_names ?? [],
        };
        await tx.trackerEntry.upsert({ where: { id: entryId }, create: { id: entryId, ...entryData }, update: entryData });

        for (const [j, p] of e.participants.entries()) {
          // The line's resolved id (explicit id: → device external_id →
          // position; config.ts participantId), never the position alone.
          const pid = ids.participant(slug, e.short_name, j + 1, p);
          participantIds.push(pid);
          const pData = { entryId, name: p.name, initials: p.initials, sortOrder: j };
          await tx.trackerParticipant.upsert({ where: { id: pid }, create: { id: pid, ...pData }, update: pData });
          if (p.device) {
            const did = ids.device(slug, p.device);
            deviceIds.push(did);
            const dData = { eventId: slug, source: p.device.source, externalId: p.device.external_id, participantId: pid, entryId, role: "runner" };
            await tx.trackerDevice.upsert({ where: { id: did }, create: { id: did, ...dData }, update: dData });
          }
        }
        // Every vehicle device reports as the van (the dot's last fallback);
        // the baton, if any, carries progress whoever holds it.
        const entryDevices: Array<[DeviceRef, "vehicle" | "baton"]> = vehicleDevices(e).map((d) => [d, "vehicle"] as const);
        if (e.baton_device) entryDevices.push([e.baton_device, "baton"]);
        for (const [ref, role] of entryDevices) {
          const did = ids.device(slug, ref);
          deviceIds.push(did);
          const dData = { eventId: slug, source: ref.source, externalId: ref.external_id, participantId: null, entryId, role };
          await tx.trackerDevice.upsert({ where: { id: did }, create: { id: did, ...dData }, update: dData });
        }
      }

      // Devices that left the file: unlink, never delete (positions hang off them).
      const unlinked = await tx.trackerDevice.updateMany({
        where: { eventId: slug, id: { notIn: deviceIds }, OR: [{ participantId: { not: null } }, { entryId: { not: null } }] },
        data: { participantId: null, entryId: null },
      });
      if (unlinked.count) warnings.push(`${unlinked.count} device(s) no longer in the file were unlinked from their runner/entry (rows kept)`);

      const strayEntries = await tx.trackerEntry.count({ where: { eventId: slug, id: { notIn: entryIds } } });
      if (strayEntries) warnings.push(`${strayEntries} entr${strayEntries === 1 ? "y" : "ies"} in the database are not in the file (kept: handoffs hang off them)`);

      // Participants that left the file (or whose id changed — a renamed
      // device, or the 2026-10-06 move from positional ids): kept, because
      // their handoffs would go with them, and named so the owner can decide.
      const strays = await tx.trackerParticipant.findMany({
        where: { entry: { eventId: slug }, id: { notIn: participantIds } },
        select: { id: true, name: true, _count: { select: { handoffs: true } } },
        orderBy: { id: "asc" },
      });
      for (const s of strays) {
        const n = s._count.handoffs;
        warnings.push(`participant "${s.name}" (${s.id}) is in the database but not in the file — kept, ${n} handoff${n === 1 ? "" : "s"} point${n === 1 ? "s" : ""} at it`);
      }

      await tx.trackerEvent.update({ where: { id: slug }, data: { configHash: config.hash } });
      return route.lengthM;
    },
    // The points blob and ~50 upserts: well past the 5 s default.
    { maxWait: 15_000, timeout: 60_000 },
  );

  return { ...base, changed: true, changes: changeList, lengthM, warnings };
}

/** The summary for an event that could not be synced at all. */
export function failedSummary(slug: string, err: unknown): SyncSummary {
  const message = err instanceof ConfigError ? err.problems.join("; ") : err instanceof Error ? err.message : String(err);
  return { slug, changed: false, changes: [], forced: false, crewKey: "missing", entries: 0, participants: 0, devices: 0, checkpoints: 0, lengthM: 0, warnings: [], error: message };
}

/** Every events/*.yaml. A file that fails validation is reported, not thrown, so the others still sync. */
export async function syncAll(opts: SyncOptions = {}): Promise<SyncSummary[]> {
  const out: SyncSummary[] = [];
  for (const slug of listEventSlugs(opts.dir)) {
    try {
      out.push(await syncEvent(slug, opts));
    } catch (err) {
      out.push(failedSummary(slug, err));
    }
  }
  return out;
}
