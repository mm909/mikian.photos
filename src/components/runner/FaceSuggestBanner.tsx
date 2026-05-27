type Props = {
  bib: string;
  count: number;
  sampleTones: [string, string, string][];
  onYes: () => void;
  onNo: () => void;
};

export function FaceSuggestBanner({ bib, count, sampleTones, onYes, onNo }: Props) {
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
          display: "flex",
          gap: 8,
          flex: "0 0 auto",
        }}
      >
        {sampleTones.map((t, i) => (
          <div
            key={i}
            style={{
              width: 56,
              height: 72,
              borderRadius: 4,
              border: "1px solid var(--line)",
              background: `linear-gradient(180deg, ${t[1]}, ${t[2]})`,
              boxShadow: "var(--shadow)",
            }}
          />
        ))}
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
          Is this you?
        </h3>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Bib #{bib}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn--primary btn--sm" onClick={onYes}>
            Yes — add {count}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onNo}>
            Not me
          </button>
        </div>
      </div>
    </div>
  );
}
