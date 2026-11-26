"use client";

import { useState } from "react";
import type { PledgeView } from "../../m2dPledgeActions";
import { PledgeCard, capKmOf, rateWord, type CardStatus } from "./PledgeCard";

/* THE PLEDGE FORM (page.tsx): a rate (25¢, 50¢, $1, or custom), a cap in
 * dollars, the name for the receipts, and the card drawn live as they pick.
 * Saves through api/row100k/m2d/pledge, pending until the owner approves.
 * Below it, the giver's own pledges, each with its fill. */

const RATES = [25, 50, 100];
const CAPS = [100, 250, 500, 1000];
const num = (n: number) => Math.round(n).toLocaleString("en-US");

export const statusOf = (p: PledgeView): CardStatus =>
  p.status === "declined" ? "declined" : p.status === "pending" ? "pending" : p.fill?.filled ? "claimed" : "approved";

export function PledgeSite({ signedIn, signInHref, defaultName, initial }: { signedIn: boolean; signInHref: string; defaultName: string; initial: PledgeView[] }) {
  const pending = initial.find((p) => p.status === "pending");
  const [mine, setMine] = useState(initial);
  const [rate, setRate] = useState<number | "custom">(pending ? (RATES.includes(pending.centsPerKm) ? pending.centsPerKm : "custom") : 100);
  const [customIn, setCustomIn] = useState(pending && !RATES.includes(pending.centsPerKm) ? String(pending.centsPerKm) : "");
  const [capIn, setCapIn] = useState(String(pending?.capDollars ?? 500));
  const [name, setName] = useState(pending?.name ?? defaultName);
  const [note, setNote] = useState(pending?.note ?? "");
  /* Anonymous by default (owner, 2026-11-26). */
  const [anon, setAnon] = useState(pending?.anonymous ?? true);
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState<{ t: string; err?: boolean } | null>(null);

  const cents = rate === "custom" ? Number(customIn) || 0 : rate;
  const cap = Math.floor(Number(capIn.replace(/[^0-9]/g, "")) || 0);
  const ok = cents >= 1 && cents <= 1000 && cap >= 5 && name.trim().length > 0;
  const hasPending = mine.some((p) => p.status === "pending");

  const send = async () => {
    setBusy(true);
    setSay(null);
    try {
      const res = await fetch("/api/row100k/m2d/pledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cents, cap, name: name.trim(), note: note.trim(), anonymous: anon }),
      });
      if (res.status === 401) {
        window.location.href = signInHref;
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; pledges?: PledgeView[] };
      if (res.ok && data.ok) {
        setMine(data.pledges ?? mine);
        setSay({ t: "Sent. We'll look it over and email you when it's approved. It starts counting from then." });
      } else setSay({ t: data.error ?? "That did not send. Try again.", err: true });
    } catch {
      setSay({ t: "That did not send. Try again.", err: true });
    }
    setBusy(false);
  };

  return (
    <>
      <PledgeCard centsPerKm={cents} capDollars={cap} name={anon ? "Anonymous" : name.trim() || undefined} status="preview" />

      <section className="pl-form" aria-label="Your pledge">
        <p className="pl-q">Per kilometer</p>
        <div className="pl-chips" role="radiogroup" aria-label="Per kilometer">
          {RATES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={rate === r} className={rate === r ? "on" : ""} onClick={() => setRate(r)}>
              {rateWord(r)}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={rate === "custom"} className={rate === "custom" ? "on" : ""} onClick={() => setRate("custom")}>
            Other
          </button>
        </div>
        {rate === "custom" ? (
          <label className="pl-in">
            <input
              inputMode="decimal"
              autoFocus
              value={customIn}
              placeholder="10"
              onChange={(e) => setCustomIn(e.target.value.replace(/[^0-9.]/g, ""))}
              aria-label="Cents a kilometer"
            />
            <span>¢ a km</span>
          </label>
        ) : null}

        <p className="pl-q">Up to</p>
        <div className="pl-chips" role="radiogroup" aria-label="Up to">
          {CAPS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cap === c} className={cap === c ? "on" : ""} onClick={() => setCapIn(String(c))}>
              ${num(c)}
            </button>
          ))}
        </div>
        <label className="pl-in">
          <span>$</span>
          <input inputMode="numeric" value={capIn} onChange={(e) => setCapIn(e.target.value.replace(/[^0-9]/g, ""))} aria-label="Your cap in dollars" />
        </label>
        <p className="pl-say">
          {cents > 0 && cap > 0
            ? `${rateWord(cents)} on each of the next ${num(capKmOf(cents, cap))} km rowed after we approve it, until it reaches $${num(cap)} or Dec 24.`
            : "Pick a rate and a cap."}
        </p>

        <p className="pl-q">Your name</p>
        <label className="pl-in">
          <input className="txt" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
        </label>
        <label className="pl-check">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          <span>Give anonymously. The receipts say &ldquo;Anonymous&rdquo;; only Mikian sees your name.</span>
        </label>
        <p className="pl-q">A note for Mikian (optional)</p>
        <label className="pl-in">
          <input className="txt" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-label="A note" />
        </label>

        {signedIn ? (
          <button type="button" className="m2-go" disabled={!ok || busy} onClick={() => void send()}>
            {busy ? "Sending" : hasPending ? "Update my pledge" : "Send my pledge"}
          </button>
        ) : (
          <a className="m2-go" href={signInHref} style={{ textAlign: "center", textDecoration: "none" }}>
            Sign in with Google to pledge
          </a>
        )}
        {say ? <p className={`pl-say${say.err ? " err" : ""}`}>{say.t}</p> : null}
      </section>

      {mine.length > 0 ? (
        <section className="pl-mine m2-worth" aria-label="Your pledges">
          <div className="m2-worth-h">
            <h2>Your pledges</h2>
          </div>
          {[...mine].reverse().map((p) => (
            <PledgeCard key={p.id} centsPerKm={p.centsPerKm} capDollars={p.capDollars} name={p.name} km={p.fill?.km} dollars={p.fill?.dollars} status={statusOf(p)} />
          ))}
        </section>
      ) : null}
    </>
  );
}
