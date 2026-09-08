"use client";

import { useState } from "react";
import Link from "next/link";
import type { ShirtOrderRow } from "../shirtOrders";

/* THE ORDERS — the owner's review list (owner, 2026-09-08): every shirt
 * on the books with who (linked to their rower page — each order sits on
 * an account), what size, where they stand on the meters, what the month
 * decided, whether it is paid, and a DELIVERED mark for the pick-up.
 * Newest first. Lives on /row100k/shop-admin. */
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

export function OrdersPanel({ orders: initial }: { orders: ShirtOrderRow[] }) {
  const [orders, setOrders] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mark = async (o: ShirtOrderRow) => {
    setBusy(o.id);
    setError(null);
    const delivered = !o.deliveredAt;
    try {
      const res = await fetch("/api/row100k/shirt/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: o.id, delivered }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setOrders((all) =>
          all.map((x) => (x.id === o.id ? { ...x, deliveredAt: delivered ? new Date().toISOString() : null } : x)),
        );
      } else setError(data.error ?? "Couldn't update that.");
    } catch {
      setError("Couldn't update that.");
    }
    setBusy(null);
  };

  const live = orders.filter((o) => o.status !== "cancelled");
  const delivered = live.filter((o) => o.deliveredAt).length;
  const owed = live.filter((o) => o.status === "owed").length;
  const paid = live.filter((o) => o.status === "paid").length;

  return (
    <div className="sh-settle">
      <div className="sec-head">
        <h2>The orders</h2>
        <span className="mono">
          {live.length} {live.length === 1 ? "SHIRT" : "SHIRTS"} · {delivered} DELIVERED
          {owed > 0 ? ` · ${owed} OWE` : ""}
          {paid > 0 ? ` · ${paid} PAID` : ""}
        </span>
      </div>
      {error && <p className="form-err">{error}</p>}
      {live.length === 0 ? (
        <p className="board-empty">NO SHIRTS ON THE BOOKS YET.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th>Rower</th>
                <th>Size</th>
                <th style={{ textAlign: "right" }}>Meters</th>
                <th>State</th>
                <th>Bought</th>
                <th>Delivered</th>
              </tr>
            </thead>
            <tbody>
              {live.map((o) => (
                <tr key={o.id} className={o.deliveredAt ? "fin" : undefined}>
                  <td className="who">
                    <span className="mono" style={{ color: "var(--gray)", fontWeight: 400 }}>
                      {String(o.rowerNumber).padStart(3, "0")} ·{" "}
                    </span>
                    <Link href={`/row100k/r/${o.rowerNumber}`}>{o.name}</Link>
                    {o.email && (
                      <div className="mono" style={{ fontSize: 10, color: "var(--gray)", fontWeight: 400 }}>
                        {o.email}
                      </div>
                    )}
                  </td>
                  <td>
                    <b>{o.size}</b>
                    {o.kind === "preorder" && (
                      <span className="mono" style={{ fontSize: 10, color: "var(--gray)" }}>
                        {" "}
                        PRE
                      </span>
                    )}
                  </td>
                  <td className="num">{o.meters.toLocaleString("en-US")} m</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {o.status === "reserved"
                      ? "RESERVED"
                      : o.status === "free"
                        ? "FREE"
                        : o.status === "owed"
                          ? `OWES $${o.amountUsd}`
                          : o.status === "paid"
                            ? `PAID ${fmtDay(o.paidAt).toUpperCase()}`
                            : o.status.toUpperCase()}
                  </td>
                  <td className="mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                    {fmtDay(o.createdAt).toUpperCase()}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className={o.deliveredAt ? "outline-btn" : "send"}
                      style={{ padding: "6px 10px", fontSize: 11, marginTop: 0, width: "auto", display: "inline-block" }}
                      disabled={busy === o.id}
                      onClick={() => void mark(o)}
                    >
                      {busy === o.id ? "…" : o.deliveredAt ? `DELIVERED ${fmtDay(o.deliveredAt).toUpperCase()} · UNDO` : "MARK DELIVERED"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
