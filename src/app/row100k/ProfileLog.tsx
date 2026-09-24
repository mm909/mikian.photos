"use client";

import { useMemo, useState } from "react";
import { BlockClock, Blocks } from "./Blackout";
import { Lightbox } from "./Lightbox";
import { LogControls, SortHeader } from "./LogControls";
import { LogPics, flattenReel, whichPhoto, type LogMedia } from "./LogPics";
import { logTableCss } from "./logTableCss";
import { DEFAULT_LOG_VIEW, applyLogView, type LogView } from "./logSort";

/* The public log on a rower's profile: ONE TABLE (owner, 2026-09-24:
 * "Combine the ledger and the table on the profile: one log, keep the
 * table view, show the photos on the table") — the clean numbers table
 * with the photo pair as a strip of squares under the day. The TABLE /
 * PHOTOS tabs and the card-per-session view are gone with it. The server
 * hands in display-ready strings; this component only lays them out.
 *
 * Blackout: a row that arrives `masked` carries NO meters, time or split
 * string at all (none of the numbers may reach the browser) — just how
 * many digits the meters had and the silhouette of the time, so the blocks
 * are the width the numbers would have been. The split goes entirely:
 * with either of the other two it is the third.
 *
 * Photos: the squares show the grid thumb, swap to the full frame once if
 * the thumb 404s, and a tap opens the shared Lightbox on the full frame —
 * the same reel the feed uses, every photo on the page in log order. */

export type ProfileLogPhoto = LogMedia;

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
  return `${r.dayStr}${r.title ? ` — ${r.title}` : ""} · ${whichPhoto(i)}`;
}

export function ProfileLog({ rows }: { rows: ProfileLogRow[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  // The sort and the distance sift (owner, 2026-09-10) — the same controls
  // the rower's own log has; the heads sort, the chips sift.
  const [logView, setLogView] = useState<LogView>(DEFAULT_LOG_VIEW);
  const shown = useMemo(() => applyLogView(rows, logView), [rows, logView]);

  // One reel for the whole log (rows in the order SHOWN, rower before erg
  // within a row); offsets[i] is row i's first photo in it.
  const { reel, offsets } = useMemo(() => flattenReel(shown, (r) => r.photos, photoAlt), [shown]);

  return (
    <>
      <style>{logTableCss}</style>
      <LogControls rows={rows} shown={shown} view={logView} onView={setLogView} />

      {shown.length === 0 ? (
        <p className="board-empty">NOTHING AT THAT DISTANCE YET.</p>
      ) : (
        <table className="board lgt">
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
            {shown.map((r, ri) => (
              <tr key={r.id}>
                <td className="lgt-day">
                  {r.dayStr}
                  {r.title ? <div className="lgt-title">{r.title}</div> : null}
                  <LogPics
                    media={r.photos}
                    onOpen={(i) => setLightbox(offsets[ri] + i)}
                    altFor={(i) => photoAlt(r, i)}
                  />
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
                <td className="num">{r.masked ? <BlockClock shape={r.timeShape} /> : r.durationStr}</td>
                <td className="num" style={{ color: "var(--gray)" }}>
                  {r.masked ? "—" : r.splitStr}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
