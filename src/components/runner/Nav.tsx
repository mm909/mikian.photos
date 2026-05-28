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
    label: "Library",
    href: "/photographer/photos",
    match: (p) => p.startsWith("/photographer/photos"),
    roles: ["photographer", "owner"],
  },
  {
    // Owner-only — internal tuning surface for OCR detection. Photographers
    // get the per-photo "OCR view" inside the library detail modal; the lab
    // is for cross-photo experimentation (different model params, hand-
    // picked test set) and would be more noise than signal in their nav.
    label: "OCR Lab",
    href: "/photographer/ocr-lab",
    match: (p) => p.startsWith("/photographer/ocr-lab"),
    roles: ["owner"],
  },
  {
    label: "Admin",
    href: "/admin/users",
    match: (p) => p.startsWith("/admin"),
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
