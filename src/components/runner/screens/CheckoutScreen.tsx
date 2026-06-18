"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Headline } from "../Headline";
import { useRunner } from "../RunnerProvider";
import { prices, type CartItem } from "@/lib/data";

/**
 * Reduce the cart to the shape the API expects:
 *   - any bundle item → kind=bundle, carrying the ids it snapshotted at add
 *     time (the buyer's matched set). An EMPTY id list = whole-event bundle;
 *     the server fills it with every event photo.
 *   - otherwise       → kind=multi with the explicit single photo ids
 *
 * The bundle's ids come from the cart item itself, NOT from the live
 * resultPhotos — the cart is restored verbatim from localStorage across the
 * sign-in reload, whereas resultPhotos gets rebuilt from the (capped) catalog
 * and can come back empty for a face match. Reading the cart is what keeps a
 * 9-photo match from ballooning into the whole event.
 *
 * Bundle wins if both kinds coexist (defensive — shouldn't normally happen).
 */
function describeCart(items: CartItem[]):
  | { kind: "bundle"; photoIds: string[] }
  | { kind: "multi"; photoIds: string[] } {
  const bundle = items.find(
    (i): i is Extract<CartItem, { kind: "bundle" }> => i.kind === "bundle"
  );
  if (bundle) return { kind: "bundle", photoIds: bundle.photoIds ?? [] };
  const photoIds = items
    .filter((i): i is Extract<CartItem, { kind: "single" }> => i.kind === "single")
    .map((i) => i.id);
  return { kind: "multi", photoIds };
}

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

type Props = { unlocked: boolean };

export function CheckoutScreen({ unlocked }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { cart, finalizeOrder, addBundle, activeEventId, isFree, didHydrate } = useRunner();

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
  // automatically. WAIT for the provider to hydrate from localStorage first —
  // otherwise, on the post-sign-in full reload, this fires on the empty initial
  // state and snapshots an EMPTY bundle (resultPhotos hasn't rebuilt yet), which
  // the server then expands to the whole event. Gating on didHydrate guarantees
  // the persisted cart (with the buyer's matched ids) is already restored, so
  // this only ever adds a bundle for a genuine cart-less arrival.
  useEffect(() => {
    if (didHydrate && cart.items.length === 0) addBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didHydrate, cart.items.length]);

  const subtotal = cart.items.reduce((s, i) => s + i.price, 0);
  // Treat a $0 order as free regardless of the isFree flag. A free event whose
  // flag was lost crossing to /checkout — or a $0-bundle misconfig — still has a
  // $0 subtotal, and the server already returns 0 (no fee) for it (see
  // pricing.ts orderTotalUsd) and PayPal rejects $0 orders. Branching on this
  // (not just isFree) is what stops the "$0.00 bundle but $0.30 fee + PayPal
  // that hangs" state: PayPal's create-order returns {free:true} with no id, so
  // the button can never complete. Route $0 to the free claim instead.
  const isZero = isFree || subtotal <= 0;
  const processingFee = isZero ? 0 : +(subtotal * prices.stripeRate + prices.stripeFlat).toFixed(2);
  const total = isZero ? 0 : +(subtotal + processingFee).toFixed(2);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous in-flight latch — `disabled={processing}` only reflects after a
  // React commit, so a fast double-tap can fire the handler twice (two $0 orders
  // + two receipt emails). A ref blocks the second call in the same tick.
  const inFlight = useRef(false);
  // Set when createOrder redirects a $0 order to the free claim, so onError can
  // swallow the abort without depending on the thrown Error surviving PayPal's
  // boundary (its type only promises Record<string, unknown>, not Error).
  const redirectingToFree = useRef(false);
  // Free events have no payment step — auto-claim once we're signed in with a
  // cart, then land on the order page ("Your photos are ready."). Latched so it
  // fires exactly once even as isFree/cart settle.
  const autoClaimedRef = useRef(false);
  useEffect(() => {
    if (
      isZero &&
      status === "authenticated" &&
      cart.items.length > 0 &&
      !autoClaimedRef.current &&
      !inFlight.current
    ) {
      autoClaimedRef.current = true;
      void claimFree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZero, status, cart.items.length]);

  // Require a signed-in Google account before payment. We want a real identity
  // on every order so the buyer can find their photos again and the receipt
  // has a home. Owner is always signed in, so the simulate path is unaffected.
  if (status === "loading") {
    return <main className="screen" style={{ padding: "96px 32px" }} />;
  }
  if (!session) {
    return <SignInGate />;
  }

  if (cart.items.length === 0 && !processing) {
    return <main className="screen" style={{ padding: "96px 32px" }} />;
  }

  // Free event → no payment screen. The effect above auto-claims the photos;
  // show a brief "Preparing your photos…" (or an error + retry) until we land
  // on the order page.
  if (isZero) {
    return <FreePreparing error={error} onRetry={() => void claimFree()} />;
  }

  if (!isZero && !PAYPAL_CLIENT_ID) {
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

  const isOwner = Boolean(session?.roles?.includes("owner"));

  async function simulatePayment() {
    if (inFlight.current) return;
    inFlight.current = true;
    setProcessing(true);
    setError(null);
    try {
      const cartShape = describeCart(cart.items);
      const res = await fetch("/api/dev/fake-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: activeEventId ?? "",
          kind: cartShape.kind,
          photoIds: cartShape.photoIds,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not simulate order");
      }
      const captured = (await res.json()) as { orderUrl?: string; amountUsd?: number };
      finalizeOrder(captured.amountUsd ?? total);
      router.push(captured.orderUrl ?? "/runner");
    } catch (e) {
      inFlight.current = false;
      setProcessing(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Free event: no PayPal. Claim the photos directly — the server mints the
  // order, snapshots the entitlement, and emails the download link.
  async function claimFree() {
    if (inFlight.current) return;
    inFlight.current = true;
    setProcessing(true);
    setError(null);
    try {
      const cartShape = describeCart(cart.items);
      const res = await fetch("/api/orders/free-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: activeEventId ?? "",
          kind: cartShape.kind,
          photoIds: cartShape.photoIds,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not claim your photos");
      }
      const claimed = (await res.json()) as { orderUrl?: string };
      finalizeOrder(0);
      router.push(claimed.orderUrl ?? "/runner");
    } catch (e) {
      inFlight.current = false;
      setProcessing(false);
      setError(e instanceof Error ? e.message : String(e));
    }
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
              {isZero ? "Your photos are free" : "Pay with PayPal or card"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0, marginBottom: 20 }}>
              {isZero
                ? "No payment needed — claim your full-resolution photos and we’ll email your download link."
                : "You’ll see PayPal’s Pay button below. You can pay with your PayPal account or as a guest with any major card — no PayPal account needed."}
            </p>

            {isZero ? (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                disabled={processing}
                onClick={() => void claimFree()}
                style={{ width: "100%", justifyContent: "center" }}
              >
                Get your photos (free)
              </button>
            ) : (
              <>
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
                  // Derive cart shape — bundle if any bundle item, otherwise
                  // multi with the singles we have. Server recomputes the
                  // price from kind + count, so the client doesn't get to
                  // dictate dollar amounts.
                  const cartShape = describeCart(cart.items);
                  const res = await fetch("/api/paypal/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      kind: cartShape.kind,
                      count: cartShape.kind === "multi" ? cartShape.photoIds.length : 0,
                      eventId: activeEventId ?? "",
                    }),
                  });
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j.error || "Could not create order");
                  }
                  const j = (await res.json()) as { id?: string; free?: boolean };
                  // Server resolved the order to $0 (free event / $0 misconfig):
                  // there's no PayPal order to create. Switch to the free-claim
                  // flow, then abort the PayPal handshake with a sentinel that
                  // onError ignores (claimFree has already navigated away).
                  if (j.free || !j.id) {
                    redirectingToFree.current = true;
                    void claimFree();
                    throw new Error("__free__");
                  }
                  return j.id;
                }}
                onApprove={async (data) => {
                  setProcessing(true);
                  try {
                    const cartShape = describeCart(cart.items);
                    const res = await fetch("/api/paypal/capture-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: data.orderID,
                        eventId: activeEventId ?? "",
                        kind: cartShape.kind,
                        // The order covers exactly the photos the runner is
                        // looking at — their matched set, not the whole event.
                        photoIds: cartShape.photoIds,
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
                  // We redirected a $0 order to the free claim — swallow the
                  // abort. Gate on our own ref, not the thrown Error's message:
                  // PayPal's onError type only promises Record<string, unknown>,
                  // so the "__free__" Error may not survive its boundary.
                  if (redirectingToFree.current) {
                    redirectingToFree.current = false;
                    return;
                  }
                  setError(e instanceof Error ? e.message : "Payment error");
                }}
                onCancel={() => {
                  redirectingToFree.current = false;
                  setError(null);
                }}
              />
            </PayPalScriptProvider>

            {isOwner && (
              <button
                type="button"
                onClick={() => void simulatePayment()}
                disabled={processing}
                className="btn btn--ghost"
                style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
              >
                Simulate payment (no charge) — owner
              </button>
            )}
              </>
            )}

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
              onClick={() => router.push("/")}
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
              ← Back to photos
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
                      : it.photoIds && it.photoIds.length > 0
                        ? `All ${it.photoIds.length} photos`
                        : "All photos bundle"}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${(isZero ? 0 : it.price).toFixed(2)}
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
                <SumRow label="Subtotal" value={`$${(isZero ? 0 : subtotal).toFixed(2)}`} />
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

