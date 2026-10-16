"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

/* WHAT YOU OWE, by card, once (owner, 2026-10-16: "Allow users to pay w/
 * card (only card)"). The same PayPal connection the Rowtember shirt uses
 * (src/app/row100k/shirt/pay/PayButton.tsx) against this team's own
 * two-step route, but only the black "Debit or Credit Card" button —
 * fundingSource="card" asks the SDK for that one and nothing else, no
 * PayPal wallet, no Pay Later. The amount shown is the server's number
 * (the share less what was fronted); the route works it out again from
 * the live cost sheet and never trusts the page. */
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

export function PayShare({ amount }: { amount: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<string | null>(null);

  if (paid) {
    return (
      <div className="pay-paid mono">
        <div className="big">Paid — thank you.</div>
        {paid} · just now · via card
      </div>
    );
  }
  if (!PAYPAL_CLIENT_ID) return <p className="pay-err mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set on this build — the card button cannot load.</p>;

  return (
    <div className="pay-box">
      <p className="pay-note mono">
        <b>Pay {amount} by card</b>
      </p>
      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD", intent: "capture" }}>
        <PayPalButtons
          fundingSource="card"
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
            setError(msg && msg.length < 160 ? msg : "The card could not be charged — nothing was taken.");
          }}
        />
      </PayPalScriptProvider>
      {error && <p className="pay-err mono">{error}</p>}
    </div>
  );
}
