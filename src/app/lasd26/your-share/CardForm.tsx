"use client";

import { useEffect, useState } from "react";
import {
  PayPalButtons,
  PayPalCVVField,
  PayPalCardFieldsProvider,
  PayPalExpiryField,
  PayPalNumberField,
  usePayPalCardFields,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js";

/**
 * THE CARD FORM IN OUR OWN UI (owner, 2026-10-29: "The credit card form is
 * now missing the loading bar and is slow. Can we make the form on our own
 * ui then submit it through PayPal"). PayPal's CARD FIELDS: the number,
 * expiry and CVC inputs are PayPal-hosted iframes (the card never touches
 * our server, PCI stays theirs) sitting inside our own boxes, styled to the
 * page as far as PayPal lets us (type, colour, padding — the box itself is
 * ours); the ZIP is our own input, passed along as the billing postal
 * code; the PAY button is ours, so the page can answer the tap at once
 * (the status bar) and submit through PayPal behind it.
 *
 * The SDK must be loaded with components "card-fields" (Steps.tsx does).
 * If the account is not eligible for card fields (PayPal's ADVANCED CREDIT
 * AND DEBIT CARD PAYMENTS must be on for the business account — it was not
 * on 2026-10-29, so the live site shows the fallback until it is) the
 * provider renders nothing, so after a beat with no field on screen the
 * PayPal card button takes the place (the fallback): PayPal's own form
 * opens inline under it, the status bar runs from its PAY tap, and nothing
 * around it is ever dimmed or blocked (that left the owner stuck once).
 *
 * Mounted offscreen on the amount screen (Steps.tsx keeps one keyed
 * element across screens 2 and 3), so the iframes are loaded by the time
 * the pay screen opens.
 */

export type Phase = "idle" | "processing";

export type CardFormProps = {
  /** "$100", for the button; null while the amount is not valid. */
  amount: string | null;
  createOrder: () => Promise<string>;
  onApprove: (orderID: string) => Promise<void>;
  onError: (message: string) => void;
  phase: Phase;
  setPhase: (p: Phase) => void;
};

/* What PayPal lets us set inside its iframes. A system monospace, since
 * the page's web fonts do not reach into them. */
const FIELD_STYLE = {
  input: {
    "font-family": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "font-size": "18px",
    color: "#D0F858",
    "letter-spacing": ".04em",
    padding: "0 12px",
  },
  ":focus": { color: "#DFFF78" },
  ".invalid": { color: "#ff8a5c" },
};

function messageOf(err: unknown): string {
  const msg = err instanceof Error && err.message ? err.message : typeof err === "string" ? err : "";
  return msg && msg.length < 160 ? msg : "The card could not be charged — nothing was taken.";
}

/** Mounts only when the provider rendered its children, i.e. the fields are eligible. */
function Probe({ onLive }: { onLive: () => void }) {
  useEffect(() => {
    onLive();
  }, [onLive]);
  return null;
}

function PayButton({ amount, zip, phase, setPhase, onError }: { amount: string | null; zip: string; phase: Phase; setPhase: (p: Phase) => void; onError: (m: string) => void }) {
  const { cardFieldsForm } = usePayPalCardFields();
  const pay = async () => {
    if (!cardFieldsForm) return;
    setPhase("processing");
    try {
      const state = await cardFieldsForm.getState();
      if (!state.isFormValid) {
        setPhase("idle");
        onError("Check the card number, the expiry and the CVC.");
        return;
      }
      // The SDK takes the billing address on submit; the wrapper's type does not know it.
      await (cardFieldsForm.submit as (o?: unknown) => Promise<void>)(zip.trim() ? { billingAddress: { postalCode: zip.trim(), countryCode: "US" } } : undefined);
      // Approval or failure comes back through the provider's onApprove / onError.
    } catch (err) {
      setPhase("idle");
      onError(messageOf(err));
    }
  };
  return (
    <button type="button" className="btn" disabled={!cardFieldsForm || phase !== "idle" || !amount} onClick={() => void pay()}>
      {amount ? `Pay ${amount} by card` : "Pay by card"}
    </button>
  );
}

export function CardForm(p: CardFormProps) {
  const [{ isResolved }] = usePayPalScriptReducer();
  const [live, setLive] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [zip, setZip] = useState("");

  // The SDK is in and still no field after a beat: not eligible — the button instead.
  useEffect(() => {
    if (!isResolved || live) return;
    const t = window.setTimeout(() => setFallback(true), 2500);
    return () => window.clearTimeout(t);
  }, [isResolved, live]);

  return (
    <div className={`cf${p.phase !== "idle" ? " busy" : ""}`}>
      <PayPalCardFieldsProvider createOrder={p.createOrder} onApprove={(d) => p.onApprove(d.orderID)} onError={(err) => p.onError(messageOf(err))} style={FIELD_STYLE}>
        <Probe onLive={() => setLive(true)} />
        <div className="cf-own">
          <label className="cf-l mono">Card number</label>
          <div className="cf-f">
            <PayPalNumberField className="cf-in" placeholder="0000 0000 0000 0000" />
          </div>
          <div className="cf-row">
            <div>
              <label className="cf-l mono">Expires</label>
              <div className="cf-f">
                <PayPalExpiryField className="cf-in" placeholder="MM/YY" />
              </div>
            </div>
            <div>
              <label className="cf-l mono">CVC</label>
              <div className="cf-f">
                <PayPalCVVField className="cf-in" placeholder="123" />
              </div>
            </div>
            <div>
              <label className="cf-l mono" htmlFor="cf-zip">
                ZIP
              </label>
              <input
                id="cf-zip"
                className="cf-zip mono"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="89074"
                maxLength={10}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/[^\d-]/g, ""))}
              />
            </div>
          </div>
          <PayButton amount={p.amount} zip={zip} phase={p.phase} setPhase={p.setPhase} onError={p.onError} />
        </div>
      </PayPalCardFieldsProvider>

      {fallback && !live && (
        <div className="paypal">
          <p className="line mono">Pay by debit or credit card</p>
          {/* PayPal's own form opens inline here and must stay live: the status bar
           * runs from the moment its PAY is tapped (createOrder), but nothing is
           * ever dimmed or blocked around it. */}
          <PayPalButtons
            fundingSource="card"
            style={{ layout: "horizontal", color: "white", shape: "rect", height: 48 }}
            createOrder={async () => {
              p.setPhase("processing");
              try {
                return await p.createOrder();
              } catch (err) {
                p.setPhase("idle");
                throw err;
              }
            }}
            onCancel={() => p.setPhase("idle")}
            onApprove={(d) => p.onApprove(d.orderID)}
            onError={(err) => p.onError(messageOf(err))}
          />
        </div>
      )}
    </div>
  );
}
