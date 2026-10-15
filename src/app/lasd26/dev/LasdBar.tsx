import type { TeamViewer } from "@/lib/lasd26/team";
import { lasdPath } from "@/lib/lasd26/paths";
import { LasdAccount } from "./LasdAccount";

/**
 * THE BAR on every page of the team site (owner, 2026-10-15: "reimagine
 * what this header looks like … crew call, live tracking, a receipts page
 * … a profile button, just like we have on the other sites").
 *
 * Three doors and the account button. CREW CALL is the landing (closed —
 * the van is full — but the page stays). LIVE is shown to everyone and
 * clickable only for the owner until the tracker goes public (it points at
 * /track/lasd26, which answers 404 to anyone else in production anyway).
 * EXPENSES is for the team: a visitor who is not on it sees the door and
 * lands on the sign-in / invite notice behind it. The account button holds
 * sign in, the member's name and role, and the owner's DEV group.
 *
 * Every door goes through lasdPath (lib/lasd26/paths.ts): while the site
 * is the dev copy at /lasd26/dev, the bar stays inside it. The DEV pill
 * beside the wordmark is how the owner tells this copy from the live page
 * (the tracker's bar wears the same); it goes when the site goes live.
 *
 * Layout is CSS order (theme.ts .bar): on a phone the wordmark and the
 * account button share the first row and the doors take a second; from
 * 720px it is one row with the doors in the middle.
 */

export type BarKey = "crew-call" | "live" | "expenses" | "team" | "pay" | "join" | "none";

export function LasdBar({ viewer, active }: { viewer: TeamViewer; active: BarKey }) {
  const liveOpen = viewer.owner;
  return (
    <div className="bar">
      <a className="wm" href={lasdPath("")} aria-label="LASD26 — No Shortcuts TT, home (dev copy)">
        <span className="mono tag">LASD26</span>
        <span className="mono wm-t">NO SHORTCUTS TT</span>
        <span className="mono dev-pill" title="The dev copy of the team site — admin-only in production">
          DEV
        </span>
      </a>
      <nav className="bar-nav mono" aria-label="LASD26">
        <a href={lasdPath("")} aria-current={active === "crew-call" ? "page" : undefined}>
          Crew call <small>closed</small>
        </a>
        {liveOpen ? (
          <a href="/track/lasd26" aria-current={active === "live" ? "page" : undefined}>
            Live <small>race day</small>
          </a>
        ) : (
          <span className="off" aria-disabled="true" title="Live tracking opens on race day">
            Live <small>race day</small>
          </span>
        )}
        <a href={lasdPath("/expenses")} aria-current={active === "expenses" ? "page" : undefined}>
          Expenses {viewer.onTeam ? null : <small>team</small>}
        </a>
      </nav>
      <div className="bar-acct">
        <LasdAccount
          viewer={{
            signedIn: viewer.actor !== null,
            name: viewer.member?.name ?? viewer.actor?.name ?? "",
            role: viewer.member?.role ?? null,
            owner: viewer.owner,
            onTeam: viewer.onTeam,
          }}
        />
      </div>
    </div>
  );
}
