"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { teamPath, tspPath } from "@/lib/tsp/paths";

/**
 * The account button of the TSP team sites — LasdAccount's square button
 * and paper panel with this site's links: the team's pages for a member,
 * the TEAM group (invite link, members, settings) for a captain, the hub
 * for everyone. Closes on an outside click or Escape.
 */

export type TspAccountViewer = {
  signedIn: boolean;
  name: string;
  role: "runner" | "crew" | null;
  captain: boolean;
  onTeam: boolean;
  slug: string | null;
  teamName: string | null;
};

export function TspAccount({ viewer }: { viewer: TspAccountViewer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!viewer.signedIn) {
    return (
      // Relative callback: next-auth keeps a relative URL on the host that served the page.
      <button type="button" className="acct-btn in mono" onClick={() => signIn("google", { callbackUrl: typeof window === "undefined" ? tspPath("") : window.location.pathname + window.location.search })}>
        Sign in
      </button>
    );
  }

  const name = viewer.name.trim();
  const first = name.split(/\s+/)[0] || "Account";
  const close = () => setOpen(false);
  const slug = viewer.slug;
  const roleLine = !slug ? "tsp · la → las vegas" : viewer.captain ? `captain${viewer.role ? ` · ${viewer.role}` : ""}` : viewer.role ?? "not on the team yet";

  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn mono" aria-expanded={open} aria-haspopup="menu" aria-label={`${name || "Account"}, account menu`} onClick={() => setOpen((v) => !v)}>
        <span className="acct-ini" aria-hidden>
          {(name[0] ?? "?").toUpperCase()}
        </span>
        <span className="acct-name">{first}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-who">
            <strong>{name || "Signed in"}</strong>
            <span className="mono">{roleLine}</span>
          </div>
          {slug && viewer.onTeam && (
            <>
              <a className="acct-item" href={teamPath(slug, "/legs")} role="menuitem" onClick={close}>
                My legs →
              </a>
              <a className="acct-item" href={teamPath(slug, "/expenses")} role="menuitem" onClick={close}>
                Expenses →
              </a>
              <a className="acct-item" href={teamPath(slug, "/info")} role="menuitem" onClick={close}>
                Info sheet →
              </a>
              <a className="acct-item" href={teamPath(slug, "/team")} role="menuitem" onClick={close}>
                {viewer.captain ? "Invite link, members & settings →" : "The team →"}
              </a>
            </>
          )}
          <a className="acct-item" href={tspPath("")} role="menuitem" onClick={close}>
            All my teams →
          </a>
          <button type="button" className="acct-item danger" role="menuitem" onClick={() => signOut({ callbackUrl: tspPath("") })}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
