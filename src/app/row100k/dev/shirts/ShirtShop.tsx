"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  PICKUP_LINE,
  PRICE_LINE,
  SHIRT_FREE_AT,
  SHIRT_PRICE_USD,
  SIZES,
  boxLine,
  shirtDue,
  type Size,
  type SizeCount,
} from "../../shirt";

/* THE SHIRT SHOP (owner, 2026-09-08, dev first). One product photo at a
 * time with a stepper, centred in the measure; the price as the headline;
 * the sizes SIDE BY SIDE as black boxes with big white letters — the boxes
 * are the picker — and ONE button under them. Each box carries one line:
 * what is left, or, once the shelf is bare, how many are pre-ordered.
 *
 * Signed in and on the account: the boxes are inert until the viewer is
 * signed in and opted in (the button says so and does it), and the order
 * lands on their participant row. One shirt per rower: with a shirt, the
 * picked size is pre-selected and the button never says BUY again —
 * another box turns it into CHANGE SIZE, then a YES / KEEP pair, and the
 * change re-deals the shelf and sends the size-change note. No cancel, no
 * paying early: the month settles it. */

export type MineLite = { size: string; kind: string; status: string; amountUsd: number; paidAt: string | null } | null;

const SHOP_PATH = "/row100k/dev/shirts";

