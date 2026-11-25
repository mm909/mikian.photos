"use client";

import { useState } from "react";

/* THE PLEDGE CALCULATOR (owner, 2026-11-25: "pledge X cents up to a cap.
 * $1 $75"): cents a kilometer in; what it comes to at the best guess, and
 * the most it can come to (the cap). Nothing is sent from here. */

const money = (d: number) => (d >= 1000 ? `$${Math.round(d).toLocaleString("en-US")}` : `$${d.toFixed(d % 1 ? 2 : 0)}`);
const cent = (c: number) => `${Math.round(c * 100) / 100}¢`;

export function GiveCalc({ likely, cap, perKm }: { likely: number; cap: number; perKm: number }) {
  const [centsIn, setCentsIn] = useState("1");
  const c = Math.max(0, Number(centsIn) || 0);
  return (
    <section className="m2-calc" aria-label="What your pledge comes to">
      <p className="m2-calc-q">I want to pledge</p>
      <label className="m2-calc-in">
        <input inputMode="decimal" value={centsIn} onChange={(e) => setCentsIn(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Cents a kilometer" />
        <span>¢ a km</span>
      </label>
      <dl className="m2-calc-out">
        <div>
          <dt>Best guess</dt>
          <dd>about {money(Math.min(c * cap, c * likely))}</dd>
        </div>
        <div>
          <dt>Never more than</dt>
          <dd>
            <b>{money(c * cap)}</b>
          </dd>
        </div>
        <div>
          <dt>Every kilometer worth</dt>
          <dd>
            {cent(perKm)} → <b>{cent(perKm + c)}</b>
          </dd>
        </div>
      </dl>
    </section>
  );
}