/**
 * Pre-payment sign-in wall. Shown when no session is present — the buyer
 * continues with Google, then returns to /checkout (their cart survives the
 * round-trip via RunnerProvider's localStorage persistence).
 */
function SignInGate() {
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
          Step 1 of 2 · Sign in
        </div>
        <Headline
          as="h1"
          text="Sign in to check out."
          accent="check out."
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
        <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 18, lineHeight: 1.55 }}>
          Create your account so your photos are saved to you and your receipt has a
          home. It&rsquo;s one tap with Google — no password to remember.
        </p>
        <button
          className="btn btn--primary btn--lg"
          onClick={() => signIn("google", { callbackUrl: "/checkout" })}
          style={{ marginTop: 28, padding: "14px 22px" }}
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}

/**
 * Free-event interstitial — shown while the auto-claim runs (no payment step).
 * Normally just a spinner that gives way to the order page; on failure it
 * surfaces the error with a retry so the buyer isn't stranded.
 */
function FreePreparing({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <main
      className="screen"
      style={{ padding: "120px 24px 160px", display: "flex", justifyContent: "center" }}
    >
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        {error ? (
          <>
            <Headline
              as="h1"
              text="We couldn't get your photos."
              accent="couldn't"
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: "clamp(28px, 4vw, 40px)",
                letterSpacing: "-.015em",
                color: "var(--ink)",
              }}
            />
            <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 16 }}>{error}</p>
            <button className="btn btn--primary btn--lg" onClick={onRetry} style={{ marginTop: 22 }}>
              Try again
            </button>
          </>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: "3px solid var(--line)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
              }}
            />
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--ink)" }}>
              Preparing your photos…
            </div>
          </div>
        )}
      </div>
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
