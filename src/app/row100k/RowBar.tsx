import Link from "next/link";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { BarAccount } from "./BarAccount";
import { BarNav, type NavKey } from "./BarNav";

/* The one bar every /row100k page wears: the Mikian.Musser wordmark (kept,
 * blue dot and all — owner call, 2026-09-05), then the nav rail with its
 * sliding pill (ROWTEMBER, THE BOARD, STATS, FEED, GALLERY, PARTNERS), then
 * the sign-in / rower chip on the right. Server component: it resolves the
 * session itself unless the page already did and hands the answer in.
 * `children` lands between the rail and the account chip for page tags.
 *
 * Layout: three direct flex children (.bar-lead, the rail, .bar-right) so
 * the <=560px media query in theme.ts can reflow them into a deliberate
 * two-row bar — wordmark + ROWTEMBER + account up top, the section links on
 * their own ruled row below (the rail dissolves to let ROWTEMBER cross over;
 * see BarNav). */
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
      <span className="bar-right">
        {children}
        <BarAccount signedIn={isSignedIn} rowerNumber={rower} admin={isAdmin} />
      </span>
    </div>
  );
}
