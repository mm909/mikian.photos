"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "DTK" },
  { href: "/hyrox", label: "HYROX" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-4 h-11 bg-dark border-b border-white/8 shrink-0">
      <Link
        href="/"
        className="text-cream font-mono text-sm font-semibold tracking-tight hover:text-white transition-colors"
      >
        mikian
      </Link>

      <div className="flex items-center gap-1">
        {TABS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`text-xs font-mono font-medium tracking-wide px-3 py-1.5 rounded transition-colors ${
                active
                  ? "text-cream bg-white/8"
                  : "text-muted hover:text-cream/70 hover:bg-white/4"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
