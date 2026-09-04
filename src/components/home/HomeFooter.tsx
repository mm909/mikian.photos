/* Footer in the /row100k pattern: wordmark, one contact line, the tagline. */
export function HomeFooter() {
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
