"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "./Logo";
import { AccountWidget } from "@/components/auth/AccountWidget";

type Props = {
  onLogo: () => void;
};

/** Extract the event slug from a /e/[slug][/...] pathname; null elsewhere. */
function eventSlugFromPath(p: string): string | null {
  const m = p.match(/^\/e\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type EventMe = { type: string; canManage: boolean; canUpload: boolean; hasRoster: boolean };
type View = { label: string; href: string; active: boolean };

/**
 * Contextual navigation (v2.1):
 *   - Off an event → the directory (logo) + a platform-owner "Events" link.
 *   - Inside /e/[slug] → event-scoped links: Photos, Upload (if you may upload),
 *     Orders + Settings (if you manage the event). The viewer's per-event
 *     capabilities come from GET /api/events/[slug]/me.
 * Account widget always shows on the right.
 */
export function Nav({ onLogo }: Props) {
  const pathname = usePathname() ?? "/";
  const { data: session, status } = useSession();
  // Only treat the viewer as authed once next-auth resolves — never during the
  // "loading" first paint, so management links can't flash before the session
  // lands (or linger after sign-out).
  const isAuthed = status === "authenticated";
  const isOwner = isAuthed && Boolean(session?.roles?.includes("owner"));
  const slug = eventSlugFromPath(pathname);

  // The event-management admin surfaces (Orders, Roster) are NOT /e/[slug] URLs
  // — they carry the event id in `?eventId=`. Without this the contextual nav
  // collapsed to just "Events" the moment you clicked Orders. Read it from the
  // live location in an effect (not useSearchParams) so the global root-layout
  // nav doesn't force every static page into client rendering.
  const onAdminEventSurface =
    pathname.startsWith("/admin/orders") || pathname.startsWith("/admin/roster");
  const [adminEventId, setAdminEventId] = useState<string | null>(null);
  useEffect(() => {
    if (!onAdminEventSurface || typeof window === "undefined") {
      setAdminEventId(null);
      return;
    }
    setAdminEventId(new URLSearchParams(window.location.search).get("eventId"));
  }, [pathname, onAdminEventSurface]);

  // The event the nav is scoped to: the /e/[slug] slug, or the ?eventId on an
  // admin surface reached from an event.
  const eventId = slug ?? adminEventId;

  const [me, setMe] = useState<EventMe | null>(null);
  useEffect(() => {
    // Clear immediately when there's no event scope OR the viewer isn't signed
    // in — so canManage/canUpload can't stay stale-true across a sign-out and
    // leak the management links. Re-runs on identity change (deps below).
    if (!eventId || !isAuthed) {
      setMe(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(eventId)}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EventMe | null) => {
        if (!cancelled) setMe(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId, isAuthed, session?.user?.email]);

  // Mobile hamburger menu. Closes on navigation.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const views: View[] = [];
  if (eventId) {
    views.push({ label: "Photos", href: `/e/${eventId}`, active: pathname === `/e/${eventId}` });
    // Management links are double-gated on isAuthed so even a stale `me` (mid
    // sign-out) can never render them to a signed-out viewer.
    if (me?.canUpload && isAuthed) {
      views.push({
        label: "Upload",
        href: `/e/${eventId}/upload`,
        active: pathname.startsWith(`/e/${eventId}/upload`),
      });
    }
    if (me?.canManage && isAuthed) {
      if (me.hasRoster) {
        views.push({
          label: "Roster",
          href: `/admin/roster?eventId=${eventId}`,
          active: pathname.startsWith("/admin/roster"),
        });
      }
      views.push({
        label: "Orders",
        href: `/admin/orders?eventId=${eventId}`,
        active: pathname.startsWith("/admin/orders"),
      });
      views.push({
        label: "Settings",
        href: `/e/${eventId}/settings`,
        active: pathname.startsWith(`/e/${eventId}/settings`),
      });
    }
  } else if (isOwner) {
    views.push({
      label: "Events",
      href: "/admin/events",
      active: pathname.startsWith("/admin"),
    });
  } else if (isAuthed) {
    // Signed-in buyer off-event (e.g. their /orders/[n] receipt) — give them a
    // way back to their orders instead of an empty bar. Signed-out / magic-link
    // viewers still get just the logo + Sign in.
    views.push({
      label: "My orders",
      href: "/runner",
      active: pathname.startsWith("/runner") || pathname.startsWith("/orders"),
    });
  }

  return (
    <nav className="nav">
      <Logo onClick={onLogo} />
      <button
        type="button"
        className="nav__hamburger"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <ul className={`nav__links${menuOpen ? " nav__links--open" : ""}`}>
        {views.map((v) => (
          <li key={v.label}>
            <Link
              href={v.href}
              aria-current={v.active ? "page" : undefined}
              style={{
                display: "inline-block",
                padding: "6px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: 4,
                color: v.active ? "var(--ink)" : "var(--muted)",
                background: v.active ? "var(--cream)" : "transparent",
              }}
            >
              {v.label}
            </Link>
          </li>
        ))}
        <li className="nav__account">
          <AccountWidget />
        </li>
      </ul>
    </nav>
  );
}
