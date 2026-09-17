import Link from "next/link";
import { ergViewer, type ErgViewer } from "./gate";

/* THE BAR THE ERG PRODUCT WEARS (owner, 2026-09-17: keep Rowtember out of
 * it). Spare on purpose: the wordmark, the two places there are to be, and
 * who is signed in. No RowBar, no challenge nav, no rower number — this
 * product has nothing to do with a challenge and its bar should not
 * pretend otherwise.
 *
 * Server component. It resolves the account itself unless the page has
 * already done it and hands the answer in. */
export async function ErgBar({ active, viewer }: { active?: "monitors" | "sessions"; viewer?: ErgViewer }) {
  const v = viewer ?? (await ergViewer());

  return (
    <header className="eg-bar">
      <Link className="eg-mark" href="/erg">
        Erg telemetry
      </Link>

      <nav aria-label="Erg telemetry">
        <Link className={active === "monitors" ? "on" : undefined} href="/erg">
          Monitors
        </Link>
        <Link className={active === "sessions" ? "on" : undefined} href="/erg/sessions">
          Sessions
        </Link>
      </nav>

      <div className="eg-who">
        {v.signedIn ? (
          <span>
            {v.name || v.email}
            {v.isAdmin ? " · admin" : ""}
          </span>
        ) : (
          <a href={`/api/auth/signin?callbackUrl=${encodeURIComponent("/erg")}`}>Sign in</a>
        )}
      </div>
    </header>
  );
}
