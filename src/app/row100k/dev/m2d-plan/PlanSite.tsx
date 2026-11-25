"use client";

import { useState } from "react";
import type { M2dPlan } from "../../m2d";

/* THE PLANNER, drawn (page.tsx). The arithmetic is plain: dollars =
 * kilometers × cents ÷ 100, so 1¢ a kilometer is $1 for every 100K meters.
 * The app's twin is M2dPlanner in mobile/src/screens/M2D.tsx. */

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const usd = (d: number) => (d >= 1000 ? `$${num(d)}` : `$${d.toFixed(2)}`);
const cents = (c: number) => (c >= 100 ? `$${(c / 100).toFixed(2)}` : `${Math.round(c * 10) / 10}¢`);
const cost = (meters: number, c: number) => (meters / 1000) * (c / 100);
/* The highest rate a budget covers for some meters, down to the half cent. */
const rateFor = (budget: number, meters: number) => (meters > 0 ? Math.floor(((budget * 100) / (meters / 1000)) * 2) / 2 : 0);

export function PlanSite({ plan: p0 }: { plan: M2dPlan }) {
  const [p, setP] = useState(p0);
  const [rateIn, setRateIn] = useState(String(p0.rate));
  const [budget, setBudget] = useState("1000");
  const [tryRate, setTryRate] = useState("10");
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { low, likely, high } = p.projected;
  const b = Number(budget) || 0;
  const r = Number(tryRate) || 0;

  const save = async () => {
    const n = Number(rateIn);
    setBusy(true);
    setSay(null);
    try {
      const res = await fetch("/api/row100k/app/m2d/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rate: n }) });
      const data = (await res.json().catch(() => ({}))) as M2dPlan & { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setP(data);
        setSay(`Saved. ROWTEMBER gives ${cents(data.rate)} a kilometer, on every meter in the window.`);
      } else setSay(data.error ?? "That did not save.");
    } catch {
      setSay("That did not save.");
    }
    setBusy(false);
  };

  return (
    <>
      <h2>
        So far <i>day {p.window.day} of {p.window.days}</i>
      </h2>
      <dl className="sum">
        <div>
          <dt>Meters in the window</dt>
          <dd>{num(p.soFar.meters)} m</dd>
        </div>
        <div>
          <dt>By registered rowers ({p.soFar.registered})</dt>
          <dd>{num(p.soFar.inMeters)} m</dd>
        </div>
        <div>
          <dt>ROWTEMBER so far, at {cents(p.rate)}/km</dt>
          <dd>{usd(p.soFar.cost)}</dd>
        </div>
      </dl>

      <h2>
        The window, projected <i>{p.basis === "pace" ? "from the pace" : "from history"}</i>
      </h2>
      <dl className="sum">
        {(
          [
            ["Low", low],
            ["Likely", likely],
            ["High", high],
          ] as const
        ).map(([k, m]) => (
          <div key={k}>
            <dt>
              {k}: {num(m)} m
            </dt>
            <dd>{usd(cost(m, p.rate))}</dd>
          </div>
        ))}
      </dl>
      <p>
        High is {p.history.high.label}: {num(p.history.high.meters)} m by {p.history.high.rowers} rowers. Low is {p.history.low.label}:{" "}
        {num(p.history.low.meters)} m by {p.history.low.rowers}. Projected meters are everyone&apos;s; ROWTEMBER pays registered rowers&apos;
        meters only, so these are ceilings.
      </p>

      <h2>
        Each 1¢ a kilometer <i>costs</i>
      </h2>
      <p>
        1¢/km is $1 for every 100K meters. For this window: {usd(cost(low, 1))} low, {usd(cost(likely, 1))} likely, {usd(cost(high, 1))} high.
      </p>

      <h2>Budget → rate</h2>
      <p>
        <label>
          Budget $ <input className="m2-in" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
      </p>
      <dl className="sum">
        <div>
          <dt>Covers, in the high case</dt>
          <dd>{cents(rateFor(b, high))}/km</dd>
        </div>
        <div>
          <dt>Covers, in the likely case</dt>
          <dd>{cents(rateFor(b, likely))}/km</dd>
        </div>
      </dl>

      <h2>Rate → cost</h2>
      <p>
        <label>
          Cents a km <input className="m2-in" inputMode="decimal" value={tryRate} onChange={(e) => setTryRate(e.target.value)} />
        </label>
      </p>
      <dl className="sum">
        <div>
          <dt>Low · likely · high</dt>
          <dd>
            {usd(cost(low, r))} · {usd(cost(likely, r))} · {usd(cost(high, r))}
          </dd>
        </div>
      </dl>

      <h2>
        ROWTEMBER&apos;s rate <i>{cents(p.rate)}/km</i>
      </h2>
      <p>Live at once, no deploy. It applies to every meter in the window, the ones already rowed included.</p>
      <p>
        <label>
          Cents a km <input className="m2-in" inputMode="decimal" value={rateIn} onChange={(e) => setRateIn(e.target.value)} />
        </label>{" "}
        <button type="button" className="m2-go small" onClick={() => void save()} disabled={busy || Number(rateIn) === p.rate}>
          {busy ? "Saving" : "Set the rate"}
        </button>
      </p>
      {say ? <p className="bd-say">{say}</p> : null}
    </>
  );
}
