"use client";

import { useState } from "react";
import { DISTANCES, resultsByDistance, type Finisher } from "@/lib/directorStats";
import type { DistanceKey } from "@/lib/gpx";

/**
 * WinnersBoard — real podium + results for the chosen distance. All three
 * Lighthouse races are real; tabs switch between them.
 */
export function WinnersBoard() {
  const [tab, setTab] = useState<DistanceKey>("half");
  const r = resultsByDistance[tab];

  return (
    <div className="card" style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
              <path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M10 14h4M9 20h6M12 14v6" />
            </svg>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>
            Results · {r.total} finishers
          </span>
        </span>
        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 7, overflow: "hidden" }}>
          {DISTANCES.map((d) => (
            <button
              key={d}
              onClick={() => setTab(d)}
              aria-pressed={tab === d}
              style={{
                padding: "5px 11px",
                background: tab === d ? "var(--accent)" : "transparent",
                color: tab === d ? "var(--paper)" : "var(--muted)",
                border: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {resultsByDistance[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {r.podium.map((p, i) => (
          <div
            key={p.bib}
            style={{
              padding: "12px",
              borderRadius: 8,
              background: i === 0 ? "var(--green-bg)" : "var(--cream)",
              border: i === 0 ? "1px solid rgba(58,107,64,.25)" : "1px solid var(--line)",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", color: i === 0 ? "var(--accent)" : "var(--muted)" }}>
              {i + 1}
              {i === 0 ? "ST" : i === 1 ? "ND" : "RD"}
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 15.5, fontWeight: 500, color: "var(--ink)", marginTop: 4, lineHeight: 1.15 }}>{p.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", marginTop: 4 }}>{p.chipTime}</div>
          </div>
        ))}
      </div>

      {/* Top M/F */}
      {(r.topMale || r.topFemale) && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          {r.topMale && <FirstOf label="First man" r={r.topMale} />}
          {r.topFemale && <FirstOf label="First woman" r={r.topFemale} />}
        </div>
      )}

      {/* Table */}
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {r.table.map((row, i) => (
          <div key={row.bib} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{i + 1}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.name}
              {row.city ? <span style={{ color: "var(--warm)", fontSize: 12 }}> · {titleCase(row.city)}</span> : null}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{row.chipTime}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FirstOf({ label, r }: { label: string; r: Finisher }) {
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500, color: "var(--ink)", marginTop: 3 }}>{r.name}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginTop: 2 }}>
        {r.chipTime} · {r.age}
      </div>
    </div>
  );
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
