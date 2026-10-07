import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { DeviceSource, EventKind, Units } from "./types";

/**
 * The event SHELL: what the crew, van and join pages need before any
 * position exists — who the entries and participants are and which device
 * belongs to whom. Loaded from the Tracker* tables that sync.ts fills from
 * events/<slug>.yaml, never from the YAML directly, so the pages see the
 * same ids the handoff and ingest APIs expect (config.ts `ids.*`).
 *
 * Wrapped in React's `cache()` so a page and its generateMetadata, which
 * both need the shell (the crew page's manifest link carries the key), run
 * one query per request.
 */

export interface ShellDevice {
  source: DeviceSource;
  externalId: string;
}

export interface ShellParticipant {
  id: string;
  name: string;
  initials: string;
  sortOrder: number;
  /** The runner's own phone, or null when the YAML gave none. */
  device: ShellDevice | null;
}

export interface ShellEntry {
  id: string;
  name: string;
  shortName: string;
  color: string;
  sortOrder: number;
  participants: ShellParticipant[];
  /** The support van(s) that post through the web adapter. */
  vehicleDevices: ShellDevice[];
}

export interface EventShell {
  /** The slug: events/<id>.yaml, /track/<id>. */
  id: string;
  name: string;
  kind: EventKind;
  units: Units;
  timezone: string;
  /** UTC ISO. */
  startTime: string;
  /** Resolved crew key ("" when the env var is unset in production). SERVER ONLY. */
  crewKey: string;
  entries: ShellEntry[];
}

/** The shell with the crew key removed — the only shape that may be sent to the browser. */
export type ClientShell = Omit<EventShell, "crewKey">;

export const loadEventShell = cache(async (slug: string): Promise<EventShell | null> => {
  const ev = await db.trackerEvent.findUnique({
    where: { id: slug },
    include: {
      entries: {
        orderBy: [{ sortOrder: "asc" }, { shortName: "asc" }],
        include: {
          participants: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            include: { devices: true },
          },
          devices: true,
        },
      },
    },
  });
  if (!ev) return null;

  return {
    id: ev.id,
    name: ev.name,
    kind: ev.kind === "solo" ? "solo" : "relay",
    units: ev.units === "metric" ? "metric" : "imperial",
    timezone: ev.timezone,
    startTime: ev.startTime.toISOString(),
    crewKey: ev.crewKey,
    entries: ev.entries.map((e) => ({
      id: e.id,
      name: e.name,
      shortName: e.shortName,
      color: e.color,
      sortOrder: e.sortOrder,
      participants: e.participants.map((p) => {
        // A participant's device is the one with role 'runner'; any other
        // row on the participant (none in v1) would be a baton or similar.
        const dev = p.devices.find((d) => d.role === "runner") ?? p.devices[0] ?? null;
        return {
          id: p.id,
          name: p.name,
          initials: p.initials,
          sortOrder: p.sortOrder,
          device: dev ? { source: dev.source as DeviceSource, externalId: dev.externalId } : null,
        };
      }),
      vehicleDevices: e.devices
        .filter((d) => d.role === "vehicle")
        .map((d) => ({ source: d.source as DeviceSource, externalId: d.externalId })),
    })),
  };
});

/** Strip the crew key. Pages pass THIS to their client apps, never the shell itself. */
export function clientShell(shell: EventShell): ClientShell {
  const { crewKey: _omit, ...rest } = shell;
  void _omit;
  return rest;
}
