"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { fmtUsd, parseUsd } from "@/lib/lasd26/money";
import { lasdPath } from "@/lib/lasd26/paths";
import type { RouteArt } from "./routeArt";
import { CardForm } from "./CardForm";
import { ApplePayButton } from "./ApplePayButton";

/* THE FOUR SCREENS (owner, 2026-10-29: "What does it look like if we make
 * it a step by step screen"), one big number on each at most ("I only
 * want one big number on the screen"):
 *
 *   0  THANK YOU FOR OPTING IN — the route drawing itself behind, start to
 *      finish in one stroke, CONTINUE
 *      (SIGN IN TO CONTINUE while signed out)
 *   1  LASD26 IS A PAY WHAT YOU'RE ABLE EXPERIENCE — the total (a link to
 *      the expenses sheet), the split, a NOTE of what they already covered
 *      on their own card (the lines they fronted; owner, 2026-10-29:
 *      "subtract that from their share") and their share — YOUR SHARE, UP TO
 *      (owner, 2026-10-29: "include a 'up to' x call out") — the share the big
 *      number, whole dollars; or the calm notice when
 *      there is nothing to pay (not on the team, not open yet, owed, square)
 *   2  SEND ANY AMOUNT UP TO $X — one field, the big number there, opening
 *      EMPTY on a 0 placeholder (owner, 2026-10-29: "start the value at
 *      0") with no line under it (owner: "Remove the 'all of it' text or
 *      the x out of y text"); over the share the rule turns red and
 *      CONTINUE waits
 *   3  YOU'RE SENDING — the amount big, APPLE PAY where Safari and PayPal
 *      allow it (ApplePayButton.tsx), then THE CARD FORM in our own UI
 *      (CardForm.tsx: PayPal-hosted number, expiry and CVC inside our boxes,
 *      our ZIP, our PAY button); the tap shows PROCESSING YOUR PAYMENT at
 *      once (the status block, a sliding lime bar), PayPal takes the card
 *      behind it, then
 *   4  SEE YOU AGAIN SO SOON — the amount and the day
 *
 * A row already paid opens on 4. The dashes at the foot are screens 0–3;
 * BACK on 1–3. The same PayPal connection Settle up uses, card only,
 * white on the ink, against /api/lasd26/your-share, which takes the amount on
 * create and works the ceiling out again from the live cost sheet. The
 * owner's row is the pool: he pays the stand-in to himself as a live test
 * (lib/lasd26/yourShare.ts). */

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
const MIN_CENTS = 100;

export type Gate = "signin" | "join" | "closed" | "paused" | "owed" | "square" | "covered" | "paid" | "ok";

export type StepsProps = {
  gate: Gate;
  /** What the weekend came to and how many ways it splits. */
  totalCents: number;
  splitCount: number;
  /** Each person's share, before anything fronted. */
  perPersonCents: number;
  /** What this member fronted (comes off their share); the lines behind it are not shown (owner, 2026-10-29: "just keep the total"). */
  frontedCents: number;
  fronted: { title: string; amountCents: number }[];
  /** The big number on screen 1 and the ceiling of the field: the share less what was fronted. */
  shareCents: number;
  /** What the pool owes them, when gate is "owed". */
  owedCents: number;
  /** The row already paid: what, when, how. */
  paid: { amount: string; stamp: string; via: string } | null;
  /** "Oct 29", for a payment made now. */
  stampToday: string;
  art: RouteArt;
  /** The owner looking at a runner's numbers (their name): read-only, no card button. */
  viewingAs: string | null;
  /** The owner paying himself as a test: the route is told, so the ceiling is the whole share. */
  testing: boolean;
};

/** $475 for a round figure, $50.50 otherwise (a typed amount may carry cents). */
const money = (c: number) => fmtUsd(c, { whole: c % 100 === 0 });
/** The total, to the nearest dollar (owner, 2026-10-29: "make sure the dollar total rounded"). */
const dollars = (c: number) => fmtUsd(Math.round(c / 100) * 100, { whole: true });

