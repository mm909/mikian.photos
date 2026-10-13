import { EVENTS, eventPath } from "@/app/hyrox/events";

/* The site bar: MIKIAN MUSSER wordmark, then the live campaigns as chips
 * in their own page colours (blue ROWTEMBER, orange LASD26, yellow LAS
 * VEGAS HYROX '27), all in one run from the left — nothing parked on the
 * right (owner's call, 2026-09-05; the dot in the wordmark went at the
 * same time, so it reads like the footer). Server component, no session —
 * the landing has no account UI of its own.
 *
 * HYROX (owner, 2026-10-13: "add this as a link in the header ... color it
 * yellow ... make it close to the other two"; "that Hyrox link needs to be
 * Las Vegas Hyrox 27"): the chip is the first event — city, HYROX, the
 * year — and goes to its board. Public since the evening of 2026-10-13
 * ("no more gated behind admin"). */
export function HomeBar() {
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
        {ev ? (
          <a className="hyrox" href={eventPath(ev)}>
            {ev.city} Hyrox ’{String(ev.year).slice(-2)}
          </a>
        ) : null}
      </nav>
    </div>
  );
}
