"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    // not built yet — render as disabled
  },
  {
    label: "Photographers",
    href: "/photographer/upload",
    match: (p) => p === "/photographer" || p.startsWith("/photographer/upload"),
  },
  {
    label: "Library",
    href: "/photographer/photos",
    match: (p) => p.startsWith("/photographer/photos"),
  },
];

export function Nav({ cartCount, onLogo, onCart }: Props) {
  const pathname = usePathname() ?? "/";

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
        {VIEWS.map((v) => {
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