export function Steps(p: StepsProps) {
  const router = useRouter();
  const [step, setStep] = useState(p.gate === "paid" ? 4 : 0);
  const [raw, setRaw] = useState("");
  // idle → processing (approved, the capture running). NOTHING in between:
  // on a phone PayPal opens its card fields INLINE under the button, inside
  // the same box, so dimming or blocking that box while "the form opens"
  // left the owner stuck on a greyed-out form (2026-10-29).
  const [phase, setPhase] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amount: string; via: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cents = parseUsd(raw);
  const valid = cents !== null && cents >= MIN_CENTS && cents <= p.shareCents;
  const bad = raw.trim() !== "" && !valid;
  const amountRef = useRef<number | null>(null);
  amountRef.current = valid ? cents : null;
  const share = money(p.shareCents);
  const amount = valid && cents !== null ? money(cents) : null;

  useEffect(() => {
    if (step === 2) inputRef.current?.focus();
  }, [step]);

  // The owner's VIEW AS and STOP THE TEST re-render the page under an open
  // flow (a soft navigation keeps this component's state): when the gate
  // is no longer ok, fall back to the share screen rather than offer a pay
  // screen the route would refuse.
  useEffect(() => {
    if (p.gate !== "ok" && step >= 2 && step <= 3) setStep(1);
  }, [p.gate, step]);

  // WARM-UP (owner, 2026-10-29: "when clicking the pay w/ card there is a
  // delay"): as the amount screen opens, one GET wakes the route — the
  // function, the database and PayPal's token — so the order on the next
  // screen is quick.
  useEffect(() => {
    if (step === 2 && p.gate === "ok") void fetch("/api/lasd26/your-share", { cache: "no-store" }).catch(() => undefined);
  }, [step, p.gate]);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  // THE CARD FORM (CardForm.tsx), ONE element for screens 2 and 3 (keyed, so
  // React keeps it mounted across them): PayPal's hosted inputs load
  // offscreen while the amount is typed and are there when the pay screen
  // opens. Its callbacks read the amount through amountRef.
  const createOrder = async (): Promise<string> => {
    setError(null);
    const amountCents = amountRef.current;
    if (amountCents === null) throw new Error(`$1 to ${share}.`);
    const res = await fetch("/api/lasd26/your-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", amountCents }),
    });
    const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
    if (!res.ok || !data.ok || !data.id) throw new Error(data.error ?? "Couldn't start the payment.");
    return data.id;
  };
  const approve = async (orderID: string): Promise<void> => {
    setPhase("processing");
    const res = await fetch("/api/lasd26/your-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "capture", orderId: orderID }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; paid?: string };
    setPhase("idle");
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Couldn't finish the payment.");
      return;
    }
    setDone({ amount: data.paid ?? money(amountRef.current ?? 0), via: "card" });
    setStep(4);
    router.refresh();
  };
  // A guard the route answered on create ("Already paid.", "opens after the
  // race") arrives as the message; PayPal's own failures get the plain line
  // (CardForm.tsx messageOf).
  const fail = (message: string) => {
    setPhase("idle");
    setError(message);
  };
  const paypal = PAYPAL_CLIENT_ID ? <CardForm amount={amount} createOrder={createOrder} onApprove={approve} onError={fail} phase={phase} setPhase={setPhase} /> : null;

  const screen = (() => {
    if (step === 0) {
      return (
        <>
          <RouteDrawing art={p.art} />
          <div className="step">
            <h1>Thank you for opting in.</h1>
            {p.gate === "signin" ? (
              <button type="button" className="btn" onClick={() => signIn("google", { callbackUrl: window.location.href })}>
                Sign in to continue
              </button>
            ) : (
              <button type="button" className="btn" onClick={next}>
                Continue
              </button>
            )}
          </div>
        </>
      );
    }

    if (step === 1) {
      const numbers = p.gate === "ok" || p.gate === "covered" || p.gate === "owed" || p.gate === "square";
      const notice =
        p.gate === "join"
          ? "This page is for the LASD26 team. Join through the link Mikian sent and your share shows here."
          : p.gate === "closed"
            ? "Settling up opens after the race. The crew will send the word."
            : p.gate === "paused"
              ? "Payments are paused. Try again in a bit — this page will be here."
              : p.gate === "owed"
                ? `Mikian sends you ${fmtUsd(p.owedCents)}. Nothing to pay here.`
                : p.gate === "square"
                  ? "What you fronted is exactly your share. Nothing to pay, nothing owed."
                  : p.gate === "covered"
                    ? "Nothing to pay."
                    : null;
      return (
        <div className="step">
          <h1>LASD26 is a pay what you&rsquo;re able experience.</h1>
          {numbers && (
            <p className="line mono">
              The weekend came to{" "}
              <a href={lasdPath("/expenses")} title="Every line behind it">
                {dollars(p.totalCents)}
              </a>{" "}
              · split {p.splitCount} ways{p.frontedCents > 0 ? ` · ${money(p.perPersonCents)} each` : ""}
            </p>
          )}
          {numbers && p.frontedCents > 0 && (
            <p className="note">
              You already covered <b>{money(p.frontedCents)}</b>.{p.gate === "ok" ? "" : " That’s more than your share."}
            </p>
          )}
          {p.testing && <p className="line mono">A test — you’re paying yourself the whole share.</p>}
          {notice ? (
            <p className="notice">{notice}</p>
          ) : (
            <>
              <div className="k mono">Your share, up to</div>
              <div className="big">{share}</div>
              <button type="button" className="btn" onClick={next}>
                Continue
              </button>
            </>
          )}
          <button type="button" className="back mono" onClick={back}>
            ← Back
          </button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="step">
          <h1>Send any amount up to {share}.</h1>
          <div className={`field${bad ? " bad" : ""}`}>
            <span className="cur" aria-hidden="true">
              $
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              aria-label="Amount in dollars"
              placeholder="0"
              value={raw}
              maxLength={9}
              onChange={(e) => {
                setError(null);
                setRaw(e.target.value.replace(/[^\d.,]/g, ""));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) next();
              }}
            />
          </div>
          <button type="button" className="btn" disabled={!valid} onClick={next}>
            Continue
          </button>
          <button type="button" className="back mono" onClick={back}>
            ← Back
          </button>
          {paypal && !p.viewingAs && (
            <div key="paypal" className="paypal off" aria-hidden="true">
              {paypal}
            </div>
          )}
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="step">
          <div className="k mono">You&rsquo;re sending</div>
          <div className="big">{amount}</div>
          {phase === "processing" && (
            <div className="status" role="status" aria-live="polite">
              <span className="bar" aria-hidden="true" />
              <span className="mono">Processing your payment…</span>
            </div>
          )}
          {p.viewingAs ? (
            <p className="notice">Viewing as {p.viewingAs} — the card form is theirs.</p>
          ) : !PAYPAL_CLIENT_ID ? (
            <p className="err mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set on this build — the card form cannot load.</p>
          ) : (
            <>
              <ApplePayButton
                amountCents={valid ? cents : null}
                label="LASD26 — your share"
                createOrder={createOrder}
                onApprove={approve}
                onError={fail}
                phase={phase}
                setPhase={setPhase}
              />
              <div key="paypal" className="paypal">
                {paypal}
              </div>
            </>
          )}
          {error && <p className="err mono">{error}</p>}
          {phase === "idle" && (
            <button type="button" className="back mono" onClick={back}>
              ← Back
            </button>
          )}
        </div>
      );
    }

    const paid = done ? { ...done, stamp: p.stampToday } : p.paid;
    return (
      <div className="step">
        <h1>See you again so soon.</h1>
        {paid && (
          <p className="line mono">
            {paid.amount} · {paid.stamp} · {paid.via}
          </p>
        )}
      </div>
    );
  })();

  const body = (
    <>
      <div className="stage">{screen}</div>
      <div className="dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i === Math.min(step, 3) ? "on" : undefined} />
        ))}
      </div>
    </>
  );

  // The SDK loads once, early, only when a real card form can be needed.
  if (p.gate === "ok" && PAYPAL_CLIENT_ID) {
    return (
      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD", intent: "capture", components: "buttons,card-fields,applepay" }}>{body}</PayPalScriptProvider>
    );
  }
  return body;
}

/** The course, drawn in one stroke behind the first screen, the height of
 * the screen (owner, 2026-10-29: "draw the route from top to bottom"; the
 * tall shape is routeArt's, the stylesheet fixes the box to the viewport). */
function RouteDrawing({ art }: { art: RouteArt }) {
  return (
    <div className="art" aria-hidden="true">
      <svg viewBox={`0 0 ${art.w} ${art.h}`} preserveAspectRatio="xMaxYMid meet">
        <path className="run" d={art.path} pathLength={1} />
      </svg>
    </div>
  );
}
