/* The one footer every /row100k page wears (owner call, cycle 3): the
 * ROWTEMBER wordmark, the questions line, and the tagline — nothing else,
 * no page-specific back links. */
export function RowFooter() {
  return (
    <footer>
      <div className="wrap" style={{ padding: 0 }}>
        <div className="big">ROWTEMBER 2026</div>
        <p className="mono">
          Questions →{" "}
          <a href="https://instagram.com/mikian_" target="_blank" rel="noopener noreferrer">
            @mikian_
          </a>{" "}
          ·{" "}
          <a href="https://mikianmusser.com" target="_blank" rel="noopener noreferrer">
            mikianmusser.com
          </a>
        </p>
        <p className="mono" style={{ marginTop: 18 }}>
          for yourself and others
        </p>
      </div>
    </footer>
  );
}
