/**
 * Event configuration enums + guards. Shared by the events data layer
 * (src/lib/events.ts), the owner admin API (/api/admin/events), and the access
 * resolver (src/lib/eventAccess.ts).
 *
 * Stored as plain strings on the Event row (not Prisma enums) to match the
 * project convention (Photographer.roles, PhotoBib.source) and keep `db push`
 * frictionless. Validate at the boundary with the guards below — mirrors
 * ALL_ROLES / normalizeRoles in src/lib/permissions.ts.
 */

/** Event lifecycle. "draft" = not live; "published" = live; "archived" = retired. */
export const EVENT_STATUSES = ["draft", "published", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * Per-event visibility:
 *   - "public"        listed in the directory + searchable by anyone
 *   - "secure-link"   unlisted; reachable only with the event's secretLinkToken
 *   - "password"      unlisted; visitors type a shared gallery password to enter
 *                     (friendlier to share than a long secret link)
 *   - "account-only"  must be signed in (any account) to view
 *   - "private"       MOST private: requires BOTH the secret link AND sign-in.
 *                     The default for kids'-camp / sensitive galleries.
 */
export const ACCESS_MODES = ["public", "secure-link", "password", "account-only", "private"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** Human labels for the access modes (UI). */
export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  public: "Public (listed)",
  "secure-link": "Secret link",
  password: "Password",
  "account-only": "Sign-in required",
  private: "Secret link + sign-in (most private)",
};

export function isEventStatus(v: unknown): v is EventStatus {
  return typeof v === "string" && (EVENT_STATUSES as readonly string[]).includes(v);
}

export function isAccessMode(v: unknown): v is AccessMode {
  return typeof v === "string" && (ACCESS_MODES as readonly string[]).includes(v);
}

/**
 * Event type — the preset that drives the runner UX + capability defaults.
 *   - "race" = bib + face + browse, roster, course map (paid, public).
 *   - "camp" = find-by-face private gallery (face detection on, free, secret
 *     link + sign-in). For kids' camps, clubs, weddings, sensitive shoots.
 * Data-driven: adding a type is a config addition here, not a schema change.
 */
export const EVENT_TYPES = ["race", "camp"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);
}
export function normalizeType(v: unknown): EventType {
  return isEventType(v) ? v : "race";
}

/** Human label for an event type (UI). */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  race: "Race / timed event (bib + face)",
  camp: "Camp / private gallery (face + secret link)",
};

export type SearchMode = "bib" | "face" | "browse";

/**
 * The capability set the runner flow + APIs consult, derived from the event
 * type plus the existing toggles (faceRecEnabled, isFree). Type drives the
 * control flow; the toggles fine-tune it (e.g. a gallery with face detection
 * on offers a selfie search; a free event sells nothing).
 */
export type EventCapabilities = {
  searchModes: SearchMode[];
  primarySearch: SearchMode;
  hasRoster: boolean;
  hasCourseMap: boolean;
  sells: "paid" | "free";
  /** Camp color groups on: a face search also pulls in the runner's whole
   *  color group (the team-color expansion). Drives result-screen copy. */
  colorGroups: boolean;
};

export function eventCapabilities(ev: {
  type?: string | null;
  faceRecEnabled?: boolean | null;
  isFree?: boolean | null;
  colorGroupEnabled?: boolean | null;
}): EventCapabilities {
  const type = normalizeType(ev.type);
  const face = ev.faceRecEnabled !== false; // default-on unless explicitly off
  const sells: "paid" | "free" = ev.isFree ? "free" : "paid";

  if (type === "race") {
    return {
      searchModes: ["bib", "face", "browse"],
      primarySearch: "bib",
      hasRoster: true,
      hasCourseMap: true,
      sells,
      colorGroups: false,
    };
  }
  // camp — find-by-face (when face detection is on), else browse-only. Color
  // grouping needs face boxes, so it only matters when face is on too.
  const searchModes: SearchMode[] = face ? ["face", "browse"] : ["browse"];
  return {
    searchModes,
    primarySearch: face ? "face" : "browse",
    hasRoster: false,
    hasCourseMap: false,
    sells,
    colorGroups: face && ev.colorGroupEnabled === true,
  };
}

/**
 * The toggle defaults a newly-created event of this type starts with (the
 * create form / API pre-fill these; the owner can still override each).
 */
export function defaultsForType(type: EventType): {
  ocrEnabled: boolean;
  faceRecEnabled: boolean;
  colorGroupEnabled: boolean;
  isFree: boolean;
  accessMode: AccessMode;
} {
  if (type === "race") {
    return {
      ocrEnabled: true,
      faceRecEnabled: true,
      colorGroupEnabled: false,
      isFree: false,
      accessMode: "public",
    };
  }
  // camp — find-by-face + color groups on, no bib OCR, free, and locked to
  // secret link + sign-in.
  return {
    ocrEnabled: false,
    faceRecEnabled: true,
    colorGroupEnabled: true,
    isFree: true,
    accessMode: "private",
  };
}

/** Coerce a stored value to a known status, defaulting to "published". */
export function normalizeStatus(v: unknown): EventStatus {
  return isEventStatus(v) ? v : "published";
}

/** Coerce a stored value to a known access mode, defaulting to "public". */
export function normalizeAccessMode(v: unknown): AccessMode {
  return isAccessMode(v) ? v : "public";
}

/**
 * Slugify a free-form event name into a URL-safe id. Lowercase, spaces and
 * punctuation collapsed to single hyphens, trimmed. The result is also the
 * Event primary key (id == slug), so it must match ^[a-z0-9-]+$.
 */
export function slugifyEventName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Is this a valid event slug/id? (Same charset enforced at creation.) */
export function isValidEventSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}
