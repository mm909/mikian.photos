type Props = {
  bib: string;
  count: number;
  sampleTones: [string, string, string][];
  onYes: () => void;
  onNo: () => void;
};

export function BibSuggestBanner({ bib, count, sampleTones, onYes, onNo }: Props) {
  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 18,
        display: "flex",
        alignItems: "center",
        gap: 18,
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          flex: "0 0 auto",
          borderRadius: 6,
          background: "var(--paper)",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 28,
          letterSpacing: "-.02em",
          color: "var(--ink)",
        }}
      >
        #{bib}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <h3
          style={{
            margin: "0 0 4px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 22,
            color: "var(--ink)",
            letterSpacing: "-.01em",
          }}
        >
          Is this your bib?
        </h3>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          We think the bib in your photos is <strong>#{bib}</strong>. Add{" "}
          {count} more from that bib?
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn--primary btn--sm" onClick={onYes}>
            Yes — add {count}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onNo}>
            Not my bib
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          {sampleTones.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              {sampleTones.map((t, i) => (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 36,
                    borderRadius: 3,
                    background: `linear-gradient(180deg, ${t[1]}, ${t[2]})`,
                    border: "1px solid var(--line)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
