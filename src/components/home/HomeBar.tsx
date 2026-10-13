import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { EVENTS, eventPath } from "@/app/hyrox/events";

/* The site bar: MIKIAN MUSSER wordmark, then the live campaigns as chips
 * in their own page colours (blue ROWTEMBER, orange LASD26, yellow HYROX),
 * all in one run from the left — nothing parked on the right (owner's
 * call, 2026-09-05; the dot in the wordmark went at the same time, so it
 * reads like the footer). Server component; the landing has no account UI
 * of its own (sign-in lives on /row100k).
 *
 * HYROX (owner, 2026-10-13: "add this as a link in the header ... color it
 * yellow ... make it close to the other two"): the chip goes to the first
 * event's board. The board is still in development — admin-only in
 * production (CLAUDE.md) — so until it goes live the chip is shown only to
 * who can open it; nobody is handed a link to a 404. When the page goes
 * live, drop the gate here with the one on the page. */
export async function HomeBar() {
  let hyrox = process.env.NODE_ENV !== "production";
  if (!hyrox) {
    try {
      const actor = await getEffectiveActor();
      hyrox = actor ? isAdmin(actor) : false;
    } catch {
      hyrox = false;
    }
  }
  const ev = EVENTS[0];
  return (
    <div className="bar">
      <a className="brand" href="/">
        Mikian Musser
      </a>
      <nav aria-label="Site">
        <a className="row" href="https://www.rowtember.com/">
          Rowtember
        </a>
        <a className="lasd" href="/lasd26">
          LASD26
        </a>
        {hyrox && ev ? (
          <a className="hyrox" href={eventPath(ev)}>
            Hyrox
          </a>
        ) : null}
      </nav>
    </div>
  );
}
