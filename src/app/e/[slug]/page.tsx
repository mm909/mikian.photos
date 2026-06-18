import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { RunnerFlow } from "@/components/runner/screens/RunnerFlow";
import { SecureLinkCookie } from "@/components/runner/SecureLinkCookie";
import { GalleryPasswordGate } from "@/components/runner/GalleryPasswordGate";
import {
  resolveEventAccess,
  secretLinkCookieName,
  galleryPasswordCookieName,
} from "@/lib/eventAccess";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Per-event runner flow (search → teaser → lightbox). The event is identified
 * by the [slug] (== Event.id). Access enforcement lives here (not a layout, so
 * we can read `?k=` from searchParams) and is mirrored in /api/photos so the
 * data layer enforces the same mode — see src/lib/eventAccess.ts.
 *
 * The global RunnerProvider (root layout) reads the slug from this URL and
 * fetches this event's catalog; RunnerFlow is the same component the single-
 * event homepage used to render.
 */

type SearchParams = { k?: string };

function tokenFor(slug: string, searchParams: SearchParams): string | null {
  if (typeof searchParams.k === "string" && searchParams.k) return searchParams.k;
  // Fall back to the remembered cookie for navigations that dropped ?k=.
  return cookies().get(secretLinkCookieName(slug))?.value ?? null;
}

/** The gallery-password unlock marker (set httpOnly by /api/gallery-password). */
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
  // Anything but a public, unlocked event must never be indexed.
  const noindex =
    !access.ok ||
    access.via === "secure-link" ||
    access.via === "password" ||
    access.via === "account";
  return {
    title: ev ? `${ev.name} — Mikian.Photos` : "Mikian.Photos",
    description: ev ? `Find your ${ev.name} photos.` : undefined,
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function EventPage({
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
      redirect(`/photographer/sign-in?callbackUrl=${encodeURIComponent(`/e/${slug}`)}`);
    }
    if (access.reason === "needs-password") {
      // Password mode + not unlocked → show the password prompt (revealing the
      // gallery's name is intended for this mode, unlike secret-link's 404).
      const ev = await getEvent(slug);
      return <GalleryPasswordGate slug={slug} eventName={ev?.name} />;
    }
    notFound();
  }

  return (
    <>
      {/* Persist the secure-link token so refresh + checkout keep working. */}
      {typeof searchParams.k === "string" && searchParams.k ? (
        <SecureLinkCookie slug={slug} token={searchParams.k} />
      ) : null}
      <RunnerFlow />
    </>
  );
}
