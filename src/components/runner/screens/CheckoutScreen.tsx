"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Headline } from "../Headline";
import { useRunner } from "../RunnerProvider";
import { prices } from "@/lib/data";

const PROC_STEPS = ["Processing payment…", "Confirming with Stripe…", "Preparing your photos…"];

export function CheckoutScreen() {
  const router = useRouter();
  const { cart, resultPhotos, finalizeOrder, addBundle } = useRunner();

  // Bundle-only MVP: if the user lands here without a cart, drop the bundle in automatically.
  useEffect(() => {
    if (cart.items.length === 0) addBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = cart.items.reduce((s, i) => s + i.price, 0);
  const stripeFee = +(subtotal * prices.stripeRate + prices.stripeFlat).toFixed(2);
  const total = +(subtotal + stripeFee).toFixed(2);

  const [email, setEmail] = useState("");
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [procStep, setProcStep] = useState(0);

  function fmtCard(v: string) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }
  function fmtExp(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  const valid =
    email.includes("@") &&
    num.replace(/\s/g, "").length >= 15 &&
    exp.length === 5 &&
    cvc.length >= 3;

  function useTest() {
    setEmail("runner@example.com");
    setNum("4242 4242 4242 4242");
    setExp("12/29");
    setCvc("123");
    setName("Sam Runner");
  }

  function pay() {
    setProcessing(true);
    setProcStep(0);
    let i = 0;
    const tk = window.setInterval(() => {
      i++;
      if (i >= PROC_STEPS.length) {
        window.clearInterval(tk);
        window.setTimeout(() => {
          const o = finalizeOrder(total);
          router.push(`/success/${o.id}`);
        }, 300);
      } else {
        setProcStep(i);
      }
    }, 700);
  }

  if (cart.items.length === 0 && !processing) {
    // Cart is being auto-populated by the useEffect above; render a brief blank state.
    return <main className="screen" style={{ padding: "96px 32px" }} />;
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  fontSize: 22,
                  color: "var(--ink)",
                }}
              >
                Contact
              </h2>
              <button onClick={useTest} className="btn btn--ghost btn--sm">
                Use test card
              </button>
            </div>
            <label className="field-label">Email</label>
            <input
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <h2
              style={{
                margin: "32px 0 14px",
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 22,
                color: "var(--ink)",
              }}
            >
              Payment
            </h2>
            <label className="field-label">Card number</label>
            <input
              className="input"
              placeholder="1234 1234 1234 1234"
              value={num}
              onChange={(e) => setNum(fmtCard(e.target.value))}
              inputMode="numeric"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
              <div>
                <label className="field-label">Expiry</label>
                <input
                  className="input"
                  placeholder="MM/YY"
                  value={exp}
                  onChange={(e) => setExp(fmtExp(e.target.value))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="field-label">CVC</label>
                <input
                  className="input"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="field-label">Name on card</label>
              <input
                className="input"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
              Payments secured by Stripe.
            </div>

            <div style={{ marginTop: 28 }}>
              <button
                className="btn btn--primary btn--block btn--lg"
                disabled={!valid}
                onClick={pay}
              >
                Pay ${total.toFixed(2)}
              </button>
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
                      ? `Photo · Mile ${it.mile}`
                      : `All photos bundle (${resultPhotos.length || 36})`}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${it.price.toFixed(2)}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, fontSize: 13, color: "var(--ink)" }}>
                <SumRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
                <SumRow label="Stripe fee (est.)" value={`$${stripeFee.toFixed(2)}`} muted />
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
              {PROC_STEPS[procStep]}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SumRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", color: muted ? "var(--muted)" : "var(--ink)" }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
