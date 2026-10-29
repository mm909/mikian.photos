"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { fmtUsd, parseUsd } from "@/lib/lasd26/money";
import { lasdPath } from "@/lib/lasd26/paths";
import { VENMO_HANDLE, ZELLE_TO, venmoPayUrl } from "@/lib/lasd26/yourShare";
import type { RouteArt } from "./routeArt";

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
 *   3  YOU'RE SENDING — the amount big, then VENMO AND ZELLE (owner,
 *      2026-10-29: "Instead of collecting payment through PayPal, add my
 *      Venmo and Zelle with a note saying something like please send your
 *      share by Zelle or Venmo. PayPal fees were too high"): the two ways
 *      as rows — the handle with OPEN VENMO (the app, amount and note
 *      filled in), the Zelle contact with COPY — and I SENT IT, which
 *      tells the route (an email to the owner, nothing recorded; he marks
 *      the row paid once it lands), then
 *   4  SEE YOU AGAIN SO SOON — the amount, the day and the way
 *
 * A row already paid opens on 4. The dashes at the foot are screens 0–3;
 * BACK on 1–3. The handles are lib/lasd26/yourShare.ts. */

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
  /** "Oct 29", for a claim made now. */
  stampToday: string;
  art: RouteArt;
  /** The owner looking at a runner's numbers (their name): read-only, no I SENT IT. */
  viewingAs: string | null;
  /** The owner walking the flow on himself: the whole share, nothing taken off. */
  testing: boolean;
};

type Via = "venmo" | "zelle";

/** $475 for a round figure, $50.50 otherwise (a typed amount may carry cents). */
const money = (c: number) => fmtUsd(c, { whole: c % 100 === 0 });
/** The total, to the nearest dollar (owner, 2026-10-29: "make sure the dollar total rounded"). */
const dollars = (c: number) => fmtUsd(Math.round(c / 100) * 100, { whole: true });

export function Steps(p: StepsProps) {
  const [step, setStep] = useState(p.gate === "paid" ? 4 : 0);
  const [raw, setRaw] = useState("");
  // The way they used, from the row they tapped; I SENT IT says so.
  const [via, setVia] = useState<Via | null>(null);
  const [copied, setCopied] = useState(false);
  // idle → processing while I SENT IT is being told to the route.
  const [phase, setPhase] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amount: string; via: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cents = parseUsd(raw);
  const valid = cents !== null && cents >= MIN_CENTS && cents <= p.shareCents;
  const bad = raw.trim() !== "" && !valid;
  const share = money(p.shareCents);
  const amount = valid && cents !== null ? money(cents) : null;

  useEffect(() => {
    if (step === 2) inputRef.current?.focus();
  }, [step]);

  // The owner's VIEW AS and STOP THE TEST re-render the page under an open
  // flow (a soft navigation keeps this component's state): when the gate
  // is no longer ok, fall back to the share screen.
  useEffect(() => {
    if (p.gate !== "ok" && step >= 2 && step <= 3) setStep(1);
  }, [p.gate, step]);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const copyZelle = async () => {
    setVia("zelle");
    try {
      await navigator.clipboard.writeText(ZELLE_TO);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no clipboard here — the number is on the screen */
    }
  };

  // I SENT IT: the route emails the owner; nothing is charged or recorded.
  const sent = async () => {
    if (cents === null || phase !== "idle") return;
    setError(null);
    setPhase("processing");
    try {
      const res = await fetch("/api/lasd26/your-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sent", amountCents: cents, via }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; amount?: string; via?: string };
      setPhase("idle");
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That didn’t go through — try again.");
        return;
      }
      setDone({ amount: data.amount ?? amount ?? share, via: data.via ?? "Venmo or Zelle" });
      setStep(4);
    } catch {
      setPhase("idle");
      setError("That didn’t go through — try again.");
    }
  };

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
          {p.testing && <p className="line mono">A test — you’re walking the whole share yourself.</p>}
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
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="step">
          <div className="k mono">You&rsquo;re sending</div>
          <div className="big">{amount}</div>
          <p className="ask">Please send your share by Venmo or Zelle.</p>

          <div className="ways">
            <div className={`way${via === "venmo" ? " on" : ""}`}>
              <span className="w mono">Venmo</span>
              <span className="to">@{VENMO_HANDLE}</span>
              <a className="go mono" href={cents !== null ? venmoPayUrl(cents, "LASD26") : "#"} target="_blank" rel="noopener noreferrer" onClick={() => setVia("venmo")}>
                Open Venmo →
              </a>
            </div>
            <div className={`way${via === "zelle" ? " on" : ""}`}>
              <span className="w mono">Zelle</span>
              <span className="to">{ZELLE_TO}</span>
              <button type="button" className="go mono" onClick={() => void copyZelle()}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {phase === "processing" && (
            <div className="status" role="status" aria-live="polite">
              <span className="bar" aria-hidden="true" />
              <span className="mono">Telling Mikian…</span>
            </div>
          )}
          {p.viewingAs ? (
            <p className="notice">Viewing as {p.viewingAs} — the button is theirs.</p>
          ) : (
            <button type="button" className="btn" disabled={phase !== "idle"} onClick={() => void sent()}>
              {via === "venmo" ? "I sent it by Venmo" : via === "zelle" ? "I sent it by Zelle" : "I sent it"}
            </button>
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

  return (
    <>
      <div className="stage">{screen}</div>
      <div className="dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i === Math.min(step, 3) ? "on" : undefined} />
        ))}
      </div>
    </>
  );
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
