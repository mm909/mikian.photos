/* The site bar: MIKIAN.MUSSER wordmark left, the two live campaigns right as
 * chips in their own page colours (blue ROWTEMBER, orange LASD26). Server
 * component, no session — the landing has no account UI of its own
 * (sign-in lives on /row100k). */
export function HomeBar() {
  return (
    <div className="bar">
      <a className="brand" href="/">
        Mikian<span className="dot">.</span>Musser
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
