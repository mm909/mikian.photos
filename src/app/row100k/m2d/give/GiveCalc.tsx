"use client";

import { useState } from "react";

/* THE GIFT CALCULATOR (owner, 2026-11-25: "they can put in, I want to give
 * $20, and they can see how that increases the cent ... how many cents do
 * you want to buy?"). Two ways in: dollars, or cents a kilometer. The
 * arithmetic is the page's price (row100k/m2d.ts m2dPrice): a cent a
 * kilometer costs `centAt` dollars over the whole of M2D, on the likely
 * case. Nothing is sent from here. */

const money = (d: number) => (d >= 1000 ? `$${Math.round(d).toLocaleString("en-US")}` : `$${d.toFixed(d % 1 ? 2 : 0)}`);
const cent = (c: number) => `${Math.round(c * 100) / 100}¢`;

export function GiveCalc({ centAt, perKm }: { centAt: number; perKm: number }) {
  const [by, setBy] = useState<"usd" | "cents">("usd");
  const [usdIn, setUsdIn] = useState("20");
  const [centsIn, setCentsIn] = useState("1");
  const dollars = by === "usd" ? Math.max(0, Number(usdIn) || 0) : Math.max(0, Number(centsIn) || 0) * centAt;
  const adds = centAt > 0 ? dollars / centAt : 0;
  return (
    <section className="m2-calc" aria-label="What your gift adds">
      <div className="m2-calc-by" role="radiogroup" aria-label="Give by">
        <button type="button" role="radio" aria-checked={by === "usd"} className={by === "usd" ? "on" : undefined} onClick={() => setBy("usd")}>
          I want to give
        </button>
        <button type="button" role="radio" aria-checked={by === "cents"} className={by === "cents" ? "on" : undefined} onClick={() => setBy("cents")}>
          I want to add cents
        </button>
      </div>
      {by === "usd" ? (
        <label className="m2-calc-in">
          <span>$</span>
          <input inputMode="decimal" value={usdIn} onChange={(e) => setUsdIn(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Dollars" />
        </label>
      ) : (
        <label className="m2-calc-in">
          <input inputMode="decimal" value={centsIn} onChange={(e) => setCentsIn(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Cents a kilometer" />
          <span>¢ a km</span>
        </label>
      )}
      <dl className="m2-calc-out">
        {by === "usd" ? (
          <div>
            <dt>Adds about</dt>
            <dd>{cent(adds)} a km</dd>
          </div>
        ) : (
          <div>
            <dt>Costs about</dt>
            <dd>{money(dollars)}</dd>
          </div>
        )}
        <div>
          <dt>Every kilometer worth</dt>
          <dd>
            {cent(perKm)} → <b>{cent(perKm + adds)}</b>
          </dd>
        </div>
      </dl>
    </section>
  );
}
