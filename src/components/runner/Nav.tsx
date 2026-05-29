"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "./Logo";
import { AccountWidget } from "@/components/auth/AccountWidget";

type Props = {
  cartCount: number;
  onLogo: () => void;
  onCart: () => void;
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
    label: "Runners",
    href: "/",
    match: (p) =>
      p === "/" ||
      p.startsWith("/results") ||
      p.startsWith("/cart") ||
      p.startsWith("/checkout") ||
      p.startsWith("/success"),
  },
  {
    label: "Race Directors",
    // Visible only to RDs + owner. Disabled (no href) until the dashboards land.
    roles: ["race_director", "owner"],
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
    // The unified photo viewer + operations surface. Browse every upload,
    // search bibs, and open any photo's detail modal to re-run / debug OCR
    // and faces, inspect metadata, and delete / hide / download. The old
    // owner-only OCR + Face Lab folded into this modal (owners additionally
    // get the OCR tuning knobs + cross-event face-cluster inspector there),
    // so the legacy /ocr-lab + /face-lab URLs now redirect here.
    label: "Library",
    href: "/photographer/photos",
    match: (p) =>
      p.startsWith("/photographer/photos") ||
      p.startsWith("/photographer/ocr-lab") ||
      p.startsWith("/photographer/face-lab"),
    roles: ["photographer", "owner"],
  },
  {
    // Owner-only insights — bib & face coverage table. Sits alongside Admin
    // so they're grouped visually in the nav.
    label: "Coverage",
    href: "/admin/coverage",
    match: (p) => p.startsWith("/admin/coverage"),
    roles: ["owner"],
  },
  {
    // Owner-only roster view — race entrants joined with our per-runner
    // photo + face counts. Used to verify "do we have everyone we should?".
    label: "Roster",
    href: "/admin/roster",
    match: (p) => p.startsWith("/admin/roster"),
    roles: ["owner"],
  },
  {
    label: "Admin",
    href: "/admin/users",
    // Narrowed from /admin/* so Coverage doesn't double-highlight this chip.
    match: (p) => p.startsWith("/admin/users"),
    roles: ["owner"],
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

export function Nav({ cartCount, onLogo, onCart }: Props) {
  const pathname = usePathname() ?? "/";
  const { data: session } = useSession();
  const sessionRoles = session?.roles;

  // Filter to views the current actor is permitted to see. Unauthenticated
  // users get only the always-public views (Runners). Signed-in users see
  // the views their roles unlock.
  const visibleViews = VIEWS.filter((v) => hasRoleAny(sessionRoles, v.roles));

  return (
    <nav className="nav">
      <Logo onClick={onLogo} />
      <ul
        style={{
          display: "flex",
          gap: 4,
          margin: 0,
          marginLeft: 18,
          padding: 0,
          listStyle: "none",
          alignItems: "center",
        }}
      >
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
      </ul>
      <span className="nav__spacer" />
      {cartCount > 0 && (
        <button className="nav__cart" onClick={onCart}>
          Cart <span className="nav__count">{cartCount}</span>
        </button>
      )}
      <AccountWidget />
    </nav>
  );
}
