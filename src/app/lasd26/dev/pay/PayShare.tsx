"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

/* YOUR SHARE, once: the same PayPal button the Rowtember shirt uses
 * (src/app/row100k/shirt/pay/PayButton.tsx), against this team's own
 * two-step route. "PayPal, or any card as a guest" — the card path is
 * PayPal's button, not ours. The amount shown is the server's number; the
 * route works it out again from the live cost sheet and never trusts the
 * page. */
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

export function PayShare({ amount }: { amount: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<string | null>(null);

  if (paid) {
    return (
      <div className="pay-paid mono">
        <div className="big">Paid — thank you.</div>
        {paid} · just now · via PayPal
      </div>
    );
  }
  if (!PAYPAL_CLIENT_ID) return <p className="pay-err mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set on this build — the pay button cannot load.</p>;

  return (
    <div className="pay-box">
      <p className="pay-note mono">
        <b>{amount}</b> · PayPal, or any card as a guest
      </p>
      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD", intent: "capture" }}>
        <PayPalButtons
          style={{ layout: "horizontal", color: "black", shape: "rect", label: "pay", height: 44 }}
          createOrder={async () => {
            setError(null);
            const res = await fetch("/api/lasd26/pay/paypal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create" }),
            });
            const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
            if (!res.ok || !data.ok || !data.id) throw new Error(data.error ?? "Couldn't start the payment.");
            return data.id;
          }}
          onApprove={async (d) => {
            const res = await fetch("/api/lasd26/pay/paypal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "capture", orderId: d.orderID }),
            });
            const data = (await res.json()) as { ok?: boolean; error?: string; paid?: string };
            if (!res.ok || !data.ok) {
              setError(data.error ?? "Couldn't finish the payment.");
              return;
            }
            setPaid(data.paid ?? amount);
            router.refresh();
          }}
          onError={(err) => {
            // A guard the route answered on create ("Already paid.", "opens
            // after the race") is thrown from createOrder and lands here as
            // an Error with that message; show it. Anything else — PayPal's
            // own failures, long JSON — gets the plain line.
            const msg = err instanceof Error && err.message ? err.message : "";
            setError(msg && msg.length < 160 ? msg : "PayPal could not take the payment — nothing was charged.");
          }}
        />
      </PayPalScriptProvider>
      {error && <p className="pay-err mono">{error}</p>}
    </div>
  );
}
