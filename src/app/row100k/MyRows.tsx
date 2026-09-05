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
import { Lightbox, type LightboxPhoto } from "./Lightbox";
import { PHOTO_CAP, usePhotoPair } from "./PhotoPair";

export type MyRow = {
  id: string;
  day: string;
  meters: number;
  seconds: number;
  title?: string;
  /* Blackout (blackoutRules.ts): the caller has already replaced `meters`
   * with a floor and says how many digits the real number had, so the strip
   * draws blocks of the right width and drops the split (time over split
   * is the meters again). The owner and admins never see a masked row —
   * this is for any future read-only host of the ledger. */
  masked?: boolean;
  digits?: number;
  /* Display URLs for the row's photo pair (rower first) — stable public CDN
   * URLs resolved server-side; absent when the photos can't resolve. */
  photoUrls?: string[];
  /* Same pair with grid-sized thumbs (null only for callers that carry
   * none) — the ledger squares render thumb ?? full, swap to full if the
   * thumb 404s, and the lightbox opens full. */
  photos?: { full: string; thumb: string | null }[];
};

/* Thumbnails of a row's photo pair — each opens the full image. Shared by
 * the edit drawer's "Current" strip here and the public log table (rendered
 * server-side there with the same markup). */
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

/* The ledger strip's 64px photo pair — thumbnail-sized sources, falling back
 * to the full frame once if a thumb 404s (the server emits thumb URLs
 * without an existence check so it never has to list the bucket), and a
 * click opens the shared lightbox over the whole log's photos (buttons, not
 * links — the divider the theme draws between paired anchors is re-applied
 * inline on the second image). */
function LedgerPics({
  media,
  onOpen,
}: {
  media: { full: string; thumb: string | null }[];
  onOpen: (i: number) => void;
}) {
  return (
    <span className="mlg-pics">
      {media.map((m, i) => (
        <button
          key={i}
          type="button"
          aria-label={i === 0 ? "View photo — the rower" : "View photo — the erg screen"}
          onClick={() => onOpen(i)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            display: "block",
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
            src={m.thumb ?? m.full}
            alt={i === 0 ? "The rower" : "The erg screen"}
            loading="lazy"
            style={i > 0 ? { borderLeft: "1px solid var(--frame)" } : undefined}
            onError={(e) => {
              const img = e.currentTarget;
              // The raw attribute, not .src: the getter resolves URLs and
              // would never compare equal to a data: or relative value.
              if (img.getAttribute("src") !== m.full) img.src = m.full;
            }}
          />
        </button>
      ))}
    </span>
  );
}

/* The signed-in rower's own log, newest first (admins get the same controls
 * on any rower's page) — the photo ledger: each row is an ink-bordered strip
 * with the photo pair at the left, the numbers scannable in the middle, and
 * a ⋮ menu on a dashed rail. SHARE / EDIT / DELETE live in the menu; delete
 * keeps its two-tap confirm inside the menu (SURE? / KEEP), and editing
 * expands the strip in place. */
export function MyRows({
  rows,
  canEdit,
  onShare,
}: {
  rows: MyRow[];
  canEdit: boolean;
  onShare?: (row: MyRow) => void;
}) {
  const router = useRouter();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ day: "", meters: "", time: "", title: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The whole log's photos flattened into ONE lightbox set — row order as
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
  // full-URL list), plus each row's offset into the flattened lightbox set.
  const rowMedia = rows.map(
    (r) =>
      r.photos ??
      (r.photoUrls ?? []).map((u) => ({ full: u, thumb: null as string | null })),
  );
  const flatPhotos: LightboxPhoto[] = [];
  const rowOffsets: number[] = [];
  for (const media of rowMedia) {
    rowOffsets.push(flatPhotos.length);
    for (let i = 0; i < media.length; i++) {
      flatPhotos.push({
        full: media[i].full,
        alt: i === 0 ? "The rower" : "The erg screen",
      });
    }
  }

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

  return (
    <div style={{ marginTop: 30 }}>
      {rows.map((r, ri) =>
        editing === r.id ? (
          <div className="mlg-strip" key={r.id}>
            <div className="mlg-editor">
              <div className="mlg-edit-line">
                <input
                  type="date"
                  aria-label="Day"
                  value={draft.day}
                  min={FIRST_DAY}
                  /* The server refuses a future day (Pacific today is the
                     line), so the picker stops there too. */
                  max={clampDay(pacificDay(nowMs()))}
                  onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Meters"
                  placeholder="Meters"
                  value={draft.meters}
                  style={{ width: 90 }}
                  onChange={(e) => setDraft((d) => ({ ...d, meters: e.target.value }))}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Time"
                  placeholder="Time"
                  value={draft.time}
                  style={{ width: 90 }}
                  onChange={(e) => setDraft((d) => ({ ...d, time: formatTimeDigits(e.target.value) }))}
                />
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
                    appearance: "none",
                    WebkitAppearance: "none",
                    background: "var(--water)",
                    color: "#fff",
                    border: "2px solid var(--water)",
                    borderRadius: 0,
                    padding: "8px 16px",
                    fontFamily: "var(--row-mono),monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    cursor: busy === r.id ? "default" : "pointer",
                    opacity: busy === r.id ? 0.5 : 1,
                  }}
                >
                  {busy === r.id ? "…" : "save"}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  style={{
                    appearance: "none",
                    WebkitAppearance: "none",
                    background: "transparent",
                    color: "var(--ink)",
                    border: "2px solid var(--ink)",
                    borderRadius: 0,
                    padding: "8px 16px",
                    fontFamily: "var(--row-mono),monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mlg-strip" key={r.id}>
            {rowMedia[ri].length > 0 ? (
              <LedgerPics
                media={rowMedia[ri]}
                onOpen={(i) => setLightbox(rowOffsets[ri] + i)}
              />
            ) : (
              <span className="mlg-noph" aria-hidden="true">
                —
              </span>
            )}
            <span className="mlg-mid">
              <span className="mlg-meta">
                <span>{fmtDay(r.day)}</span>
                {r.title ? <span>{r.title}</span> : null}
              </span>
              <span className="mlg-nums">
                <span className="mlg-m">
                  {r.masked ? (
                    <>
                      <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
                    </>
                  ) : (
                    fmtMeters(r.meters)
                  )}
                </span>
                <span className="mlg-t">{fmtDuration(r.seconds)}</span>
                {!r.masked && <span className="mlg-s">{fmtSplit(r.meters, r.seconds)} /500M</span>}
              </span>
            </span>
            {(canEdit || onShare) && (
              <span className="mlg-rail">
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
                      <span
                        className="mlg-overlay"
                        onClick={closeMenu}
                        aria-hidden="true"
                      />
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
              </span>
            )}
          </div>
        ),
      )}
      {error && <p className="form-err">{error}</p>}
      {lightbox != null && flatPhotos.length > 0 && (
        <Lightbox
          photos={flatPhotos}
          index={Math.min(lightbox, flatPhotos.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
