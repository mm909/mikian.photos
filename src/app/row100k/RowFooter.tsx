/* The one footer every Rowtember page wears. It signs off as ROWTEMBER
 * (owner, 2026-10-01, with the move to rowtember.com: "change the footer to
 * be ROWTEMBER, then @rowtember, then row@rowtember.com, and FOR YOURSELF
 * AND OTHERS stays") — until then it was the landing footer word for word,
 * signed Mikian Musser. Same classes as HomeFooter so the shared footer
 * rules apply; the Mikian Musser landing keeps its own words.
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
        <div className="big">ROWTEMBER</div>
        <p className="mono">
          <a href="https://instagram.com/rowtember" target="_blank" rel="noopener noreferrer">
            @rowtember
          </a>{" "}
          · <a href="mailto:row@rowtember.com">row@rowtember.com</a>
        </p>
        <p className="mono" style={{ marginTop: 18 }}>
          for yourself and others
        </p>
      </div>
    </footer>
  );
}
