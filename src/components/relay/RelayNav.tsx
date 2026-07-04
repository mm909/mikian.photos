"use client";

import Link from "next/link";

/**
 * One nav for every DTK page so the links never differ page-to-page (owner
 * feedback: "we should see the same options on each page"). The live map keeps
 * these same destinations inside its floating ☰ menu; stats/plan/manage render
 * this row in their headers. Owner-only destinations (Plan, Manage) only show
 * for the owner.
 */
const LINKS: { key: string; label: string; href: string; ownerOnly?: boolean }[] = [
  { key: "live", label: "Live map", href: "/tsp" },
  { key: "stats", label: "Full stats", href: "/tsp/stats" },
  { key: "plan", label: "Plan", href: "/tsp/plan", ownerOnly: true },
  { key: "manage", label: "Manage", href: "/tsp/manage", ownerOnly: true },
];

export function RelayNav({
  current,
  isOwner,
  /** Dark pages (stats/plan) vs the light manage console. */
  dark = true,
}: {
  current: "live" | "stats" | "plan" | "manage";
  isOwner: boolean;
  dark?: boolean;
}) {
  const muted = dark ? "#9a9186" : "var(--muted)";
  const activeColor = dark ? "#f0b060" : "var(--accent)";
  return (
    <nav
      aria-label="DTK pages"
      style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}
    >
      {LINKS.filter((l) => isOwner || !l.ownerOnly).map((l) => (
        <Link
          key={l.key}
          href={l.href}
          aria-current={current === l.key ? "page" : undefined}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            textDecoration: "none",
            color: current === l.key ? activeColor : muted,
            borderBottom: current === l.key ? `1px solid ${activeColor}` : "1px solid transparent",
            paddingBottom: 2,
          }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
