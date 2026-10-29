"use client";

import { useEffect, useRef, useState } from "react";
import { usePayPalScriptReducer } from "@paypal/react-paypal-js";
import type { Phase } from "./CardForm";

/**
 * APPLE PAY, through PayPal (owner, 2026-10-29: "if we can add ability to
 * pay w/ apple pay that would be great"). Safari only — the button is
 * Apple's own, drawn by WebKit — and only when PayPal says the account is
 * eligible (Apple Pay is on for the app, and the domain is registered with
 * PayPal: public/.well-known/apple-developer-merchantid-domain-association
 * is PayPal's file for that). Anywhere else this renders nothing and the
 * card form stands alone.
 *
 * The flow is PayPal's: Apple's sheet opens on the tap (the session must be
 * made inside the tap), PayPal validates the merchant for the sheet, and
 * once the user authorises, the order is made on our route for the amount
 * on the page, PayPal confirms it with Apple's token, and our route
 * captures it like a card — the same createOrder / onApprove as the card
 * form, so the thank-you and the owner's email are the same.
 *
 * The SDK's types know nothing of Applepay; the shapes below are the
 * parts of PayPal's and Apple's objects this file touches.
 */

type ApplePayConfig = { isEligible: boolean; countryCode: string; merchantCapabilities: string[]; supportedNetworks: string[] };
type ApplePayInstance = {
  config: () => Promise<ApplePayConfig>;
  validateMerchant: (o: { validationUrl: string; displayName?: string }) => Promise<{ merchantSession: unknown }>;
  confirmOrder: (o: { orderId: string; token: unknown; billingContact?: unknown }) => Promise<unknown>;
};
type ApplePaySessionLike = {
  begin: () => void;
  abort: () => void;
  completeMerchantValidation: (s: unknown) => void;
  completePayment: (r: { status: number }) => void;
  onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((e: { payment: { token: unknown; billingContact?: unknown } }) => void) | null;
  oncancel: (() => void) | null;
};
type ApplePaySessionCtor = {
  new (version: number, request: Record<string, unknown>): ApplePaySessionLike;
  canMakePayments: () => boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
};
type Win = { paypal?: { Applepay?: () => ApplePayInstance }; ApplePaySession?: ApplePaySessionCtor };

export function ApplePayButton({
  amountCents,
  label,
  createOrder,
  onApprove,
  onError,
  phase,
  setPhase,
}: {
  /** The figure on the page, or null while it is not valid. */
  amountCents: number | null;
  /** What Apple's sheet shows as the line item. */
  label: string;
  createOrder: () => Promise<string>;
  onApprove: (orderID: string) => Promise<void>;
  onError: (message: string) => void;
  phase: Phase;
  setPhase: (p: Phase) => void;
}) {
  const [{ isResolved }] = usePayPalScriptReducer();
  const [config, setConfig] = useState<ApplePayConfig | null>(null);
  const apRef = useRef<ApplePayInstance | null>(null);

  useEffect(() => {
    if (!isResolved) return;
    const w = window as unknown as Win;
    if (!w.ApplePaySession || !w.ApplePaySession.canMakePayments() || !w.paypal?.Applepay) return;
    try {
      const ap = w.paypal.Applepay();
      apRef.current = ap;
      ap.config()
        .then((c) => {
          if (c.isEligible) setConfig(c);
        })
        .catch(() => undefined);
    } catch {
      /* no Apple Pay here */
    }
  }, [isResolved]);

  if (!config || amountCents === null) return null;

  const pay = () => {
    const w = window as unknown as Win;
    const ap = apRef.current;
    const Session = w.ApplePaySession;
    if (!ap || !Session) return;
    const request = {
      countryCode: config.countryCode,
      currencyCode: "USD",
      merchantCapabilities: config.merchantCapabilities,
      supportedNetworks: config.supportedNetworks,
      requiredBillingContactFields: ["postalAddress"],
      total: { label, amount: (amountCents / 100).toFixed(2), type: "final" },
    };
    let session: ApplePaySessionLike;
    try {
      session = new Session(4, request);
    } catch {
      onError("Apple Pay could not start.");
      return;
    }
    session.onvalidatemerchant = (e) => {
      ap.validateMerchant({ validationUrl: e.validationURL, displayName: "LASD26" })
        .then((r) => session.completeMerchantValidation(r.merchantSession))
        .catch(() => {
          session.abort();
          setPhase("idle");
          onError("Apple Pay could not be verified for this site.");
        });
    };
    session.onpaymentauthorized = async (e) => {
      try {
        setPhase("processing");
        const orderId = await createOrder();
        await ap.confirmOrder({ orderId, token: e.payment.token, billingContact: e.payment.billingContact });
        session.completePayment({ status: Session.STATUS_SUCCESS });
        await onApprove(orderId);
      } catch (err) {
        session.completePayment({ status: Session.STATUS_FAILURE });
        setPhase("idle");
        const msg = err instanceof Error && err.message ? err.message : "";
        onError(msg && msg.length < 160 ? msg : "Apple Pay did not go through — nothing was taken.");
      }
    };
    session.oncancel = () => setPhase("idle");
    session.begin();
  };

  return (
    <>
      <button type="button" className="apple-pay" aria-label={`Pay with Apple Pay`} disabled={phase !== "idle"} onClick={pay} />
      <p className="or mono">or by card</p>
    </>
  );
}
