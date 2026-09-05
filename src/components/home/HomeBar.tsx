/* The site bar: MIKIAN MUSSER wordmark, then the two live campaigns as
 * chips in their own page colours (blue ROWTEMBER, orange LASD26), all in
 * one run from the left — nothing parked on the right (owner's call,
 * 2026-09-05; the dot in the wordmark went at the same time, so it reads
 * like the footer). Server component, no session — the landing has no
 * account UI of its own (sign-in lives on /row100k). */
export function HomeBar() {
  return (
    <div className="bar">
      <a className="brand" href="/">
        Mikian Musser
      </a>
      <nav aria-label="Site">
        <a className="row" href="/row100k">
          Rowtember
        </a>
        <a className="lasd" href="/lasd26">
          LASD26
        </a>
      </nav>
    </div>
  );
}
