import "server-only";
import { randomBytes } from "crypto";

/** Mint a URL-safe secret token for a secure-link event. */
export function mintSecretLinkToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Max owner-settable bundle price, in cents ($1,000). */
export const MAX_PRICE_CENTS = 1_000_00;

/** Serialize an Event row (with optional counts) for the owner admin UI. */
export function adminEventShape(ev: {
  id: string;
  name: string;
  date: Date;
  city: string;
  org: string;
  type: string;
  status: string;
  accessMode: string;
  secretLinkToken: string | null;
  isFree: boolean;
  bundlePriceCents: number | null;
  ocrEnabled: boolean;
  faceRecEnabled: boolean;
  colorGroupEnabled: boolean;
  colorGroupLabels?: unknown;
  externalBrowseUrl?: string | null;
  searchHeadline?: string | null;
  galleryPasswordHash?: string | null;
  ownerId: string | null;
  createdAt: Date;
  _count?: { photos: number; eventPhotographers: number };
}) {
  return {
    id: ev.id,
    name: ev.name,
    date: ev.date.toISOString(),
    city: ev.city,
    org: ev.org,
    type: ev.type,
    status: ev.status,
    accessMode: ev.accessMode,
    secretLinkToken: ev.secretLinkToken,
    isFree: ev.isFree,
    bundlePriceCents: ev.bundlePriceCents,
    ocrEnabled: ev.ocrEnabled,
    faceRecEnabled: ev.faceRecEnabled,
    colorGroupEnabled: ev.colorGroupEnabled,
    colorGroupLabels:
      ev.colorGroupLabels && typeof ev.colorGroupLabels === "object" && !Array.isArray(ev.colorGroupLabels)
        ? (ev.colorGroupLabels as Record<string, string>)
        : null,
    externalBrowseUrl: ev.externalBrowseUrl ?? null,
    searchHeadline: ev.searchHeadline ?? null,
    // Never expose the hash — just whether a password is set.
    hasGalleryPassword: Boolean(ev.galleryPasswordHash),
    ownerId: ev.ownerId,
    createdAt: ev.createdAt.toISOString(),
    photoCount: ev._count?.photos ?? 0,
    photographerCount: ev._count?.eventPhotographers ?? 0,
  };
}
