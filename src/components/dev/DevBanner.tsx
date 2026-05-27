"use client";

import Link from "next/link";
import { useDevSettings } from "@/lib/devSettings";

export function DevBanner() {
  const [s] = useDevSettings();
  if (!s.showBanner) return null;
  return (
    <div
      style={{
        background: "var(--cream)",
        color: "var(--muted)",
        padding: "5px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        gap: 10,
        justifyContent: "center",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ color: "var(--accent)" }}>● Dev</span>
      <span>
        {Object.entries(s.asRoles)
          .filter(([, on]) => on)
          .map(([k]) => k.replace("_", " "))
          .join(" · ") || "no roles"}
      </span>
      <Link
        href="/dev"
        style={{
          color: "var(--ink)",
          textDecoration: "underline",
          textDecorationColor: "var(--line)",
          textUnderlineOffset: 3,
        }}
      >
        Open dev panel →
      </Link>
    </div>
  );
}
