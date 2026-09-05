"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";

/* Top-right of the bar. Signed out: a SIGN IN chip. Joined: a "ROWER 023"
 * chip opening the account menu — profile, then settings (owner call,
 * 2026-09-05: settings live behind this menu, not on the page), then sign
 * out. Signed in but not joined: join link + sign out. Admins also get a
 * DEVELOPMENT block of owner-only / in-progress surfaces above Sign out.
 * Items are next/link so the bar pill (BarNav) can carry across the hop. */
export function BarAccount({
  signedIn,
  rowerNumber,
  admin,
  defaultOpen,
}: {
  signedIn: boolean;
  rowerNumber: number | null;
  /** Row100k admin — shows the DEVELOPMENT links in the menu. */
  admin?: boolean;
  /** Dev preview only — render with the menu already open. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const close = () => setOpen(false);

  if (!signedIn) {
    return (
      <button
        type="button"
        className="acct-chip"
        onClick={() => signIn("google", { callbackUrl: "/row100k#join" })}
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="acct">
      <button
        type="button"
        className="acct-chip"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {rowerNumber !== null ? `Rower ${fmtRowerNumber(rowerNumber)} ▾` : "Account ▾"}
      </button>
      {open && (
        <>
          <div className="acct-overlay" onClick={close} aria-hidden="true" />
          <div className="acct-panel" role="menu">
            {rowerNumber !== null ? (
              <>
                {/* The one thing a rower comes back for — first in the menu
                 * (owner call, 2026-09-05). #log opens the in-place form on
                 * the front page. */}
                <Link className="acct-item" href="/row100k#log" onClick={close}>
                  Log a row →
                </Link>
                <Link className="acct-item" href={`/row100k/r/${rowerNumber}`} onClick={close}>
                  My profile →
                </Link>
                <Link className="acct-item" href="/row100k/settings" onClick={close}>
                  Settings →
                </Link>
              </>
            ) : (
              <Link className="acct-item" href="/row100k#join" onClick={close}>
                Join the challenge →
              </Link>
            )}
            {admin && (
              <>
                {/* The item above already draws the dashed divider (border-bottom);
                 * this eyebrow just heads the owner-only block. */}
                <div
                  className="mono"
                  aria-hidden="true"
                  style={{
                    fontSize: 10,
                    letterSpacing: ".15em",
                    textTransform: "uppercase",
                    color: "var(--gray)",
                    padding: "12px 2px 2px",
                  }}
                >
                  Development
                </div>
                <Link className="acct-item" href="/row100k/blackout" onClick={close}>
                  Blackout →
                </Link>
                <Link className="acct-item" href="/row100k/moderation" onClick={close}>
                  Moderation →
                </Link>
                {/* The gallery and the numbers page live here rather than on
                 * the bar for now (owner call, 2026-09-05): neither is ready
                 * to be a public tab. */}
                <Link className="acct-item" href="/row100k/gallery" onClick={close}>
                  Gallery →
                </Link>
                <Link className="acct-item" href="/row100k/analysis" onClick={close}>
                  The numbers →
                </Link>
                <Link className="acct-item" href="/row100k/signups" onClick={close}>
                  Signups →
                </Link>
                <Link className="acct-item" href="/row100k/dev/stats" onClick={close}>
                  Dev stats →
                </Link>
                <Link className="acct-item" href="/row100k/post" onClick={close}>
                  Post pack →
                </Link>
              </>
            )}
            <button
              type="button"
              className="acct-item danger"
              onClick={() => signOut({ callbackUrl: "/row100k" })}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
