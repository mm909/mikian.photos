"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";

/* Top-right of the bar. Signed out: a SIGN IN chip. Joined: a "ROWER 023"
 * chip opening the account menu — profile link and sign out. Signed in but
 * not joined: join link + sign out. Admins also get a DEVELOPMENT block of
 * owner-only / in-progress surfaces above Sign out. */
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
          <div className="acct-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="acct-panel" role="menu">
            {rowerNumber !== null ? (
              <a className="acct-item" href={`/row100k/r/${rowerNumber}`}>
                My profile →
              </a>
            ) : (
              <a className="acct-item" href="/row100k#join" onClick={() => setOpen(false)}>
                Join the challenge →
              </a>
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
                <a className="acct-item" href="/row100k/signups">
                  Signups →
                </a>
                <a className="acct-item" href="/row100k/dev/stats">
                  Dev stats →
                </a>
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
