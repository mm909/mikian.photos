"use client";

import { useState } from "react";
import { PICKUP_LINE, SHIRT_FREE_AT, SHIRT_PRICE_USD, SIZES, shirtDue, type Size, type SizeCount } from "../../shirt";

/* THE SHIRT SHOP (owner, 2026-09-08, dev first). One product photo at a
 * time with a stepper; the price as the headline; BUY NOW, PAY LATER; the
 * sizes SIDE BY SIDE as black boxes with big white letters — the boxes are
 * the picker — and ONE buy button under them. A size that is gone still
 * sells, as a pre-order, and its box says so. Pick-up only. No cancel, no
 * paying early: the month settles it. */

export type MineLite = { size: string; kind: string; status: string; amountUsd: number; paidAt: string | null } | null;

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
  const [shot, setShot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailed, setEmailed] = useState<boolean | null>(null);

  const due = shirtDue(meters);
  const canAct = signedIn && joined;
  const settled = !!mine && mine.status !== "reserved";
  const picked = pick ? counts.find((c) => c.size === pick) : undefined;
  const pickGone = !!picked && picked.left <= 0;
  const isMine = !!mine && mine.size === pick;

  const buy = async () => {
    if (!pick) return;
    setBusy(true);
    setError(null);
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
        emailed?: boolean;
      };
      if (res.ok && data.ok && data.mine) {
        setMine({ ...data.mine, amountUsd: SHIRT_PRICE_USD, paidAt: null });
        setEmailed(data.emailed ?? null);
        if (data.counts) setCounts(data.counts);
      } else setError(data.error ?? "Couldn't take that — try again.");
    } catch {
      setError("Couldn't take that — try again.");
    }
    setBusy(false);
  };

  const buyLabel = !signedIn
    ? "Sign in to buy"
    : !joined
      ? "Opt in to buy"
      : settled
        ? "Settled"
        : !pick
          ? "Pick a size"
          : isMine
            ? `Yours — size ${pick}`
            : pickGone
              ? `Pre-order · ${pick}`
              : `Buy now, pay later · ${pick}`;

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
        <p className="sh-line mono">BUY NOW · PAY LATER</p>
        <p className="sh-copy">
          Buy one now, pay nothing today. At the end of the month it is free if you got the {SHIRT_FREE_AT / 1000}K,
          and ${SHIRT_PRICE_USD} if you did not. It never comes out of your total.
        </p>
        {canAct && <p className="sh-due mono">{due.line}</p>}
        {!signedIn && <p className="sh-due mono">SIGN IN AND OPT IN TO BUY ONE</p>}
        {signedIn && !joined && <p className="sh-due mono">OPT IN TO ROWTEMBER TO BUY ONE</p>}
        <p className="sh-pick mono">{PICKUP_LINE.toUpperCase()}</p>
      </div>

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h2>Sizes</h2>
        <span className="mono">IN STOCK · PRE-ORDERED</span>
      </div>
      <div className="sh-sizes" role="radiogroup" aria-label="Size">
        {SIZES.map((size) => {
          const c = counts.find((x) => x.size === size)!;
          const on = pick === size;
          const gone = c.left <= 0;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={on}
              className={`sh-size${on ? " on" : ""}${mine?.size === size ? " mine" : ""}`}
              disabled={busy || settled}
              onClick={() => setPick(size)}
            >
              <span className="sh-sz">{size}</span>
              <span className="sh-cnt">
                {gone ? <span className="hot">SOLD OUT</span> : `${c.left} IN STOCK`}
                <br />
                {c.preorders > 0 ? <span className="hot">{c.preorders} PRE-ORDERED</span> : "0 PRE-ORDERED"}
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className="sh-buy" disabled={!canAct || !pick || busy || settled || isMine} onClick={() => void buy()}>
        {busy ? "…" : buyLabel}
      </button>
      {pick && pickGone && !isMine && !settled && (
        <p className="sh-buy-note">SIZE {pick} IS SOLD OUT — THIS ONE IS A PRE-ORDER, SHIPS WITH THE NEXT RUN.</p>
      )}
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
              <div className="l mono">{mine.kind === "preorder" ? "PRE-ORDER — SHIPS WITH THE NEXT RUN" : "ON THE SHELF"}</div>
            </div>
            <div className="st-tile">
              <div className="k mono">At the end of the month</div>
              <div className="n">
                {mine.status === "paid" ? "PAID" : mine.status === "free" ? "$0" : due.free ? "$0" : `$${SHIRT_PRICE_USD}`}
              </div>
              <div className="l mono">{mine.status === "reserved" ? due.line : mine.status.toUpperCase()}</div>
            </div>
          </div>
          {emailed !== null && (
            <p className="sh-buy-note">
              {emailed ? "RECEIPT SENT — CHECK YOUR EMAIL." : "RECEIPT COULD NOT BE SENT — YOUR SHIRT IS STILL ON THE LIST."}
            </p>
          )}
          <p className="sh-pick mono">{PICKUP_LINE.toUpperCase()}</p>
        </>
      )}
    </>
  );
}
