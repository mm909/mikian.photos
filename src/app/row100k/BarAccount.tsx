"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";

/* Top-right of the bar. Signed out: a SIGN IN chip. Joined: a "ROWER 023"
 * chip opening the account menu — profile, poster, plan, then settings
 * (owner call, 2026-09-05: settings live behind this menu, not on the
 * page), then sign out. Signed in but not joined: join link + sign out.
 * Admins also get eyebrowed groups above Sign out — ADMINISTRATION, RACE
 * DAY, DEVELOPMENT (owner call, 2026-09-08). Items are next/link so the bar
 * pill (BarNav) can carry across the hop.
 *
 * owner, 2026-09-16: the menu was cut down with the pages. Gone: Post pack
 * (the studio took it), Raffles, Shop administration, The shirt, Gallery
 * (retired), Dev stats (now Shareables), Race day (public, on the rail) and
 * the (dev) tags. New: My poster for a rower, Posters / Shareables / Look
 * under UTILITIES, Race waves under ADMINISTRATION.
 *
 * owner, 2026-09-24: "there is no reason for a Posters utility link now —
 * remove it"; Shareables is called Share stats and sits under DEVELOPMENT;
 * the Look page is retired (its route is gone). My poster stays — it was
 * briefly a Shareables page and went back (owner, 2026-09-25: "did not
 * land — revert to just the poster").
 *
 * owner, 2026-09-25: the plan is live (/row100k/plan) and sits in the rower
 * group as Plan →; UTILITIES, which held only the plan, is gone. The rower
 * items lost their "My": Profile, Poster, Plan, Settings. */

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
  /** Row100k admin — shows the ADMINISTRATION / RACE DAY / DEVELOPMENT groups. */
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
                  Profile →
                </Link>
                {/* POSTER, back (owner, 2026-09-25: "The shareables page
                 * did not land — revert to just the poster"): the studio
                 * with this rower as the subject (posters/page.tsx ?r=N). */}
                <Link className="acct-item" href={`/row100k/posters?r=${rowerNumber}`} onClick={close}>
                  Poster →
                </Link>
                {/* THE PLAN, live (owner, 2026-09-25): plan/page.tsx. */}
                <Link className="acct-item" href="/row100k/plan" onClick={close}>
                  Plan →
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
                {/* Eyebrowed groups (owner call, 2026-09-08): the things an
                 * admin runs, race day, and the surfaces still in the shop.
                 * UTILITIES went with the plan (live, 2026-09-25). The item
                 * above each eyebrow already draws the dashed divider
                 * (border-bottom). */}
                <Eyebrow>Administration</Eyebrow>
                <Link className="acct-item" href="/row100k/blackout" onClick={close}>
                  Lights out →
                </Link>
                {/* Signups + moderation, one table (rowers/RowersTable.tsx);
                 * the CSV downloads live there too. */}
                <Link className="acct-item" href="/row100k/signups" onClick={close}>
                  Rowers →
                </Link>

                {/* RACE DAY, ITS OWN GROUP (owner, 2026-09-21: "I need all my
                 * race day menus under a special race day section in the
                 * menu, and let us keep these items clean"). In the order of
                 * the night: the page people sign up on, the console that
                 * puts them in waves and times them, the ergs, the live
                 * board while they are racing, the results, and the wall. */}
                <Eyebrow>Race day</Eyebrow>
                <Link className="acct-item" href="/row100k/raceday" onClick={close}>
                  Sign-up page →
                </Link>
                <Link className="acct-item" href="/row100k/raceday/print" onClick={close}>
                  Print flyers →
                </Link>
                <Link className="acct-item" href="/row100k/race-admin" onClick={close}>
                  Waves and timing →
                </Link>
                <Link className="acct-item" href="/erg" onClick={close}>
                  Ergs →
                </Link>
                <Link className="acct-item" href="/erg?board=1" onClick={close}>
                  Race board →
                </Link>
                <Link className="acct-item" href="/row100k/raceday/results" onClick={close}>
                  Results →
                </Link>
                <Link className="acct-item" href="/row100k/raceday/results?cast=1" onClick={close}>
                  The wall →
                </Link>

                <Eyebrow>Development</Eyebrow>
                {/* The results board on sample data (owner, 2026-09-11:
                 * "push the sample race day board with sample data so I can
                 * take a look at it"). Mid-race, finished, and the frame a
                 * TV in the gym would show. */}
                <Link className="acct-item" href="/row100k/dev/raceday-results" onClick={close}>
                  Race results (sample) →
                </Link>
                {/* The numbers live here rather than on the bar for now
                 * (owner call, 2026-09-05): not ready to be a public tab. */}
                <Link className="acct-item" href="/row100k/analysis" onClick={close}>
                  The numbers →
                </Link>
                {/* The share cards: on/off switches and the recent shares
                 * (owner, 2026-09-24: call it Share stats, under
                 * development). */}
                <Link className="acct-item" href="/row100k/shareables" onClick={close}>
                  Share stats →
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
