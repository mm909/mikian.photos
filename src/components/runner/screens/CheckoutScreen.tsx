"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Headline } from "../Headline";
import { useRunner } from "../RunnerProvider";
import { currentEvent, prices } from "@/lib/data";

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

type Props = { unlocked: boolean };

export function CheckoutScreen({ unlocked }: Props) {
  const router = useRouter();
  const { cart, resultPhotos, finalizeOrder, addBundle } = useRunner();

  // When the buy flow is locked we don't auto-add the bundle — there's nothing to buy.
  // Show a friendly "Coming soon" panel and let the visitor go back to browsing.
  if (!unlocked) {
    return (
      <main className="screen" style={{ padding: "64px 24px 96px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 14,
            }}
          >
            Pre-launch · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <Headline
            as="h1"
            text="We're not open for sales yet."
            accent="not open"
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(32px, 4vw, 44px)",
              lineHeight: 1.05,
              letterSpacing: "-.015em",
              color: "var(--ink)",
            }}
          />
          <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 18 }}>
            Mikian.Photos is in preview — you can browse the experience, but checkout is paused
            until we go live for your race. Come back soon.
          </p>
          <button
            className="btn btn--primary btn--lg"
            onClick={() => router.push("/")}
            style={{ marginTop: 28 }}
          >
            ← Back to the race
          </button>
        </div>
      </main>
    );
  }

  // Bundle-only MVP: if the user lands here without a cart, drop the bundle in
  // automatically. Re-runs after RunnerProvider hydrates from localStorage so the
  // bundle isn't overwritten by an empty persisted cart.
  useEffect(() => {
    if (cart.items.length === 0) addBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items.length]);

  const subtotal = cart.items.reduce((s, i) => s + i.price, 0);
  const processingFee = +(subtotal * prices.stripeRate + prices.stripeFlat).toFixed(2);
  const total = +(subtotal + processingFee).toFixed(2);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cart.items.length === 0 && !processing) {
    return <main className="screen" style={{ padding: "96px 32px" }} />;
  }

  if (!PAYPAL_CLIENT_ID) {
    return (
      <main className="screen" style={{ padding: "96px 32px", textAlign: "center" }}>
        <Headline
          as="h1"
          text="Payment is not configured."
          accent="not configured."
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 36,
            letterSpacing: "-.015em",
          }}
        />
        <p style={{ color: "var(--muted)", marginTop: 14, fontSize: 14 }}>
          NEXT_PUBLIC_PAYPAL_CLIENT_ID missing from environment.
        </p>
      </main>
    );
  }

  return (
    <main className="screen" style={{ padding: "48px 32px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          Step 2 of 2 · Payment
        </div>
        <Headline
          as="h1"
          text="Almost there."
          accent="there."
          style={{
            margin: "0 0 32px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 48,
            letterSpacing: "-.018em",
          }}
        />

        <div
          className="checkout-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 40 }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 14px",
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 22,
                color: "var(--ink)",
              }}
            >
              Pay with PayPal or card
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0, marginBottom: 20 }}>
              You&rsquo;ll see PayPal&rsquo;s Pay button below. You can pay with your PayPal
              account or as a guest with any major card — no PayPal account needed.
            </p>

            <PayPalScriptProvider
              options={{
                clientId: PAYPAL_CLIENT_ID,
                currency: "USD",
                intent: "capture",
                components: "buttons",
              }}
            >
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect", color: "gold", label: "pay" }}
                disabled={processing}
                createOrder={async () => {
                  setError(null);
                  const res = await fetch("/api/paypal/create-order", { method: "POST" });
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j.error || "Could not create order");
                  }
                  const j = (await res.json()) as { id: string };
                  return j.id;
                }}
                onApprove={async (data) => {
                  setProcessing(true);
                  try {
                    const res = await fetch("/api/paypal/capture-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: data.orderID,
                        eventId: currentEvent.id,
                        kind: "bundle",
                      }),
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      throw new Error(j.error || "Capture failed");
                    }
                    const captured = (await res.json()) as {
                      orderUrl?: string;
                      orderNumberDisplay?: string;
                      amountUsd?: number;
                    };
                    // Persist the cart cleanup + local "order" snapshot so the
                    // success/order page can still read it if the server hop
                    // ever lags. The server response is the source of truth
                    // for the URL though — that carries the magic-link token.
                    const amount = captured.amountUsd ?? total;
                    finalizeOrder(amount);
                    if (captured.orderUrl) {
                      router.push(captured.orderUrl);
                    } else {
                      // Shouldn't happen — server always returns orderUrl on
                      // success — but if it does, send them to /runner so
                      // they at least land somewhere useful.
                      router.push("/runner");
                    }
                  } catch (e) {
                    setProcessing(false);
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                onError={(e) => {
                  setError(e instanceof Error ? e.message : "Payment error");
                }}
                onCancel={() => {
                  setError(null);
                }}
              />
            </PayPalScriptProvider>

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  border: "1px solid var(--accent)",
                  borderRadius: 6,
                  color: "var(--accent)",
                  fontSize: 13,
                  background: "rgba(200,64,26,.06)",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 18 }}>
              Payments processed by PayPal. We don&rsquo;t store your card details.
            </div>

            <button
              onClick={() => router.push("/cart")}
              style={{
                marginTop: 18,
                background: "transparent",
                border: 0,
                color: "var(--muted)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← Back to cart
            </button>
          </div>

          <aside>
            <div
              style={{
                background: "var(--cream)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 24,
                position: "sticky",
                top: 80,
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
                Your order
              </div>
              {cart.items.map((it) => (
                <div
                  key={it.uid}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 14,
                    color: "var(--ink)",
                  }}
                >
                  <span>
                    {it.kind === "single"
                      ? "Photo"
                      : `All photos bundle (${resultPhotos.length || 36})`}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${it.price.toFixed(2)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 12,
                  fontSize: 13,
                  color: "var(--ink)",
                }}
              >
                <SumRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
                <SumRow label="Processing fee (est.)" value={`$${processingFee.toFixed(2)}`} muted />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 14,
                  alignItems: "baseline",
                  borderTop: "1px solid var(--line)",
                  paddingTop: 14,
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
            </div>
          </aside>
        </div>
      </div>

      {processing && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth: 380, padding: 36, textAlign: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                margin: "0 auto 18px",
                border: "3px solid var(--line)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
              }}
            />
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)" }}>
              Preparing your photos…
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SumRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
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
