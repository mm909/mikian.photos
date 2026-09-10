"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";

/* Top-right of the bar. Signed out: a SIGN IN chip. Joined: a "ROWER 023"
 * chip opening the account menu — profile, then settings (owner call,
 * 2026-09-05: settings live behind this menu, not on the page), then sign
 * out. Signed in but not joined: join link + sign out. Admins also get
 * three eyebrowed groups above Sign out — UTILITIES, ADMINISTRATION,
 * DEVELOPMENT (owner call, 2026-09-08). Items are next/link so the bar
 * pill (BarNav) can carry across the hop. */

/* A group heading inside the panel: mono, grey, letterspaced. */
function Eyebrow({ children }: { children: string }) {
  return (
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
      {children}
    </div>
  );
}

export function BarAccount({
  signedIn,
  rowerNumber,
  admin,
  defaultOpen,
}: {
  signedIn: boolean;
  rowerNumber: number | null;
  /** Row100k admin — shows the UTILITIES / ADMINISTRATION / DEVELOPMENT groups. */
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
                <Link className="acct-item" href={`/row100k/r/${rowerNumber}`} onClick={close}>
                  My profile →
                </Link>
                {/* The rower's own poster (/row100k/r/N/poster) is admin-only
                 * for now — owner, 2026-09-10: "give me the poster in the dev
                 * menu, not live". The MY POSTER item comes back here when
                 * he opens it to rowers. */}
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
                {/* Three eyebrowed groups (owner call, 2026-09-08): the
                 * things an admin uses, the things an admin runs, and the
                 * surfaces still in the shop. The item above each eyebrow
                 * already draws the dashed divider (border-bottom). */}
                <Eyebrow>Utilities</Eyebrow>
                <Link className="acct-item" href="/row100k/post" onClick={close}>
                  Post pack →
                </Link>
                <Link className="acct-item" href="/row100k/dev/plan" onClick={close}>
                  The plan →
                </Link>

                <Eyebrow>Administration</Eyebrow>
                <Link className="acct-item" href="/row100k/blackout" onClick={close}>
                  Blackout →
                </Link>
                <Link className="acct-item" href="/row100k/raffles" onClick={close}>
                  Raffles →
                </Link>
                {/* Signups + moderation, one table (rowers/RowersTable.tsx). */}
                <Link className="acct-item" href="/row100k/signups" onClick={close}>
                  Rowers →
                </Link>
                <Link className="acct-item" href="/row100k/shop-admin" onClick={close}>
                  Shop administration →
                </Link>

                <Eyebrow>Development</Eyebrow>
                <Link className="acct-item" href="/row100k/dev/stats" onClick={close}>
                  Dev stats →
                </Link>
                {/* The poster studio (owner, 2026-09-10: "in the dev menu, not
                 * live") — Rowtember and any rower, print and Instagram
                 * formats, PNG / PDF / share. Admin-only page. */}
                <Link className="acct-item" href="/row100k/posters" onClick={close}>
                  Posters (dev) →
                </Link>
                {/* The numbers and the gallery live here rather than on the
                 * bar for now (owner call, 2026-09-05): neither is ready to
                 * be a public tab. */}
                <Link className="acct-item" href="/row100k/analysis" onClick={close}>
                  The numbers →
                </Link>
                <Link className="acct-item" href="/row100k/dev/shirts" onClick={close}>
                  The shirt (dev) →
                </Link>
                <Link className="acct-item" href="/row100k/gallery" onClick={close}>
                  Gallery →
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
