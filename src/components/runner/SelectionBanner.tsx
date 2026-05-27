type Props = {
  count: number;
  total: number;
  onClear: () => void;
  onAdd: () => void;
};

export function SelectionBanner({ count, total, onClear, onAdd }: Props) {
  return (
    <div
      style={{
        position: "sticky",
        top: 60,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 22px",
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 8,
        margin: "16px 28px",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500 }}>{count}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>selected</span>
      <span style={{ color: "#6b6258" }}>·</span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          color: "var(--accent-l)",
          fontWeight: 500,
          fontSize: 20,
        }}
      >
        ${total}
      </span>
      <span style={{ flex: 1 }} />
      <button
        onClick={onClear}
        style={{
          background: "transparent",
          border: 0,
          color: "#bfb6a3",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Clear
      </button>
      <button className="btn btn--primary btn--sm" onClick={onAdd}>
        Add to cart →
      </button>
    </div>
  );
}
