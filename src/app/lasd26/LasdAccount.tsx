"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * The account button, top right of every page of the team site (owner,
 * 2026-10-15: "a profile button, just like we have on the other sites").
 * Signed out it is SIGN IN, a square ink block (Google, back to the same
 * page). Signed in it is a square ink-bordered button — the member's
 * initial in a square lime block and a first name in mono caps (owner,
 * 2026-10-16: "I don't like the round buttons for the profile"; the
 * corners are in theme.ts .acct-btn) — that opens a small paper panel,
 * square too: who they are and their
 * role, the team pages, and the owner's groups — TEAM (invite link,
 * members) and DEVELOPMENT (the crew-call list, the route map and the
 * info sheet while they are "(dev)", the tracker's pages; owner,
 * 2026-10-15: "in a dev tab only that I can see"), which nobody else
 * sees. The tracker lives ONLY here while LIVE is hidden from the bar
 * (owner, 2026-10-16: "Let's hide the 'live' page for now. It's not
 * ready."). All plain links, through lasdPath (lib/lasd26/paths.ts), the
 * one place that knows where the site lives. Closes on an outside click or
 * Escape.
 */

export type AccountViewer = {
  signedIn: boolean;
  name: string;
  role: "runner" | "crew" | null;
  owner: boolean;
  onTeam: boolean;
};

export function LasdAccount({ viewer }: { viewer: AccountViewer }) {
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
      <button
        type="button"
        className="acct-btn in mono"
        onClick={() => signIn("google", { callbackUrl: typeof window === "undefined" ? lasdPath("") : window.location.href })}
      >
        Sign in
      </button>
    );
  }

  const name = viewer.name.trim();
  const initial = (name[0] ?? "?").toUpperCase();
  // The button carries the first name only; the panel has the whole thing.
  const first = name.split(/\s+/)[0] || "Account";
  const close = () => setOpen(false);

  return (
    <div className="acct" ref={ref}>
      <button
        type="button"
        className="acct-btn mono"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${name || "Account"}, account menu`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="acct-ini" aria-hidden>
          {initial}
        </span>
        <span className="acct-name">{first}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-who">
            <strong>{name || "Signed in"}</strong>
            <span className="mono">{viewer.owner ? "owner" : viewer.role ? viewer.role : "not on the team yet"}</span>
          </div>
          {viewer.onTeam && (
            <>
              <a className="acct-item" href={lasdPath("/expenses")} role="menuitem" onClick={close}>
                Expenses →
              </a>
              <a className="acct-item" href={lasdPath("/pay")} role="menuitem" onClick={close}>
                Settle up →
              </a>
            </>
          )}
          {viewer.owner && (
            <>
              <div className="acct-eyebrow mono" aria-hidden="true">
                Team
              </div>
              <a className="acct-item" href={lasdPath("/team")} role="menuitem" onClick={close}>
                Invite link &amp; members →
              </a>
              <div className="acct-eyebrow mono" aria-hidden="true">
                Development
              </div>
              <a className="acct-item" href={lasdPath("/the-list")} role="menuitem" onClick={close}>
                The list (crew call) →
              </a>
              {/* Not live yet (owner, 2026-10-16: "put it behind the dev
               * gate"): the route map and the info sheet live here only
               * until he says so — CLAUDE.md, new pages start in
               * development. Then they move up and lose "(dev)". */}
              <a className="acct-item" href={lasdPath("/route")} role="menuitem" onClick={close}>
                Route (dev) →
              </a>
              <a className="acct-item" href={lasdPath("/info")} role="menuitem" onClick={close}>
                Info sheet (dev) →
              </a>
              <a className="acct-item" href="/track/lasd26" role="menuitem" onClick={close}>
                Live tracker →
              </a>
              <a className="acct-item" href="/track/lasd26/join" role="menuitem" onClick={close}>
                Tracker: runner setup →
              </a>
              <a className="acct-item" href="/track" role="menuitem" onClick={close}>
                Tracker: crew &amp; van links →
              </a>
            </>
          )}
          <button type="button" className="acct-item danger" role="menuitem" onClick={() => signOut({ callbackUrl: lasdPath("") })}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
