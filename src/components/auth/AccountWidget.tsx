"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

/**
 * Right-edge account affordance that lives in the global Nav.
 *
 *  - Loading / signed-out:   small "Sign in" mono link (no avatar, no flash)
 *  - Signed in:              circular avatar (Google picture if present,
 *                            otherwise initials), click → dropdown with
 *                            Profile / Upload / Sign out
 *
 * Deliberately tiny visual footprint — meant to coexist with the existing
 * nav links + cart button without rebalancing the bar.
 */
export function AccountWidget() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside-click + escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") {
    // Reserve the same width so the nav doesn't shift when state lands.
    return <span aria-hidden style={{ display: "inline-block", width: 28, height: 28 }} />;
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/photographer" })}
        className="nav__link"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          background: "transparent",
          border: 0,
          color: "var(--muted)",
          cursor: "pointer",
        }}
      >
        Sign in
      </button>
    );
  }

  const name = session.user.name || session.user.email || "Account";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const picture = session.user.image;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={name}
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          padding: 0,
          background: "var(--cream)",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          cursor: "pointer",
          overflow: "hidden",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".05em",
        }}
      >
        {picture ? (
          // Google profile pics are tiny, OK to use a plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials || "?"
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            boxShadow: "var(--shadow-lg)",
            padding: 6,
            zIndex: 60,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--line)",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 2,
              }}
            >
              Signed in
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.user.email ?? name}
            </div>
          </div>
          <MenuLink href="/photographer" onClick={() => setOpen(false)}>
            Profile
          </MenuLink>
          <MenuLink href="/photographer/upload" onClick={() => setOpen(false)}>
            Upload photos
          </MenuLink>
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            style={menuItemStyle()}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} style={menuItemStyle()}>
      {children}
    </Link>
  );
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: 0,
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--ink)",
    cursor: "pointer",
    textDecoration: "none",
    borderRadius: 4,
  };
}
