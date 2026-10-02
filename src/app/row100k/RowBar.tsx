import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, LOG_CLOSE_MS, isRow100kAdmin, nowMs } from "@/lib/row100k";
import { BarAccount } from "./BarAccount";
import { BarLog } from "./BarLog";
import { overflowItems, type NavKey } from "./barItems";
import { BarNav } from "./BarNav";
import { NavProgress } from "./NavProgress";
import { currentRace, raceAnnounced, raceOpenFor, raceOver } from "./raceday";
import { myRaffleRows } from "./raffleData";
import { RaffleBanner } from "./RaffleBanner";
import { openRaffle, raffleDismissCookie } from "./raffles";

/* The one bar every /row100k page wears: the ROWTEMBER wordmark (owner,
 * 2026-09-30: ROWTEMBER, never Mikian Musser — it was the Mikian.Musser
 * wordmark from 2026-09-05 to then, with ROWTEMBER as the first item of
 * the rail), then the nav rail with its sliding pill (the RACE DAY stamp
 * while a race is announced and open, BOARD — back on the rail 2026-09-25,
 * pointing at the total-meters rankings — STATS, FEED, PARTNERS in
 * September), then — for a joined rower — the LOG A ROW button, then the
 * OPT IN / rower chip on the right. Server component: it resolves the
 * session itself unless the page already did and hands the answer in.
 * `children` lands between the rail and the account chip for page tags.
 *
 * ONE LINE AT EVERY WIDTH (owner, 2026-10-01: "look at the header. We need
 * to condense it into one line"). The two-row phone bar of 2026-09-05 is
 * gone: .bar-lead, the rail, .bar-log and .bar-right are one flex row that
 * never wraps (theme.ts). What a phone cannot hold is shortened there (LOG,
 * the bare rower number) or moved: the words that are only sometimes on
 * the rail (barItems.ts overflowItems — RACE DAY, FEED, PARTNERS) leave it
 * under 900px and head the account menu instead, which is why this hands
 * BarAccount the list; a visitor, with no menu, gets MORE on the rail
 * (BarNav). */
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

  /* THE RAFFLE BANNER (owner, 2026-09-08): while a raffle is taking
   * entries, one strip under the bar on every page but the partners page,
   * where the raffle itself is. Dismissed is a cookie the × sets
   * (RaffleBanner), read here so a closed banner never renders again —
   * not even for a frame. The viewer's own ticket is one indexed count. */
  const raffle = active === "partners" ? null : openRaffle();
  let banner: React.ReactNode = null;
  if (raffle) {
    let dismissed = false;
    try {
      dismissed = cookies().get(raffleDismissCookie(raffle.slug))?.value === "1";
    } catch {
      /* cookies() outside a request scope — show it, same as not dismissed */
    }
    if (!dismissed) {
      const rows = await myRaffleRows(raffle, rower);
      banner = (
        <RaffleBanner
          slug={raffle.slug}
          title={raffle.title}
          valueUsd={raffle.valueUsd}
          when={raffle.when}
          entered={rows > 0}
          joined={rower !== null}
        />
      );
    }
  }

  /* RACE DAY on the rail rides the same switch as the race itself
   * (raceday.ts raceOpenFor): everyone in local dev, the owner alone in
   * production until he opens it — so the link is there for him today
   * and for the world the hour he flips it. AND only while a race is
   * announced (raceday.ts raceAnnounced; owner, 2026-09-25: "RACE DAY
   * should be hidden when no race day is announced"): from the day it
   * goes up until a day after its doors shut, so December, with no
   * race coming, has no stamp. Resolved here, where isAdmin already
   * is, so the server markup and the first client render agree — once,
   * for the rail and for the overflow the account menu carries.
   * AND ONCE A RACE HAS BEEN RUN its results are the page (owner,
   * 2026-10-01: "make the race day results page public"): the stamp stays
   * to lead there, until the next race is announced in its place. */
  const raceOpen = raceOpenFor(isAdmin) && (raceAnnounced(nowMs()) || raceOver(currentRace(), null, nowMs()));

  /* Not sticky still has to be positioned: the account panel and the MORE
   * panel hang off the bar, so it must stay their containing block. */
  return (
    <>
      <div className="bar" style={sticky ? undefined : { position: "relative" }}>
        {/* The line along the top that says a tap landed (NavProgress.tsx). */}
        <NavProgress />
        <span className="bar-lead">
          {/* The wordmark, to the front page. */}
          <Link className="bar-brand" href="/">
            Rowtember
          </Link>
        </span>
        <BarNav active={active} raceOpen={raceOpen} signedIn={isSignedIn} />
        {/* Joined rowers only (owner call, 2026-09-05): the account menu's
         * "Log a row", made obvious; it goes to the rower's own profile with
         * the form open (owner, 2026-09-25). Signed out, not yet joined, or
         * the log window closed: nothing — the join CTA is on the front page.
         * A direct child of the bar: it takes the auto margin that pushes it
         * and the chip to the far right. */}
        {rower !== null && logOpen && <BarLog rowerNumber={rower} />}
        <span className="bar-right">
          {children}
          {/* raceOver off the code clock alone (no finalAt, no settings
            * read): the bar must not cost every page a database round trip,
            * and the six-hour rule is late by at most an evening. */}
          <BarAccount
            signedIn={isSignedIn}
            rowerNumber={rower}
            admin={isAdmin}
            more={overflowItems(raceOpen).map((it) => ({ href: it.href, label: it.label }))}
            raceOver={raceOver(currentRace(), null, nowMs())}
          />
        </span>
      </div>
      {banner}
    </>
  );
}
