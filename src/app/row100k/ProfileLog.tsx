"use client";

import { useMemo, useState } from "react";
import { BlockClock, Blocks } from "./Blackout";
import { Lightbox, type LightboxPhoto } from "./Lightbox";
import { LogControls, SortHeader } from "./LogControls";
import { DEFAULT_LOG_VIEW, applyLogView, type LogView } from "./logSort";

/* The public log on a rower's profile, two ways: TABLE — the clean numbers
 * table (owner call, cycle 6: this view stays exactly as it was) — and
 * PHOTOS, a card per session with the pair they posted. The server hands in
 * display-ready strings; this component only switches shape.
 *
 * Blackout: a row that arrives `masked` carries NO meters, time or split
 * string at all (none of the numbers may reach the browser) — just how
 * many digits the meters had and the silhouette of the time, so the blocks
 * are the width the numbers would have been. The split goes entirely:
 * with either of the other two it is the third.
 *
 * Photos: the cards used to pull every row's full frame (400-500 KB each),
 * so a busy rower's page cost tens of megabytes to scroll. Now the card
 * shows the grid thumb, swaps to the full frame once if the thumb 404s,
 * and a tap opens the shared Lightbox on the full frame — the same reel
 * the feed uses, every photo on the page in log order. */

export type ProfileLogPhoto = { full: string; thumb: string | null };

export type ProfileLogRow = {
  id: string;
  /* "2026-09-04" — for the sort (logSort.ts). Dates are public. */
  day: string;
  dayStr: string;
  title: string;
  /* The numbers, for sorting and the distance chips (logSort.ts) — absent
   * while masked, so a hidden rower's rows sort last and match no
   * distance; nothing hidden reaches the browser through these either. */
  meters?: number;
  seconds?: number;
  /* "" while masked. */
  metersStr: string;
  /* "" while masked. */
  durationStr: string;
  /* "" while masked. */
  splitStr: string;
  /* Rower photo first; empty when the row has none. */
  photos: ProfileLogPhoto[];
  /* Blackout (blackoutRules.ts): the numbers are hidden — `digits` blocks
   * for the meters, `timeShape` ("#:##:##") for the time. */
  masked?: boolean;
  digits?: number;
  timeShape?: string;
};

function photoAlt(r: ProfileLogRow, i: number): string {
  return `${r.dayStr}${r.title ? ` — ${r.title}` : ""} · ${i === 0 ? "the rower" : "the erg screen"}`;
}

export function ProfileLog({ rows }: { rows: ProfileLogRow[] }) {
  const [view, setView] = useState<"table" | "photos">("table");
  const [lightbox, setLightbox] = useState<number | null>(null);
  // The sort and the distance sift (owner, 2026-09-10) — the same controls
  // the rower's own log has; both shapes below draw the sifted rows.
  const [logView, setLogView] = useState<LogView>(DEFAULT_LOG_VIEW);
  const shown = useMemo(() => applyLogView(rows, logView), [rows, logView]);

  // One reel for the whole log (rows in the order SHOWN, rower before erg
  // within a row); offsets[i] is row i's first photo in it.
  const { reel, offsets } = useMemo(() => {
    const reel: LightboxPhoto[] = [];
    const offsets: number[] = [];
    for (const r of shown) {
      offsets.push(reel.length);
      r.photos.forEach((p, i) => reel.push({ full: p.full, alt: photoAlt(r, i) }));
    }
    return { reel, offsets };
  }, [shown]);

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

      <LogControls rows={rows} shown={shown} view={logView} onView={setLogView} sortChips={view === "photos"} />

      {view === "table" ? (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <SortHeader k="day" view={logView} onView={setLogView}>
                  Day
                </SortHeader>
                <SortHeader k="meters" view={logView} onView={setLogView} right>
                  Meters
                </SortHeader>
                <SortHeader k="seconds" view={logView} onView={setLogView} right>
                  Time
                </SortHeader>
                <SortHeader k="split" view={logView} onView={setLogView} right>
                  /500m
                </SortHeader>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
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
                  <td className="num">
                    {r.masked ? (
                      <>
                        <Blocks digits={r.digits ?? 1} /> m
                      </>
                    ) : (
                      r.metersStr
                    )}
                  </td>
                  <td className="num">
                    {r.masked ? <BlockClock shape={r.timeShape} /> : r.durationStr}
                  </td>
                  <td className="num" style={{ color: "var(--gray)" }}>
                    {r.masked ? "—" : r.splitStr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {shown.map((r, ri) => (
            <article className="plog-card" key={r.id}>
              <div className="plog-top">
                <span>{r.dayStr.toUpperCase()}</span>
                <span>{r.masked ? "BLACKOUT" : `${r.splitStr} /500M`}</span>
              </div>
              {r.title ? <p className="plog-title">{r.title}</p> : null}
              <div className="plog-nums">
                <span className="plog-m">
                  {r.masked ? (
                    <>
                      <Blocks digits={r.digits ?? 1} /> m
                    </>
                  ) : (
                    r.metersStr
                  )}
                </span>
                <span className="plog-time">
                  {r.masked ? <BlockClock shape={r.timeShape} /> : r.durationStr}
                </span>
              </div>
              {r.photos.length > 0 ? (
                <div className={`plog-photos${r.photos.length === 1 ? " one" : ""}`}>
                  {r.photos.map((p, i) => (
                    /* Buttons, not links: the tap opens the reel, it does not
                     * leave the page. Index in the key — demo colour squares
                     * can repeat a URL within a pair. */
                    <button
                      key={`${p.full}#${i}`}
                      type="button"
                      aria-label={`View photo — ${i === 0 ? "the rower" : "the erg screen"}`}
                      onClick={() => setLightbox(offsets[ri] + i)}
                      style={{
                        appearance: "none",
                        WebkitAppearance: "none",
                        display: "block",
                        width: "100%",
                        padding: 0,
                        margin: 0,
                        border: 0,
                        borderRadius: 0,
                        background: "none",
                        cursor: "pointer",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumb ?? p.full}
                        alt={photoAlt(r, i)}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          // The raw attribute, not .src: the getter resolves
                          // URLs and would never compare equal to a data: or
                          // relative value. Swap once — a dead full frame
                          // must not loop.
                          if (img.getAttribute("src") !== p.full) img.src = p.full;
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="plog-nopics">NO PHOTOS ON THIS ONE.</p>
              )}
            </article>
          ))}
        </div>
      )}

      {lightbox != null && reel.length > 0 && (
        <Lightbox
          photos={reel}
          index={Math.min(lightbox, reel.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
