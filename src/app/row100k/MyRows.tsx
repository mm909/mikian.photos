"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  TITLE_MAX,
  clampDay,
  fmtDay,
  nowMs,
  pacificDay,
  fmtDuration,
  fmtMeters,
  fmtSplit,
  parseDurationText,
} from "@/lib/row100k";
import { digitCount } from "@/lib/blackoutRules";
import { Blocks } from "./Blackout";
import { formatTimeDigits } from "./LogRow";
import { Lightbox } from "./Lightbox";
import { SortHeader } from "./LogControls";
import { LogPics, flattenReel, whichPhoto, type LogMedia } from "./LogPics";
import { logTableCss } from "./logTableCss";
import type { LogSortKey, LogView } from "./logSort";
import { PHOTO_CAP, usePhotoPair } from "./PhotoPair";

export type MyRow = {
  id: string;
  day: string;
  meters: number;
  seconds: number;
  title?: string;
  /* Blackout (blackoutRules.ts): the caller has already replaced `meters`
   * with a floor and says how many digits the real number had, so the row
   * draws blocks of the right width and drops the split (time over split
   * is the meters again). The owner and admins never see a masked row —
   * this is for any future read-only host of the table. */
  masked?: boolean;
  digits?: number;
  /* Display URLs for the row's photo pair (rower first) — stable public CDN
   * URLs resolved server-side; absent when the photos can't resolve. */
  photoUrls?: string[];
  /* Same pair with grid-sized thumbs (null only for callers that carry
   * none) — the squares render thumb ?? full, swap to full if the thumb
   * 404s, and the lightbox opens full. */
  photos?: LogMedia[];
};

/* Thumbnails of a row's photo pair — each opens the full image. The edit
 * row's "Current" strip. */
export function RowPhotoThumbs({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <span style={{ display: "flex", gap: 4, marginTop: 4 }}>
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u}
            alt={i === 0 ? "The rower" : "The erg screen"}
            style={{
              display: "block",
              width: 42,
              height: 42,
              objectFit: "cover",
              border: "1px solid var(--line)",
            }}
            loading="lazy"
          />
        </a>
      ))}
    </span>
  );
}

/* A column head: the sortable one (LogControls.SortHeader) when the caller
 * holds a LogView, a plain one otherwise (the dev preview). */
function Head({
  k,
  view,
  onView,
  right,
  children,
}: {
  k: LogSortKey;
  view?: LogView;
  onView?: (v: LogView) => void;
  right?: boolean;
  children: string;
}) {
  if (view && onView) {
    return (
      <SortHeader k={k} view={view} onView={onView} right={right}>
        {children}
      </SortHeader>
    );
  }
  return <th style={right ? { textAlign: "right" } : undefined}>{children}</th>;
}

/* The signed-in rower's own log (admins get the same controls on any
 * rower's page) — ONE TABLE since 2026-09-24 (owner: "Combine the ledger
 * and the table on the profile: one log, keep the table view, show the
 * photos on the table"): the numbers table, sortable by its heads, the
 * photo pair beside the day (owner, 2026-09-25: on the same line as the
 * date and title so the row does not get tall), and a ⋮ menu in the last column
 * with SHARE / EDIT / DELETE. Delete keeps its two-tap confirm inside the
 * menu (SURE? / KEEP); EDIT opens the editor in place as a row of its own
 * — day, meters, time, the title, and a replacement photo pair (owner,
 * same day: "allow users to edit and delete their own rows, not just
 * admin: meters, time, the date, the photos, the title; delete the whole
 * entry" — the rows API already lets the row's owner through, see
 * api/row100k/rows/[id]). */
