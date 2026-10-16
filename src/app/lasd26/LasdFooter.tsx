/**
 * THE FOOTER, the landing's, on every /lasd26 page (owner, 2026-10-16:
 * "update the footer with my full footer, like all the other pages"). The
 * race, the club we run with, the crew captains, and the line. One
 * component so no page carries a shorter copy of it.
 */
export function LasdFooter() {
  return (
    <footer>
      <div className="wrap" style={{ padding: 0 }}>
        <div className="big">NO SHORTCUTS TIME TRIAL — 7TH EDITION</div>
        <p className="mono">
          Race →{" "}
          <a href="https://instagram.com/noshortcutstt" target="_blank" rel="noopener noreferrer">
            @noshortcutstt
          </a>
          <br />
          with Just Friends LV →{" "}
          <a href="https://instagram.com/justfriends.lv" target="_blank" rel="noopener noreferrer">
            @justfriends.lv
          </a>
          <br />
          Crew questions →{" "}
          <a href="https://instagram.com/mikian_" target="_blank" rel="noopener noreferrer">
            @mikian_
          </a>{" "}
          ·{" "}
          <a href="https://instagram.com/jazz.mayy" target="_blank" rel="noopener noreferrer">
            @jazz.mayy
          </a>
        </p>
        <p className="mono" style={{ marginTop: 18 }}>
          for yourself and others
        </p>
      </div>
    </footer>
  );
}