export function ShirtShop({
  photos,
  counts: initialCounts,
  mine: initialMine,
  meters,
  joined,
  signedIn,
}: {
  photos: { full: string; thumb: string }[];
  counts: SizeCount[];
  mine: MineLite;
  meters: number;
  joined: boolean;
  signedIn: boolean;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState<MineLite>(initialMine);
  const [pick, setPick] = useState<Size | null>((initialMine?.size as Size) ?? null);
  /* The size a CHANGE SIZE press is waiting on a YES for. */
  const [confirmFor, setConfirmFor] = useState<Size | null>(null);
  const [shot, setShot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const due = shirtDue(meters);
  const canAct = signedIn && joined;
  const settled = !!mine && mine.status !== "reserved";
  const picked = pick ? counts.find((c) => c.size === pick) : undefined;
  const pickGone = !!picked && picked.left <= 0;
  const isMine = !!mine && mine.size === pick;
  const changing = !!mine && !settled && !!pick && !isMine;
  const confirming = changing && confirmFor === pick;

  const choose = (size: Size) => {
    setPick(size);
    setConfirmFor(null);
    setError(null);
  };

  const keep = () => {
    if (mine) setPick(mine.size as Size);
    setConfirmFor(null);
  };

  const buy = async () => {
    if (!pick) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/row100k/shirt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: pick }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        mine?: { size: string; kind: string; status: string };
        counts?: SizeCount[];
        changed?: boolean;
        emailed?: boolean;
      };
      if (res.ok && data.ok && data.mine) {
        setMine({ ...data.mine, amountUsd: SHIRT_PRICE_USD, paidAt: null });
        setPick(data.mine.size as Size);
        setConfirmFor(null);
        if (data.counts) setCounts(data.counts);
        setNote(
          data.changed
            ? data.emailed
              ? `SIZE CHANGED TO ${data.mine.size} — EMAIL SENT.`
              : `SIZE CHANGED TO ${data.mine.size} — THE EMAIL COULD NOT BE SENT.`
            : data.emailed
              ? "RECEIPT SENT — CHECK YOUR EMAIL."
              : "RECEIPT COULD NOT BE SENT — YOUR SHIRT IS STILL ON THE LIST.",
        );
      } else setError(data.error ?? "Couldn't take that — try again.");
    } catch {
      setError("Couldn't take that — try again.");
    }
    setBusy(false);
  };

  /* The one button, by state. Signed out and not opted in are live
   * buttons that do the thing; with a shirt it never says BUY. */
  let action: JSX.Element;
  if (!signedIn) {
    action = (
      <button type="button" className="sh-buy" onClick={() => signIn("google", { callbackUrl: SHOP_PATH })}>
        Sign in to buy
      </button>
    );
  } else if (!joined) {
    action = (
      <Link className="sh-buy" href="/row100k#join">
        Opt in to buy
      </Link>
    );
  } else if (settled && mine) {
    action = (
      <button type="button" className="sh-buy" disabled>
        Size {mine.size} — settled
      </button>
    );
  } else if (confirming && pick) {
    action = (
      <div className="sh-confirm">
        <button type="button" className="sh-buy" disabled={busy} onClick={() => void buy()}>
          {busy ? "…" : pickGone ? `Yes, pre-order ${pick}` : `Yes, size ${pick}`}
        </button>
        <button type="button" className="sh-buy keep" disabled={busy} onClick={keep}>
          Keep {mine?.size}
        </button>
      </div>
    );
  } else if (changing && pick) {
    action = (
      <button type="button" className="sh-buy" disabled={busy} onClick={() => setConfirmFor(pick)}>
        Change size → {pick}
      </button>
    );
  } else if (mine) {
    action = (
      <button type="button" className="sh-buy" disabled>
        Yours — size {mine.size}
      </button>
    );
  } else if (!pick) {
    action = (
      <button type="button" className="sh-buy" disabled>
        Pick a size
      </button>
    );
  } else {
    action = (
      <button type="button" className="sh-buy" disabled={busy} onClick={() => void buy()}>
        {busy ? "…" : pickGone ? `Pre-order · ${pick}` : `Buy now, pay later · ${pick}`}
      </button>
    );
  }

  return (
    <>
      {photos.length > 0 && (
        <div className="sh-photo">
          <img src={photos[shot].full} alt={`The Rowtember shirt, photo ${shot + 1} of ${photos.length}`} />
          {photos.length > 1 && (
            <>
              <button type="button" className="sh-nav prev" aria-label="Previous photo" onClick={() => setShot((s) => (s - 1 + photos.length) % photos.length)}>
                ‹
              </button>
              <button type="button" className="sh-nav next" aria-label="Next photo" onClick={() => setShot((s) => (s + 1) % photos.length)}>
                ›
              </button>
              <div className="sh-dots" aria-hidden="true">
                {shot + 1} / {photos.length}
              </div>
            </>
          )}
        </div>
      )}

      <div className="sh-pitch">
        <p className="sh-kick mono">THE ROWTEMBER SHIRT</p>
        <h3 className="sh-price">
          ${SHIRT_PRICE_USD} <span className="or">or</span> {SHIRT_FREE_AT.toLocaleString("en-US")} m
        </h3>
        <p className="sh-copy">{PRICE_LINE}</p>
        <p className="sh-line mono">BUY NOW · PAY LATER</p>
        {canAct && <p className="sh-due mono">{due.line}</p>}
        <p className="sh-pick mono">{PICKUP_LINE.toUpperCase()}</p>
      </div>

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h2>Sizes</h2>
        <span className="mono">ONE PER ROWER</span>
      </div>
      <div className="sh-sizes" role="radiogroup" aria-label="Size">
        {SIZES.map((size) => {
          const c = counts.find((x) => x.size === size)!;
          const on = pick === size;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={on}
              className={`sh-size${on ? " on" : ""}${mine?.size === size ? " mine" : ""}`}
              disabled={!canAct || busy || settled}
              onClick={() => choose(size)}
            >
              <span className="sh-sz">{size}</span>
              <span className="sh-cnt">{c.left > 0 ? boxLine(c) : <span className="hot">{boxLine(c)}</span>}</span>
            </button>
          );
        })}
      </div>

      {action}
      {note && <p className="sh-buy-note">{note}</p>}
      {error && <p className="form-err">{error}</p>}

      {mine && (
        <>
          <div className="sec-head" style={{ marginTop: 40 }}>
            <h2>Your shirt</h2>
            <span className="mono">
              {mine.status === "paid"
                ? "PAID"
                : mine.status === "free"
                  ? "FREE — YOU GOT THE 100K"
                  : mine.status === "owed"
                    ? `$${SHIRT_PRICE_USD} DUE`
                    : mine.kind === "preorder"
                      ? "PRE-ORDER · YOURS"
                      : "YOURS"}
            </span>
          </div>
          <div className="st-tiles">
            <div className="st-tile you">
              <div className="k mono">Size</div>
              <div className="n">{mine.size}</div>
              <div className="l mono">{mine.kind === "preorder" ? "PRE-ORDER — WITH THE NEXT RUN" : "ON THE SHELF"}</div>
            </div>
            <div className="st-tile">
              <div className="k mono">At the end of the month</div>
              <div className="n">
                {mine.status === "paid" ? "PAID" : mine.status === "free" ? "$0" : due.free ? "$0" : `$${SHIRT_PRICE_USD}`}
              </div>
              <div className="l mono">{mine.status === "reserved" ? due.line : mine.status.toUpperCase()}</div>
            </div>
          </div>
          <p className="sh-pick mono">{PICKUP_LINE.toUpperCase()}</p>
        </>
      )}
    </>
  );
}
