import { Headline } from "./Headline";

type Props = { price?: number; inCart: boolean; onClick: () => void };

export function BundleBar({ price = 30, inCart, onClick }: Props) {
  return (
    <div
      style={{
        background: "var(--cream)",
        color: "var(--ink)",
        padding: "32px 28px",
        display: "flex",
        justifyContent: "center",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          maxWidth: 760,
          width: "100%",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <Headline
            as="h3"
            text="Every photo from your race."
            accent="your race."
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: "-.01em",
              color: "var(--ink)",
            }}
          />
          <div
            style={{
              marginTop: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: "var(--muted)",
            }}
          >
            One price, full resolution, yours to keep.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              color: "var(--accent)",
              fontSize: 44,
              lineHeight: 1,
              fontVariantNumeric: "lining-nums tabular-nums",
            }}
          >
            ${price}
          </span>
          <button className="btn btn--primary btn--lg" onClick={onClick}>
            {inCart ? "Checkout →" : "Get them all →"}
          </button>
        </div>
      </div>
    </div>
  );
}
