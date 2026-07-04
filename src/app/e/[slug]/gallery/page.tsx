import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { EventGalleryClient } from "@/components/runner/EventGalleryClient";
import { SecureLinkCookie } from "@/components/runner/SecureLinkCookie";
import { GalleryPasswordGate } from "@/components/runner/GalleryPasswordGate";
import {
  resolveEventAccess,
  secretLinkCookieName,
  galleryPasswordCookieName,
} from "@/lib/eventAccess";
import { getEvent } from "@/lib/events";
import { galleryVisibleTo } from "@/lib/eventConfig";
import { canManageEvent, getEffectiveActor } from "@/lib/permissions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * /e/[slug]/gallery — every photo in the event, as an infinite-scroll
 * justified grid (the "Gallery" tab). Access enforcement mirrors the event
 * page exactly (and /api/photos enforces the same mode on the data layer), so
 * a locked event's gallery can't leak through this route.
 */

type SearchParams = { k?: string };

function tokenFor(slug: string, searchParams: SearchParams): string | null {
  if (typeof searchParams.k === "string" && searchParams.k) return searchParams.k;
  return cookies().get(secretLinkCookieName(slug))?.value ?? null;
}

function passwordTokenFor(slug: string): string | null {
  return cookies().get(galleryPasswordCookieName(slug))?.value ?? null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}): Promise<Metadata> {
  const access = await resolveEventAccess(params.slug, {
    token: tokenFor(params.slug, searchParams),
    passwordToken: passwordTokenFor(params.slug),
  });
  const ev = access.ok ? await getEvent(params.slug) : null;
  const noindex =
    !access.ok ||
    access.via === "secure-link" ||
    access.via === "password" ||
    access.via === "account";
  return {
    title: ev ? `${ev.name} — Gallery — Mikian.Photos` : "Mikian.Photos",
    description: ev ? `Every ${ev.name} photo.` : undefined,
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function EventGalleryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  const slug = params.slug;
  const token = tokenFor(slug, searchParams);
  const access = await resolveEventAccess(slug, {
    token,
    passwordToken: passwordTokenFor(slug),
  });

  if (!access.ok) {
    if (access.reason === "needs-auth") {
      redirect(`/photographer/sign-in?callbackUrl=${encodeURIComponent(`/e/${slug}/gallery`)}`);
    }
    if (access.reason === "needs-password") {
      const ev = await getEvent(slug);
      return <GalleryPasswordGate slug={slug} eventName={ev?.name} />;
    }
    notFound();
  }

  // Gallery-visibility permission: an "owner"-only gallery is hidden from
  // everyone but the owner/managers (even though the event itself is viewable).
  // 404 rather than reveal the full wall to a buyer. Mirrors the nav + /me gate
  // (canManageEvent) so the tab and the page never disagree.
  const ev = await getEvent(slug);
  if (ev && ev.galleryVisibility === "owner") {
    const row = await db.event.findUnique({ where: { id: slug }, select: { ownerId: true } });
    const canManage = canManageEvent(await getEffectiveActor(), { ownerId: row?.ownerId ?? null });
    if (!galleryVisibleTo(ev.galleryVisibility, canManage)) notFound();
  }

  return (
    <>
      {/* Persist the secure-link token so refresh + checkout keep working. */}
      {typeof searchParams.k === "string" && searchParams.k ? (
        <SecureLinkCookie slug={slug} token={searchParams.k} />
      ) : null}
      <EventGalleryClient slug={slug} />
    </>
  );
}
