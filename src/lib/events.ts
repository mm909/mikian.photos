/**
 * Multi-event data layer. Server-only. Replaces the hardcoded `currentEvent`
 * constant in src/lib/data.ts.
 *
 * `Event.id` doubles as the public URL slug, so `getEvent(slug)` is a primary-
 * key lookup. Visibility filtering ("which events show in the directory") lives
 * here so the marketing homepage, the admin list, and any picker share one
 * definition.
 */
import "server-only";
import { db } from "./db";
import {
  type AccessMode,
  type EventStatus,
  type EventType,
  normalizeAccessMode,
  normalizeStatus,
  normalizeType,
} from "./eventConfig";

export type EventDTO = {
  id: string;
  name: string;
  /** Accent-headline tuple derived from `name` (replaces the old name[3] tuple). */
  nameParts: [string, string, string];
  date: Date;
  city: string;
  org: string;
  type: EventType;
  status: EventStatus;
  accessMode: AccessMode;
  isFree: boolean;
  ocrEnabled: boolean;
  faceRecEnabled: boolean;
  /** Camp color-group detection on for this event (see eventCapabilities). */
  colorGroupEnabled: boolean;
  /** Optional rename map for auto-detected color groups ({ key: label }). */
  colorGroupLabels: Record<string, string> | null;
  /** Owner-set bundle price in cents; null falls back to the static default. */
  bundlePriceCents: number | null;
  /** Optional external "browse all" URL (e.g. a shared Google Photos album).
   *  When set, the runner's "Browse all photos" button links out here instead
   *  of opening the in-app gallery. null → in-app browse. */
  externalBrowseUrl: string | null;
};

// Columns that make up an EventDTO. secretLinkToken/ocrSettings are deliberately
// excluded — sensitive / large; the access resolver + admin query those directly.
const EVENT_DTO_SELECT = {
  id: true,
  name: true,
  date: true,
  city: true,
  org: true,
  type: true,
  status: true,
  accessMode: true,
  isFree: true,
  ocrEnabled: true,
  faceRecEnabled: true,
  colorGroupEnabled: true,
  colorGroupLabels: true,
  bundlePriceCents: true,
  externalBrowseUrl: true,
} as const;

type EventRow = {
  id: string;
  name: string;
  date: Date;
  city: string;
  org: string;
  type: string;
  status: string;
  accessMode: string;
  isFree: boolean;
  ocrEnabled: boolean;
  faceRecEnabled: boolean;
  colorGroupEnabled: boolean;
  colorGroupLabels: unknown;
  bundlePriceCents: number | null;
  externalBrowseUrl: string | null;
};

function toDTO(row: EventRow): EventDTO {
  return {
    id: row.id,
    name: row.name,
    nameParts: toNameParts(row.name),
    date: row.date,
    city: row.city,
    org: row.org,
    type: normalizeType(row.type),
    status: normalizeStatus(row.status),
    accessMode: normalizeAccessMode(row.accessMode),
    isFree: row.isFree,
    ocrEnabled: row.ocrEnabled,
    faceRecEnabled: row.faceRecEnabled,
    colorGroupEnabled: row.colorGroupEnabled,
    colorGroupLabels: normalizeColorGroupLabels(row.colorGroupLabels),
    bundlePriceCents: row.bundlePriceCents,
    externalBrowseUrl: row.externalBrowseUrl,
  };
}

/** Coerce the stored colorGroupLabels JSON to a flat { key: label } string map
 *  (or null). Defensive — the column is free-form JSON. */
function normalizeColorGroupLabels(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Split an event name into the 3-slot accent-headline tuple the runner UI
 * expects (the old `currentEvent.name` shape). "Lighthouse Half Marathon" →
 * ["Lighthouse", "Half", "Marathon"]; everything past the 2nd word folds into
 * the last slot. Pads with "" so the tuple is always length 3.
 */
export function toNameParts(name: string): [string, string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return [words[0] ?? "", words[1] ?? "", words.slice(2).join(" ")];
}

/** Resolve an event by id (== slug). null when missing. */
export async function getEvent(idOrSlug: string): Promise<EventDTO | null> {
  if (!idOrSlug) return null;
  try {
    const row = await db.event.findUnique({
      where: { id: idOrSlug },
      select: EVENT_DTO_SELECT,
    });
    return row ? toDTO(row) : null;
  } catch {
    return null;
  }
}

/**
 * List events, newest first.
 *   - publicOnly: only published + public events (the marketing directory).
 *   - includeArchived: include archived events (admin full list). Ignored when
 *     publicOnly is set (archived is never public-listed).
 * Default (no opts): all non-archived events.
 */
export async function listEvents(opts?: {
  publicOnly?: boolean;
  includeArchived?: boolean;
}): Promise<EventDTO[]> {
  const where = opts?.publicOnly
    ? { status: "published", accessMode: "public" }
    : opts?.includeArchived
      ? {}
      : { status: { not: "archived" } };
  try {
    const rows = await db.event.findMany({
      where,
      orderBy: { date: "desc" },
      select: EVENT_DTO_SELECT,
    });
    return rows.map(toDTO);
  } catch {
    return [];
  }
}

/**
 * Events a photographer may upload into. Owner + race_director (isAdmin) may
 * upload to ANY non-archived event; a plain photographer is limited to events
 * where they hold an EventPhotographer membership row.
 */
export async function listUploadableEvents(opts: {
  photographerId: string;
  isAdmin: boolean;
}): Promise<EventDTO[]> {
  try {
    if (opts.isAdmin) return await listEvents();
    const rows = await db.event.findMany({
      where: {
        status: { not: "archived" },
        eventPhotographers: { some: { photographerId: opts.photographerId } },
      },
      orderBy: { date: "desc" },
      select: EVENT_DTO_SELECT,
    });
    return rows.map(toDTO);
  } catch {
    return [];
  }
}

/**
 * Authoritative upload-access check (the real gate — the picker is only UX).
 * Owner/race_director may upload to any existing event; everyone else needs a
 * membership row.
 */
export async function canUploadToEvent(opts: {
  photographerId: string;
  isAdmin: boolean;
  eventId: string;
}): Promise<boolean> {
  try {
    if (opts.isAdmin) {
      const ev = await db.event.findUnique({
        where: { id: opts.eventId },
        select: { id: true },
      });
      return Boolean(ev);
    }
    const m = await db.eventPhotographer.findUnique({
      where: {
        eventId_photographerId: {
          eventId: opts.eventId,
          photographerId: opts.photographerId,
        },
      },
      select: { id: true },
    });
    return Boolean(m);
  } catch {
    return false;
  }
}

/**
 * The default event for code paths that used to default to the hardcoded
 * `currentEvent.id` (admin pricing/orders APIs, the upload page's findFirst).
 * Newest published event; falls back to newest of any status so a fresh /
 * draft-only DB still resolves something.
 */
export async function getDefaultEvent(): Promise<EventDTO | null> {
  try {
    const published = await db.event.findFirst({
      where: { status: "published" },
      orderBy: { date: "desc" },
      select: EVENT_DTO_SELECT,
    });
    if (published) return toDTO(published);
    const any = await db.event.findFirst({
      orderBy: { date: "desc" },
      select: EVENT_DTO_SELECT,
    });
    return any ? toDTO(any) : null;
  } catch {
    return null;
  }
}
