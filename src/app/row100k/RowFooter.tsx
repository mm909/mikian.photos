/* The one footer every /row100k page wears (owner call, cycle 2):
 * ROWTEMBER 2026 and the questions line. `children` adds page-specific
 * lines (a back link, etc.) under it. */
export function RowFooter({ children }: { children?: React.ReactNode }) {
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
        {children}
      </div>
    </footer>
  );
}
