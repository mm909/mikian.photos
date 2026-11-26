"use client";

import { useState } from "react";
import type { PledgeView } from "../../m2dPledgeActions";
import { PledgeCard } from "../../m2d/pledge/PledgeCard";
import { statusOf } from "../../m2d/pledge/PledgeSite";

/* The owner's list, drawn (page.tsx): each pledge's card, who sent it and
 * when, and Approve / Decline. Saves through api/row100k/m2d/pledges. */

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) : "";
const usd = (d: number) => `$${d.toLocaleString("en-US", { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const NAMES: Record<string, string> = { candlelighters: "Candlelighters", shine: "Shine A Light", inclusion: "Project Inclusion" };

export function PledgeAdmin({ initial }: { initial: PledgeView[] }) {
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [say, setSay] = useState<string | null>(null);

  const act = async (id: string, action: "approve" | "decline") => {
    if (action === "decline" && !window.confirm("Decline this pledge? It stops counting.")) return;
    setBusy(id);
    setSay(null);
    try {
      const res = await fetch("/api/row100k/m2d/pledges", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; pledges?: PledgeView[] };
      if (res.ok && data.ok && data.pledges) {
        setList(data.pledges);
        setSay(action === "approve" ? "Approved. It counts from now, and the welcome email is on its way." : "Declined.");
      } else setSay(data.error ?? "That did not save.");
    } catch {
      setSay("That did not save.");
    }
    setBusy(null);
  };

  const group = (title: string, items: PledgeView[], empty: string) => (
    <section className="m2-worth" aria-label={title}>
      <div className="m2-worth-h">
        <h2>{title}</h2>
        <span className="m2-quiet">{items.length}</span>
      </div>
      {items.length === 0 ? <p className="pl-say">{empty}</p> : null}
      {items.map((p) => (
        <div key={p.id}>
          <PledgeCard centsPerKm={p.centsPerKm} capDollars={p.capDollars} name={p.name} km={p.fill?.km} dollars={p.fill?.dollars} status={statusOf(p)} />
          <p className="pl-who">
            <b>{p.email}</b>
            {p.anonymous ? " · anonymous" : " · named"} · sent {when(p.createdAt)}
            {p.decidedAt ? ` · ${p.status} ${when(p.decidedAt)}` : ""}
            {p.welcomeSentAt ? " · welcome sent" : p.status === "approved" ? " · welcome NOT sent yet" : ""}
            {p.doneSentAt ? ` · total sent ${when(p.doneSentAt)}` : ""}
            <br />
            Receipts: {p.line}
            {p.note ? (
              <>
                <br />
                Note: “{p.note}”
              </>
            ) : null}
          </p>
          {p.fill && p.fill.dollars > 0 ? (
            <p className="pl-split">
              {Object.entries(p.fill.split)
                .filter(([, d]) => d > 0)
                .map(([k, d]) => `${NAMES[k] ?? k} ${usd(d)}`)
                .join(" · ")}
            </p>
          ) : null}
          {p.status !== "declined" ? (
            <div className="pl-acts">
              {p.status === "pending" ? (
                <button type="button" className="yes" disabled={busy !== null} onClick={() => void act(p.id, "approve")}>
                  {busy === p.id ? "Saving" : "Approve"}
                </button>
              ) : null}
              <button type="button" disabled={busy !== null} onClick={() => void act(p.id, "decline")}>
                Decline
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );

  return (
    <div className="pl-admin">
      {say ? <p className="pl-say err">{say}</p> : null}
      {group("To review", list.filter((p) => p.status === "pending"), "Nothing waiting.")}
      {group("Approved", list.filter((p) => p.status === "approved"), "None yet.")}
      {group("Declined", list.filter((p) => p.status === "declined"), "None.")}
    </div>
  );
}
