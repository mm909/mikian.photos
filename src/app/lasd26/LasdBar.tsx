import type { TeamViewer } from "@/lib/lasd26/team";
import { lasdPath } from "@/lib/lasd26/paths";
import { LasdAccount } from "./LasdAccount";

/**
 * THE BAR on every page of the team site (owner, 2026-10-15: "reimagine
 * what this header looks like … crew call, live tracking, a receipts page
 * … a profile button, just like we have on the other sites").
 *
 * Three doors and the account button. CREW CALL is the landing (closed —
 * the van is full — but the page stays). EXPENSES is for the team: a
 * visitor who is not on it sees the door and lands on the sign-in / invite
 * notice behind it. ROUTE is the course map, the race's own directions,
 * open to anyone (owner, 2026-10-16: "the route page can go live after
 * those changes" — nothing on it is private). The account button holds
 * sign in, the member's name and role, and the owner's groups.
 *
 * LIVE IS HIDDEN for now (owner, 2026-10-16: "Let's hide the 'live' page
 * for now. It's not ready."): no LIVE door for anyone. The tracker is
 * still reachable by the owner from the DEVELOPMENT group of the account
 * menu (LasdAccount.tsx); when it is ready it joins the bar as a fourth
 * door after ROUTE.
 *
 * The doors are the words and nothing after them (owner, 2026-10-16:
 * "Remove closed from the header") — no "closed" or "team".
 *
 * Every door goes through lasdPath (lib/lasd26/paths.ts), the one place
 * that knows where the site lives.
 *
 * Layout is CSS order (theme.ts .bar): on a phone the wordmark and the
 * account button share the first row and the doors take a second, from
 * the left; from 960px it is one row — wordmark, then the doors right after
 * it, the account button at the far right (owner, 2026-10-16: "left
 * justified like the other links on the mikianmusser home page").
 */

export type BarKey = "crew-call" | "expenses" | "route" | "team" | "pay" | "join" | "none";

export function LasdBar({ viewer, active }: { viewer: TeamViewer; active: BarKey }) {
  return (
    <div className="bar">
      <a className="wm" href={lasdPath("")} aria-label="LASD26 — No Shortcuts TT, home">
        <span className="mono tag">LASD26</span>
        <span className="mono wm-t">NO SHORTCUTS TT</span>
      </a>
      <nav className="bar-nav mono" aria-label="LASD26">
        <a href={lasdPath("")} aria-current={active === "crew-call" ? "page" : undefined}>
          Crew call
        </a>
        <a href={lasdPath("/expenses")} aria-current={active === "expenses" ? "page" : undefined}>
          Expenses
        </a>
        <a href={lasdPath("/route")} aria-current={active === "route" ? "page" : undefined}>
          Route
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
