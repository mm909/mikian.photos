"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* ---- shapes returned by GET /api/admin/orders ---- */
type OrderRow = {
  orderNumber: number;
  orderNumberDisplay: string;
  email: string;
  kind: string;
  amount: number;
  photoCount: number;
  paidAt: string;
  refundedAt: string | null;
  emailSentAt: string | null;
  emailError: string | null;
  simulated: boolean;
  refundable: boolean;
  orderUrl: string;
};
type Stats = {
  count: number;
  grossUsd: number;
  netUsd: number;
  refundedCount: number;
  refundedUsd: number;
};
type ApiResponse = {
  event: { id: string; name: string };
  isOwner: boolean;
  stats: Stats;
  orders: OrderRow[];
};
type RowState = { busy: null | "resend" | "refund"; msg: string | null; error: boolean };

const usd = (n: number) => `$${n.toFixed(2)}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * Orders admin table. Owner gets refund + resend per row; race directors see
 * the same list read-only (the API omits the action affordances for them, and
 * the action routes are owner-gated regardless).
 */
export function OrdersClient({ isOwner, eventName }: { isOwner: boolean; eventName: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rowState, setRowState] = useState<Record<number, RowState>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // `silent` skips the loading flag so the 1-minute auto-refresh doesn't flash
  // the table into a "Loading…" state — it just swaps in fresh rows.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setData((await res.json()) as ApiResponse);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh every 60s so the table stays current without a manual click.
  useEffect(() => {
    const id = setInterval(() => void load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const orders = data?.orders ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.email.toLowerCase().includes(q) ||
        o.orderNumberDisplay.toLowerCase().includes(q) ||
        String(o.orderNumber).includes(q)
    );
  }, [orders, query]);

  function setRow(n: number, patch: Partial<RowState>) {
    setRowState((s) => {
      const prev: RowState = s[n] ?? { busy: null, msg: null, error: false };
      return { ...s, [n]: { ...prev, ...patch } };
    });
  }

  async function resend(o: OrderRow) {
    setRow(o.orderNumber, { busy: "resend", msg: null, error: false });
    try {
      const res = await fetch(`/api/admin/orders/${o.orderNumberDisplay}/resend`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setRow(o.orderNumber, { busy: null, msg: `Sent to ${j.sentTo}`, error: false });
      setData((d) =>
        d
          ? {
              ...d,
              orders: d.orders.map((x) =>
                x.orderNumber === o.orderNumber
                  ? { ...x, emailSentAt: new Date().toISOString(), emailError: null }
                  : x
              ),
            }
          : d
      );
    } catch (e) {
      setRow(o.orderNumber, {
        busy: null,
        msg: e instanceof Error ? e.message : String(e),
        error: true,
      });
    }
  }

  async function refund(o: OrderRow) {
    const ok = window.confirm(
      `Refund ${usd(o.amount)} to ${o.email}?\n\nThis issues a real PayPal refund and can't be undone.`
    );
    if (!ok) return;
    setRow(o.orderNumber, { busy: "refund", msg: null, error: false });
    try {
      const res = await fetch(`/api/admin/orders/${o.orderNumberDisplay}/refund`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setRow(o.orderNumber, { busy: null, msg: `Refunded (${j.status})`, error: false });
      await load(); // refresh stats + the refunded badge
    } catch (e) {
      setRow(o.orderNumber, {
        busy: null,
        msg: e instanceof Error ? e.message : String(e),
        error: true,
      });
    }
  }

  const stats = data?.stats;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 6,
          }}
        >
          {eventName} · Orders
        </div>
        <h1
          style={{
            margin: "0 0 28px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 40,
            letterSpacing: "-.018em",
            color: "var(--ink)",
          }}
        >
          Orders
        </h1>

        {/* Sum stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <StatCard label="Orders" value={stats ? String(stats.count) : "—"} />
          <StatCard label="Gross revenue" value={stats ? usd(stats.grossUsd) : "—"} />
          <StatCard
            label="Refunded"
            value={stats ? `${stats.refundedCount} · ${usd(stats.refundedUsd)}` : "—"}
            muted
          />
          <StatCard label="Net revenue" value={stats ? usd(stats.netUsd) : "—"} strong />
        </div>

        {/* Search + refresh */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order # or email…"
            style={{
              flex: 1,
              maxWidth: 360,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "#fff",
              fontSize: 14,
              color: "var(--ink)",
            }}
          />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void load()}
            disabled={loading}
            title="Refresh"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          {lastUpdated && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Updated{" "}
              {lastUpdated.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "12px 14px",
              border: "1px solid var(--accent)",
              borderRadius: 8,
              color: "var(--accent)",
              background: "rgba(200,64,26,.06)",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
                minWidth: isOwner ? 880 : 720,
              }}
            >
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Buyer</Th>
                  <Th align="right">Photos</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                  {isOwner && <Th align="right">Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={isOwner ? 7 : 6}
                      style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)" }}
                    >
                      {orders.length === 0
                        ? "No orders yet for this run."
                        : "No orders match your search."}
                    </td>
                  </tr>
                )}
                {filtered.map((o) => {
                  const rs = rowState[o.orderNumber];
                  return (
                    <tr
                      key={o.orderNumber}
                      onClick={() => {
                        window.location.href = o.orderUrl;
                      }}
                      style={{
                        borderTop: "1px solid var(--line)",
                        cursor: "pointer",
                      }}
                      title="Open order page"
                    >
                      <Td>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                          {o.orderNumberDisplay}
                        </span>
                        {o.simulated && <Tag>sim</Tag>}
                      </Td>
                      <Td muted>{fmtDate(o.paidAt)}</Td>
                      <Td>
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "bottom",
                          }}
                        >
                          {o.email}
                        </span>
                      </Td>
                      <Td align="right" muted>
                        {o.photoCount}
                      </Td>
                      <Td align="right">
                        <span
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            textDecoration: o.refundedAt ? "line-through" : "none",
                            color: o.refundedAt ? "var(--muted)" : "var(--ink)",
                          }}
                        >
                          {usd(o.amount)}
                        </span>
                      </Td>
                      <Td>
                        {o.refundedAt ? (
                          <Pill tone="accent">Refunded</Pill>
                        ) : (
                          <Pill tone="green">Paid</Pill>
                        )}
                        <div style={{ marginTop: 4 }}>
                          {o.emailError ? (
                            <span
                              style={{ fontSize: 11, color: "var(--accent)" }}
                              title={o.emailError}
                            >
                              ✉ failed
                            </span>
                          ) : o.emailSentAt ? (
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>✉ sent</span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>✉ not sent</span>
                          )}
                        </div>
                      </Td>
                      {isOwner && (
                        <Td align="right" onClick={(e) => e.stopPropagation()}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={smallBtn}
                              disabled={rs?.busy != null}
                              onClick={() => void resend(o)}
                            >
                              {rs?.busy === "resend" ? "Sending…" : "Resend"}
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={smallBtn}
                              disabled={!o.refundable || rs?.busy != null}
                              title={
                                o.refundedAt
                                  ? "Already refunded"
                                  : o.simulated
                                    ? "Simulated order — nothing to refund"
                                    : "Issue a full PayPal refund"
                              }
                              onClick={() => void refund(o)}
                            >
                              {rs?.busy === "refund"
                                ? "Refunding…"
                                : o.refundedAt
                                  ? "Refunded"
                                  : "Refund"}
                            </button>
                          </div>
                          {rs?.msg && (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 11,
                                color: rs.error ? "var(--accent)" : "var(--muted)",
                                maxWidth: 240,
                                marginLeft: "auto",
                              }}
                            >
                              {rs.msg}
                            </div>
                          )}
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
          {filtered.length} of {orders.length}
        </div>

        {!isOwner && (
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
            Viewing as race director — refund and resend are owner-only.
          </p>
        )}
      </div>
    </main>
  );
}

/* ---------- small presentational helpers ---------- */

const smallBtn: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
};

function StatCard({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: strong ? "var(--font-serif)" : "var(--font-sans)",
          fontSize: strong ? 26 : 20,
          fontWeight: 500,
          color: muted ? "var(--muted)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "12px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--muted)",
        background: "var(--cream)",
        fontWeight: 400,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
  onClick,
}: {
  children: React.ReactNode;
  align?: "right";
  muted?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td
      onClick={onClick}
      style={{
        textAlign: align ?? "left",
        padding: "12px 14px",
        color: muted ? "var(--muted)" : "var(--ink)",
        verticalAlign: "top",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "accent" }) {
  const color = tone === "green" ? "var(--green)" : "var(--accent)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color,
        border: `1px solid ${color}`,
        background: "transparent",
      }}
    >
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        marginLeft: 6,
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--muted)",
        background: "var(--cream)",
        border: "1px solid var(--line)",
      }}
    >
      {children}
    </span>
  );
}
