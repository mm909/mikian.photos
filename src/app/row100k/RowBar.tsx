import Link from "next/link";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, LOG_CLOSE_MS, isRow100kAdmin, nowMs } from "@/lib/row100k";
import { BarAccount } from "./BarAccount";
import { BarLog } from "./BarLog";
import { BarNav, type NavKey } from "./BarNav";

/* The one bar every /row100k page wears: the Mikian.Musser wordmark (kept,
 * blue dot and all — owner call, 2026-09-05), then the nav rail with its
 * sliding pill (ROWTEMBER, THE BOARD, STATS, FEED, GALLERY, PARTNERS), then
 * — for a joined rower — the LOG A ROW button, then the sign-in / rower
 * chip on the right. Server component: it resolves the session itself
 * unless the page already did and hands the answer in.
 * `children` lands between the rail and the account chip for page tags.
 *
 * Layout: direct flex children (.bar-lead, the rail, .bar-log, .bar-right)
 * so the <=560px media query in theme.ts can reflow them into a deliberate
 * two-row bar — wordmark + ROWTEMBER + account up top, the section links
 * with LOG A ROW at their far right on their own ruled row below (the rail
 * dissolves to let ROWTEMBER cross over; see BarNav). */
export async function RowBar({
  active,
  sticky = true,
  signedIn,
  rowerNumber,
  admin,
  children,
}: {
  active?: NavKey;
  /* The gallery opts out so its full-bleed grid owns the scroll. */
  sticky?: boolean;
  /* A page that has already resolved the actor passes these three and the
   * bar skips its own session + RowParticipant lookup. Absent: self-resolve. */
  signedIn?: boolean;
  rowerNumber?: number | null;
  admin?: boolean;
  children?: React.ReactNode;
}) {
  let isSignedIn = signedIn ?? false;
  let rower: number | null = rowerNumber ?? null;
  let isAdmin = admin ?? false;
  if (signedIn === undefined) {
    try {
      const actor = await getEffectiveActor();
      if (actor) {
        isSignedIn = true;
        isAdmin = isRow100kAdmin(actor.email, actor.roles);
        const me = await db.rowParticipant.findUnique({
          where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
          select: { rowerNumber: true },
        });
        rower = me?.rowerNumber ?? null;
      }
    } catch {
      /* cosmetic — a failed lookup just renders the signed-out chip */
    }
  }

  /* Once late logging closes (LOG_CLOSE_MS, the same cut the front page
   * uses) LogInPlace ignores #log and the event, so the button would be a
   * dead control on every page for all of October: it goes with the window. */
  const logOpen = nowMs() < LOG_CLOSE_MS;

  /* Not sticky still has to be positioned: on a phone the pill inside the
   * dissolved rail is placed against the bar (BarNav measures from the
   * pill's offsetParent), so the bar must stay its containing block. */
  return (
    <div className="bar" style={sticky ? undefined : { position: "relative" }}>
      <span className="bar-lead">
        {/* Mikian Musser, hosting Rowtember — the landing wordmark leads. */}
        <Link className="bar-brand" href="/">
          Mikian<span className="dot">.</span>Musser
        </Link>
      </span>
      <BarNav active={active} />
      {/* Joined rowers only (owner call, 2026-09-05): the account menu's
       * "Log a row", made obvious. Signed out, not yet joined, or the log
       * window closed: nothing — the join CTA is on the front page. A direct
       * child of the bar so the phone media query can drop it onto the link
       * row under the chip. */}
      {rower !== null && logOpen && <BarLog />}
      <span className="bar-right">
        {children}
        <BarAccount signedIn={isSignedIn} rowerNumber={rower} admin={isAdmin} />
      </span>
    </div>
  );
}
