/* The one footer every /row100k page wears — and it is the landing footer,
 * word for word (owner call, 2026-09-05: Rowtember signs off as Mikian
 * Musser, same as the front page). Same classes as HomeFooter so the shared
 * footer rules apply; keep the two in step if either changes. */
export function RowFooter() {
  return (
    <footer>
      <div className="wrap" style={{ padding: 0 }}>
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
