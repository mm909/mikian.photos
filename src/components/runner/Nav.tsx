"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "./Logo";
import { AccountWidget } from "@/components/auth/AccountWidget";
import { useViewAs, rolesForView } from "@/lib/viewAs";

type Props = {
  onLogo: () => void;
};

type View = {
  label: string;
  href?: string;          // omitted → disabled
  match?: (path: string) => boolean;
  /** Roles that can see this view. Omitted = visible to everyone. Owner
   *  implies every other role (handled by hasRoleAny). */
  roles?: ReadonlyArray<"photographer" | "race_director" | "owner">;
};

const VIEWS: View[] = [
  {
    label: "Lighthouse Half",
    href: "/",
    match: (p) =>
      p === "/" ||
      p.startsWith("/results") ||
      p.startsWith("/checkout"),
  },
  {
    // Photographer dashboard — landing place for "I shot this race" view.
    // Upload is a sub-surface of the photographer flow so the dashboard
    // chip stays active there too. Library + OCR Lab have their own chips.
    label: "Photographers",
    href: "/photographer",
    match: (p) =>
      p === "/photographer" || p.startsWith("/photographer/upload"),
    roles: ["photographer", "owner"],
  },
  {
    // Roster + coverage surface (owner + race director). Roster lists race
    // entrants joined with per-runner photo/face counts; the same page carries
    // the bib/face/gaps coverage tabs. (/admin/coverage redirects here.)
    label: "Roster",
    href: "/admin/roster",
    match: (p) => p.startsWith("/admin/roster") || p.startsWith("/admin/coverage"),
    roles: ["race_director", "owner"],
  },
  {
    // Orders dashboard — every order for the run, with sum stats + search.
    // Owner gets refund / resend per row; race directors see it read-only.
    label: "Orders",
    href: "/admin/orders",
    match: (p) => p.startsWith("/admin/orders"),
    roles: ["race_director", "owner"],
  },
];

function hasRoleAny(
  sessionRoles: readonly string[] | undefined,
  allowed: ReadonlyArray<string> | undefined
): boolean {
  if (!allowed) return true; // public view
  if (!sessionRoles) return false;
  if (sessionRoles.includes("owner")) return true;
  return allowed.some((r) => sessionRoles.includes(r));
}

export function Nav({ onLogo }: Props) {
  const pathname = usePathname() ?? "/";
  const { data: session } = useSession();
  const sessionRoles = session?.roles;
  const [viewAs] = useViewAs();

  // Owners can preview the site as a lower role via "view as" (set in the
  // account menu); everyone else sees the views their real roles unlock.
  // Unauthenticated users get only the always-public views.
  const isActualOwner = Boolean(sessionRoles?.includes("owner"));
  const effectiveRoles = isActualOwner ? rolesForView(viewAs) : sessionRoles;
  const visibleViews = VIEWS.filter((v) => hasRoleAny(effectiveRoles, v.roles));

  // Mobile hamburger menu. Closes on navigation.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="nav">
      <Logo onClick={onLogo} />
      {/* Hamburger — visible only on mobile (CSS). Toggles the link dropdown.
          margin-left:auto (set in CSS) pushes it to the far right of the bar. */}
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
        {visibleViews.map((v) => {
          const active = v.href && v.match?.(pathname);
          return (
            <li key={v.label}>
              {v.href ? (
                <Link
                  href={v.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    borderRadius: 4,
                    color: active ? "var(--ink)" : "var(--muted)",
                    background: active ? "var(--cream)" : "transparent",
                  }}
                >
                  {v.label}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title="Coming soon"
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--line)",
                    cursor: "not-allowed",
                    userSelect: "none",
                  }}
                >
                  {v.label}
                </span>
              )}
            </li>
          );
        })}
        {/* Account widget lives INSIDE the link list so it sits inline at the
            right on desktop and folds into the hamburger dropdown on mobile. */}
        <li className="nav__account">
          <AccountWidget />
        </li>
      </ul>
    </nav>
  );
}
