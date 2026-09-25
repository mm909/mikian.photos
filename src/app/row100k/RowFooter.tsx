/* The one footer every /row100k page wears — and it is the landing footer,
 * word for word (owner call, 2026-09-05: Rowtember signs off as Mikian
 * Musser, same as the front page). Same classes as HomeFooter so the shared
 * footer rules apply; keep the two in step if either changes.
 *
 * `front`: the footer takes the front page's measure (.wrap.front, 1040px)
 * instead of the 760px column every inside page keeps, so its rule and its
 * words line up with the content above (owner, 2026-09-25: "the footer on
 * the main page is a different width than the page — a little more
 * margin"). The root landing's HomeFooter already sits on its own 1040
 * measure (home/theme.ts .home .wrap), so nothing changes there. The wrap
 * keeps its own 20px gutter (the footer rule in theme.ts carries none), so
 * the wordmark starts on the measure, not 20px left of it. */
export function RowFooter({ front }: { front?: boolean }) {
  return (
    <footer>
      <div className={front ? "wrap front" : "wrap"}>
        <div className="big">MIKIAN MUSSER</div>
        <p className="mono">
          <a href="https://instagram.com/mikian_" target="_blank" rel="noopener noreferrer">
            @mikian_
          </a>{" "}
          · <a href="mailto:mikianmusser@gmail.com">mikianmusser@gmail.com</a>
        </p>
        <p className="mono" style={{ marginTop: 18 }}>
          for yourself and others
        </p>
      </div>
    </footer>
  );
}
