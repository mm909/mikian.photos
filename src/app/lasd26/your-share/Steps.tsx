"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { fmtUsd, parseUsd } from "@/lib/lasd26/money";
import { lasdPath } from "@/lib/lasd26/paths";
import type { RouteArt } from "./routeArt";

/* THE FOUR SCREENS (owner, 2026-10-29: "What does it look like if we make
 * it a step by step screen"), one big number on each at most ("I only
 * want one big number on the screen"):
 *
 *   0  THANK YOU FOR OPTING IN — the route drawing itself behind, start to
 *      finish in one stroke, CONTINUE
 *      (SIGN IN TO CONTINUE while signed out)
 *   1  LASD26 IS A PAY WHAT YOU'RE ABLE EXPERIENCE — the total (a link to
 *      the expenses sheet), the split and their share, the share the big
 *      number, whole dollars; or the calm notice when
 *      there is nothing to pay (not on the team, not open yet, owed, square)
 *   2  SEND ANY AMOUNT UP TO $X — one field, the big number there, opening
 *      EMPTY on a 0 placeholder (owner, 2026-10-29: "start the value at
 *      0") with no line under it (owner: "Remove the 'all of it' text or
 *      the x out of y text"); over the share the rule turns red and
 *      CONTINUE waits
 *   3  YOU'RE SENDING — the amount big, one line and PayPal's card button
 *      under it (PayPal draws the button; the line says what it is); PayPal
 *      processes, then
 *   4  SEE YOU AGAIN SO SOON — the amount and the day
 *
 * A row already paid opens on 4. The dashes at the foot are screens 0–3;
 * BACK on 1–3. The same PayPal connection Settle up uses, card only,
 * white on the ink, against /api/lasd26/your-share, which takes the amount on
 * create and works the ceiling out again from the live cost sheet. The
 * owner's row is the pool: the route answers him "you're the pool" on
 * create, so he can look at the card screen without a charge (owner,
 * 2026-10-29: "Let me see the payment screen"). */

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
const MIN_CENTS = 100;

export type Gate = "signin" | "join" | "closed" | "paused" | "owed" | "square" | "paid" | "ok";

export type StepsProps = {
  gate: Gate;
  /** What the weekend came to and how many ways it splits. */
  totalCents: number;
  splitCount: number;
  /** Each person's share, before anything fronted. */
  perPersonCents: number;
  /** What this member fronted (comes off their share). */
  frontedCents: number;
  /** The big number on screen 1 and the ceiling of the field: the share less what was fronted. */
  shareCents: number;
  /** What the pool owes them, when gate is "owed". */
  owedCents: number;
  /** The row already paid: what, when, how. */
  paid: { amount: string; stamp: string; via: string } | null;
  /** "Oct 29", for a payment made now. */
  stampToday: string;
  art: RouteArt;
};

/** $475 for a round figure, $50.50 otherwise (a typed amount may carry cents). */
const money = (c: number) => fmtUsd(c, { whole: c % 100 === 0 });
/** The total, to the nearest dollar (owner, 2026-10-29: "make sure the dollar total rounded"). */
const dollars = (c: number) => fmtUsd(Math.round(c / 100) * 100, { whole: true });

export function Steps(p: StepsProps) {
  const router = useRouter();
  const [step, setStep] = useState(p.gate === "paid" ? 4 : 0);
  const [raw, setRaw] = useState("");
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

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

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
      const notice =
        p.gate === "join"
          ? "This page is for the LASD26 team. Join through the link Mikian sent and your share shows here."
          : p.gate === "closed"
            ? "Settling up opens after the race. The crew will send the word."
            : p.gate === "paused"
              ? "Payments are paused. Try again in a bit — this page will be here."
              : p.gate === "owed"
                ? `You fronted more than your share — Mikian sends you ${fmtUsd(p.owedCents)}. Nothing to pay here.`
                : p.gate === "square"
                  ? "What you fronted is exactly your share. Nothing to pay, nothing owed."
                  : null;
      return (
        <div className="step">
          <h1>LASD26 is a pay what you&rsquo;re able experience.</h1>
          {notice ? (
            <p className="notice">{notice}</p>
          ) : (
            <>
              <p className="line mono">
                The weekend came to{" "}
                <a href={lasdPath("/expenses")} title="Every line behind it">
                  {dollars(p.totalCents)}
                </a>{" "}
                · split {p.splitCount} ways
                {p.frontedCents > 0 ? ` · ${money(p.perPersonCents)} each · less ${money(p.frontedCents)} you fronted` : ""}
              </p>
              <div className="k mono">Your share</div>
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
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="step">
          <div className="k mono">You&rsquo;re sending</div>
          <div className="big">{amount}</div>
          {phase === "processing" ? (
            <p className="line mono">Processing…</p>
          ) : !PAYPAL_CLIENT_ID ? (
            <p className="err mono">NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set on this build — the card button cannot load.</p>
          ) : (
            <>
              <p className="line mono">Pay by debit or credit card</p>
              <div className="paypal">
                <PayPalButtons
                  fundingSource="card"
                  forceReRender={[cents]}
                  style={{ layout: "horizontal", color: "white", shape: "rect", height: 48 }}
                  createOrder={async () => {
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
                  }}
                  onApprove={async (d) => {
                    setPhase("processing");
                    const res = await fetch("/api/lasd26/your-share", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "capture", orderId: d.orderID }),
                    });
                    const data = (await res.json()) as { ok?: boolean; error?: string; paid?: string };
                    setPhase("idle");
                    if (!res.ok || !data.ok) {
                      setError(data.error ?? "Couldn't finish the payment.");
                      return;
                    }
                    setDone({ amount: data.paid ?? amount ?? share, via: "card" });
                    setStep(4);
                    router.refresh();
                  }}
                  onError={(err) => {
                    // A guard the route answered on create ("Already paid.",
                    // "opens after the race") is thrown from createOrder and
                    // lands here as an Error with that message; show it.
                    // Anything else — PayPal's own failures, long JSON — gets
                    // the plain line.
                    const msg = err instanceof Error && err.message ? err.message : "";
                    setError(msg && msg.length < 160 ? msg : "The card could not be charged — nothing was taken.");
                  }}
                />
              </div>
            </>
          )}
          {error && <p className="err mono">{error}</p>}
          {phase !== "processing" && (
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

  // The SDK loads once, early, only when a real card button can be needed.
  if (p.gate === "ok" && PAYPAL_CLIENT_ID) {
    return <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD", intent: "capture" }}>{body}</PayPalScriptProvider>;
  }
  return body;
}

/** The course, drawn in one stroke behind the first screen. */
function RouteDrawing({ art }: { art: RouteArt }) {
  return (
    <div className="art" aria-hidden="true">
      <svg viewBox={`0 0 ${art.w} ${art.h}`} preserveAspectRatio="xMidYMid meet">
        <path className="run" d={art.path} pathLength={1} />
      </svg>
    </div>
  );
}