export function MyRows({
  rows,
  canEdit,
  onShare,
  view,
  onView,
}: {
  rows: MyRow[];
  canEdit: boolean;
  onShare?: (row: MyRow) => void;
  /* The sort (logSort.ts), when the caller draws the distance chips and
   * wants the column heads to sort. */
  view?: LogView;
  onView?: (v: LogView) => void;
}) {
  const router = useRouter();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ day: "", meters: "", time: "", title: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The whole log's photos flattened into ONE lightbox reel — row order as
  // listed, rower before erg within a row. `lightbox` is the flat index of
  // the photo showing, null while closed.
  const [lightbox, setLightbox] = useState<number | null>(null);
  // One replacement strip serves whichever row is being edited — opening an
  // editor clears it, so uploads never leak across rows.
  const replacement = usePhotoPair({
    inputId: "edit-photos",
    emptyLabel: "+ Replace both photos",
  });

  if (rows.length === 0) return null;

  // Per-row media (photos when the caller resolved thumbs, else the legacy
  // full-URL list), plus each row's offset into the reel.
  const mediaOf = (r: MyRow): LogMedia[] =>
    r.photos ?? (r.photoUrls ?? []).map((u) => ({ full: u, thumb: null as string | null }));
  const { reel, offsets } = flattenReel(rows, mediaOf, (r, i) => `${fmtDay(r.day)}${r.title ? ` — ${r.title}` : ""} · ${whichPhoto(i)}`);

  const rail = canEdit || !!onShare;
  const cols = rail ? 5 : 4;

  const closeMenu = () => {
    setMenuFor(null);
    setConfirming(null);
  };

  const toggleMenu = (id: string) => {
    setConfirming(null);
    setMenuFor((prev) => (prev === id ? null : id));
  };

  const startEdit = (r: MyRow) => {
    setError(null);
    closeMenu();
    setEditing(r.id);
    replacement.clear();
    setDraft({
      day: r.day,
      meters: String(r.meters),
      time: fmtDuration(r.seconds),
      title: r.title ?? "",
    });
  };

  const closeEdit = () => {
    setEditing(null);
    replacement.clear();
  };

  const save = async (id: string) => {
    setError(null);
    const meters = Math.round(Number(draft.meters.replace(/[,\s]/g, "")));
    const seconds = parseDurationText(draft.time);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError("How many meters?");
      return;
    }
    if (!seconds) {
      setError("Time looks off — use 20:41 or 1:02:15.");
      return;
    }
    if (replacement.uploading) {
      setError("Hold on — a photo is still uploading.");
      return;
    }
    // Photos are all-or-nothing: leave the strip empty to keep the current
    // pair, or upload a full new pair.
    if (replacement.readyKeys.length !== 0 && replacement.readyKeys.length !== PHOTO_CAP) {
      setError("A replacement needs both photos — you and the screen.");
      return;
    }
    setBusy(id);
    try {
      const body: Record<string, unknown> = { day: draft.day, meters, seconds };
      const trimmedTitle = draft.title.trim();
      if (trimmedTitle) body.title = trimmedTitle;
      if (replacement.readyKeys.length === PHOTO_CAP) body.photos = replacement.readyKeys;
      const res = await fetch(`/api/row100k/rows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        // Only close the editor if it's still on the row we saved — the user
        // may have opened another row's editor while this save was in flight.
        setEditing((prev) => {
          if (prev === id) {
            replacement.clear();
            return null;
          }
          return prev;
        });
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't save that fix — try again.");
      }
    } catch {
      setError("Couldn't save that fix — try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/row100k/rows/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) router.refresh();
      else setError(data.error ?? "Couldn't delete that row — try again.");
    } catch {
      setError("Couldn't delete that row — try again.");
    } finally {
      setBusy(null);
      closeMenu();
    }
  };

  // The live split readout inside the editor line.
  const draftSplit = () => {
    const m = Math.round(Number(draft.meters.replace(/[,\s]/g, "")));
    const s = parseDurationText(draft.time);
    return Number.isFinite(m) && m > 0 && s ? `${fmtSplit(m, s)} /500M` : "— /500M";
  };

  const actBtn = (primary: boolean) => ({
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    background: primary ? "var(--water)" : "transparent",
    color: primary ? "var(--paper)" : "var(--ink)",
    border: `2px solid ${primary ? "var(--water)" : "var(--ink)"}`,
    borderRadius: 0,
    padding: "8px 16px",
    fontFamily: "var(--row-mono),monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  });

  return (
    <div>
      <style>{logTableCss}</style>
      {/* No overflow wrapper around this table on purpose: the ⋮ menu drops
          below its row as an absolutely placed panel, and an overflow-x
          container would clip it. Four narrow columns and a 30px rail fit
          a phone as they are. */}
      <table className="board lgt">
        <thead>
          <tr>
            <Head k="day" view={view} onView={onView}>
              Day
            </Head>
            <Head k="meters" view={view} onView={onView} right>
              Meters
            </Head>
            <Head k="seconds" view={view} onView={onView} right>
              Time
            </Head>
            <Head k="split" view={view} onView={onView} right>
              /500m
            </Head>
            {rail && <th className="lgt-c" aria-label="Row options" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) =>
            editing === r.id ? (
              <tr className="lgt-edit" key={r.id}>
                <td colSpan={cols}>
                  <div className="mlg-editor">
                    {/* Each field under its own mono caps label (owner,
                        2026-09-25: "on the edit screen, use labels for
                        date, meters, time") — .lgt-fld / .lgt-lab in
                        logTableCss.ts. The label wraps the input, so it
                        is the accessible name and a tap on it focuses. */}
                    <div className="mlg-edit-line">
                      <label className="lgt-fld">
                        <span className="lgt-lab">Date</span>
                        <input
                          type="date"
                          value={draft.day}
                          min={FIRST_DAY}
                          /* The server refuses a future day (Pacific today is
                             the line), so the picker stops there too. */
                          max={clampDay(pacificDay(nowMs()))}
                          onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
                        />
                      </label>
                      <label className="lgt-fld">
                        <span className="lgt-lab">Meters</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft.meters}
                          style={{ width: 90 }}
                          onChange={(e) => setDraft((d) => ({ ...d, meters: e.target.value }))}
                        />
                      </label>
                      <label className="lgt-fld">
                        <span className="lgt-lab">Time</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft.time}
                          style={{ width: 90 }}
                          onChange={(e) => setDraft((d) => ({ ...d, time: formatTimeDigits(e.target.value) }))}
                        />
                      </label>
                      <span className="mlg-edit-split">{draftSplit()}</span>
                    </div>
                    <input
                      type="text"
                      aria-label="Title"
                      className="mlg-edit-title"
                      maxLength={TITLE_MAX}
                      placeholder="Title it — “Sunrise 10k”"
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                    {r.photoUrls && r.photoUrls.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          margin: "12px 0 4px",
                          fontFamily: "var(--row-mono),monospace",
                          fontSize: 11,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          color: "var(--gray)",
                        }}
                      >
                        Current <RowPhotoThumbs urls={r.photoUrls} />
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>{replacement.strip}</div>
                    <div className="mlg-edit-acts">
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void save(r.id)}
                        style={{
                          ...actBtn(true),
                          cursor: busy === r.id ? "default" : "pointer",
                          opacity: busy === r.id ? 0.5 : 1,
                        }}
                      >
                        {busy === r.id ? "…" : "save"}
                      </button>
                      <button type="button" onClick={closeEdit} style={actBtn(false)}>
                        cancel
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td className="lgt-day">
                  {/* Date and title stacked, the photo pair BESIDE them
                      (owner, 2026-09-25: "put the pictures on the same
                      line as the date and title so the row doesn't get
                      tall") — .lgt-dayc in logTableCss.ts. */}
                  <span className="lgt-dayc">
                    <span className="lgt-when">
                      {fmtDay(r.day)}
                      {r.title ? <span className="lgt-title">{r.title}</span> : null}
                    </span>
                    <LogPics media={mediaOf(r)} onOpen={(i) => setLightbox(offsets[ri] + i)} />
                  </span>
                </td>
                <td className="num">
                  {r.masked ? (
                    <>
                      <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
                    </>
                  ) : (
                    fmtMeters(r.meters)
                  )}
                </td>
                <td className="num">{fmtDuration(r.seconds)}</td>
                <td className="num" style={{ color: "var(--gray)" }}>
                  {r.masked ? "—" : fmtSplit(r.meters, r.seconds)}
                </td>
                {rail && (
                  <td className="lgt-c">
                    <span className="mlg-anchor">
                      <button
                        type="button"
                        className={menuFor === r.id ? "mlg-dots on" : "mlg-dots"}
                        aria-haspopup="menu"
                        aria-expanded={menuFor === r.id}
                        aria-label="Row options"
                        onClick={() => toggleMenu(r.id)}
                      >
                        ⋮
                      </button>
                      {menuFor === r.id && (
                        <>
                          <span className="mlg-overlay" onClick={closeMenu} aria-hidden="true" />
                          <span className="mlg-menu" role="menu">
                            {onShare && (
                              <button
                                type="button"
                                onClick={() => {
                                  closeMenu();
                                  onShare(r);
                                }}
                              >
                                Share
                              </button>
                            )}
                            {canEdit && (
                              <button type="button" onClick={() => startEdit(r)}>
                                Edit
                              </button>
                            )}
                            {canEdit &&
                              (confirming === r.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={busy === r.id}
                                    onClick={() => void remove(r.id)}
                                  >
                                    {busy === r.id ? "…" : "Sure?"}
                                  </button>
                                  <button type="button" onClick={() => setConfirming(null)}>
                                    Keep
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => setConfirming(r.id)}
                                >
                                  Delete
                                </button>
                              ))}
                          </span>
                        </>
                      )}
                    </span>
                  </td>
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
      {error && <p className="form-err">{error}</p>}
      {lightbox != null && reel.length > 0 && (
        <Lightbox
          photos={reel}
          index={Math.min(lightbox, reel.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
