"use client";

import { useRouter } from "next/navigation";
import { Headline } from "../Headline";
import { useRunner } from "../RunnerProvider";
import { currentEvent, photoBg, prices } from "@/lib/data";

export function CartScreen() {
  const router = useRouter();
  const { cart, resultPhotos, cartCappedToBundle, removeFromCart, upgradeToBundle, beginOrder } = useRunner();

  const items = cart.items;
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const stripeFee = +(subtotal * prices.stripeRate + prices.stripeFlat).toFixed(2);
  const total = +(subtotal + stripeFee).toFixed(2);
  const hasBundle = items.some((i) => i.kind === "bundle");
  const hasSingles = items.some((i) => i.kind === "single");
  const upgradePrice = hasSingles && !hasBundle ? +(prices.bundle - subtotal).toFixed(2) : 0;

  if (items.length === 0) {
    return (
      <main className="screen" style={{ padding: "96px 32px", textAlign: "center" }}>
        <Headline
          as="h1"
          text="Your cart is empty."
          accent="cart"
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 44,
            letterSpacing: "-.015em",
          }}
        />
        <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 15 }}>
          Find your race photos to get started.
        </div>
        <button
          className="btn btn--primary btn--lg"
          onClick={() => router.push(resultPhotos.length ? "/results" : "/")}
          style={{ marginTop: 28 }}
        >
          Browse your photos →
        </button>
      </main>
    );
  }

  return (
    <main className="screen" style={{ padding: "48px 32px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Headline
          as="h1"
          text="Your cart"
          accent="cart"
          style={{
            margin: "0 0 32px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 44,
            letterSpacing: "-.015em",
          }}
        />

        <div
          className="cart-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 40 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cartCappedToBundle && hasBundle && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--green-bg)",
                  border: "1px solid #c9ddc3",
                  borderRadius: 6,
                  color: "var(--green)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                }}
              >
                Capped at bundle — <em style={{ fontStyle: "italic", fontWeight: 300 }}>you&rsquo;re getting all photos.</em>
              </div>
            )}

            {items.map((it) => (
              <div
                key={it.uid}
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr auto auto",
                  gap: 16,
                  alignItems: "center",
                  padding: "16px 20px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
              >
                {it.kind === "single" ? (
                  <div
                    style={{
                      width: 64,
                      height: 88,
                      borderRadius: 4,
                      overflow: "hidden",
                      background: it.previewUrl
                        ? "var(--cream)"
                        : photoBg({ tones: it.tones, spot: it.spot }),
                    }}
                  >
                    {it.previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.previewUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 88,
                      borderRadius: 4,
                      background: "var(--cream)",
                      border: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-serif)",
                      color: "var(--accent)",
                      fontSize: 22,
                      fontStyle: "italic",
                      fontWeight: 300,
                    }}
                  >
                    all
                  </div>
                )}
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontWeight: 500,
                      fontSize: 18,
                      color: "var(--ink)",
                    }}
                  >
                    {it.kind === "single" ? "Photo" : "All photos bundle"}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      marginTop: 4,
                    }}
                  >
                    {it.kind === "single"
                      ? `${it.time} · ${currentEvent.name.join(" ")}`
                      : `${resultPhotos.length || 36} photos · Unlimited downloads`}
                  </div>
                </div>
                <div className="price" style={{ fontSize: 18 }}>
                  ${it.price.toFixed(2)}
                </div>
                <button
                  onClick={() => removeFromCart(it.uid)}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--muted)",
                    fontSize: 13,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textDecorationColor: "var(--line)",
                    textUnderlineOffset: 3,
                  }}
                >
                  Remove.
                </button>
              </div>
            ))}

            {upgradePrice > 0 && (
              <div
                style={{
                  padding: "18px 22px",
                  background: "var(--cream)",
                  border: "1px dashed var(--warm)",
                  borderRadius: 8,
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <Headline
                    as="div"
                    text={`Add all your photos for $${upgradePrice} more.`}
                    accent="all your photos"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontWeight: 500,
                      fontSize: 19,
                      color: "var(--ink)",
                      letterSpacing: "-.005em",
                    }}
                  />
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Unlimited downloads of every photo in your results.
                  </div>
                </div>
                <button className="btn btn--primary btn--sm" onClick={upgradeToBundle}>
                  Upgrade
                </button>
              </div>
            )}

            <button
              onClick={() => router.push(resultPhotos.length ? "/results" : "/")}
              style={{
                alignSelf: "flex-start",
                background: "transparent",
                border: 0,
                color: "var(--muted)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                cursor: "pointer",
                padding: "8px 0",
                marginTop: 8,
              }}
            >
              ← Back to photos
            </button>
          </div>

          <aside style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
            <div
              style={{
                background: "var(--cream)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 14,
                }}
              >
                Order summary
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                <Row label={`Photos (${items.length})`} value={`$${subtotal.toFixed(2)}`} />
                <Row label="Processing fee (est.)" value={`$${stripeFee.toFixed(2)}`} muted />
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--line)",
                  marginTop: 14,
                  paddingTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontWeight: 500,
                    fontSize: 22,
                    color: "var(--ink)",
                  }}
                >
                  Total
                </span>
                <span className="price" style={{ fontSize: 28 }}>
                  ${total.toFixed(2)}
                </span>
              </div>

              <button
                className="btn btn--primary btn--block btn--lg"
                onClick={() => {
                  beginOrder(total);
                  router.push("/checkout");
                }}
                style={{ marginTop: 18 }}
              >
                Proceed to checkout
              </button>
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                Secure checkout via Stripe
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        color: muted ? "var(--muted)" : "var(--ink)",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
