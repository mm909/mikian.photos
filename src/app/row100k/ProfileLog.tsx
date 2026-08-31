"use client";

import { useState } from "react";

/* The public log on a rower's profile, two ways: TABLE — the clean numbers
 * table (owner call, cycle 6: this view stays exactly as it was) — and
 * PHOTOS, a card per session with the pair they posted. The server hands in
 * display-ready strings; this component only switches shape. */

export type ProfileLogRow = {
  id: string;
  dayStr: string;
  title: string;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  photoUrls: string[];
};

export function ProfileLog({ rows }: { rows: ProfileLogRow[] }) {
  const [view, setView] = useState<"table" | "photos">("table");

  return (
    <>
      <div className="tabs" role="group" aria-label="Log view">
        {(["table", "photos"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? "on" : undefined}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      {view === "table" ? (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th>Day</th>
                <th style={{ textAlign: "right" }}>Meters</th>
                <th style={{ textAlign: "right" }}>Time</th>
                <th style={{ textAlign: "right" }}>/500m</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.dayStr}
                    {r.title ? (
                      <div
                        className="mono"
                        style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}
                      >
                        {r.title}
                      </div>
                    ) : null}
                  </td>
                  <td className="num">{r.metersStr}</td>
                  <td className="num">{r.durationStr}</td>
                  <td className="num" style={{ color: "var(--gray)" }}>
                    {r.splitStr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {rows.map((r) => (
            <article className="plog-card" key={r.id}>
              <div className="plog-top">
                <span>{r.dayStr.toUpperCase()}</span>
                <span>{r.splitStr} /500M</span>
              </div>
              {r.title ? <p className="plog-title">{r.title}</p> : null}
              <div className="plog-nums">
                <span className="plog-m">{r.metersStr}</span>
                <span className="plog-time">{r.durationStr}</span>
              </div>
              {r.photoUrls.length > 0 ? (
                <div className={`plog-photos${r.photoUrls.length === 1 ? " one" : ""}`}>
                  {r.photoUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      // Demo color squares can repeat a URL within a pair, so
                      // the index still rides along for uniqueness.
                      key={`${url}#${i}`}
                      src={url}
                      alt={`${r.dayStr}${r.title ? ` — ${r.title}` : ""} · ${i === 0 ? "the rower" : "the erg screen"}`}
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : (
                <p className="plog-nopics">NO PHOTOS ON THIS ONE.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
