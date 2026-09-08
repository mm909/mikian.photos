"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

/* The $20, once billed: the photo shop's PayPal button against the shirt's
 * own two-step route. Card as a guest works too — that is PayPal's button,
 * not ours. */
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

export function PayButton({ amount }: { amount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  if (paid) return <p className="sh-due mono">PAID — THANK YOU. SEE YOU AT PICK-UP.</p>;
  if (!PAYPAL_CLIENT_ID) return <p className="form-err">NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set on this build.</p>;

  return (
    <div className="sh-pay">
      <p className="sh-buy-note">${amount} · PAYPAL, OR ANY CARD AS A GUEST</p>
      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD", intent: "capture" }}>
        <PayPalButtons
          style={{ layout: "horizontal", color: "black", shape: "rect", label: "pay", height: 44 }}
          createOrder={async () => {
            const res = await fetch("/api/row100k/shirt/paypal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create" }),
            });
            const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
            if (!res.ok || !data.ok || !data.id) throw new Error(data.error ?? "Couldn't start the payment.");
            return data.id;
          }}
          onApprove={async (d) => {
            const res = await fetch("/api/row100k/shirt/paypal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "capture", orderId: d.orderID }),
            });
            const data = (await res.json()) as { ok?: boolean; error?: string };
            if (!res.ok || !data.ok) {
              setError(data.error ?? "Couldn't finish the payment.");
              return;
            }
            setPaid(true);
            router.refresh();
          }}
          onError={() => setError("PayPal could not take the payment — nothing was charged.")}
        />
      </PayPalScriptProvider>
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
