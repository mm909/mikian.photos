"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ELITE_LABEL } from "@/lib/blackoutRules";
import { Lightbox, type LightboxPhoto } from "../Lightbox";
import { Eyebrow, RowCard, photoAlt } from "./pieces";
import { WALL_BATCH, type LookRow } from "./view";

/* THE PHOTO WALL (owner, 2026-09-25: "for the person who mostly wants the
 * pictures"): every photo of every followed row as one dense grid, two
 * tiles per row, the bib and the meters on each tile. A tap on a tile
 * brings that row's stream card up in a sheet at the foot of the screen
 * (the card, the photos in it opening the lightbox); a masked row is one
 * ink tile wearing the LIGHTS OUT mark, its photos never sent. The wall
 * grows WALL_BATCH tiles at a time as its foot scrolls into view, and
 * every img is lazy, so 400 friends do not fetch a month of photos on
 * load. */

type Tile =
  | { kind: "photo"; row: LookRow; i: number; key: string }
  | { kind: "elite"; row: LookRow; key: string };

function tilesOf(rows: LookRow[]): Tile[] {
  const out: Tile[] = [];
  for (const r of rows) {
    if (r.masked) {
      out.push({ kind: "elite", row: r, key: r.id });
      continue;
    }
    r.photos.slice(0, 2).forEach((_, i) => out.push({ kind: "photo", row: r, i, key: `${r.id}:${i}` }));
  }
  return out;
}

export function Wall({ rows, eliteHref, todayStr }: { rows: LookRow[]; eliteHref: string; todayStr: string }) {
  const tiles = useMemo(() => tilesOf(rows), [rows]);
  const [shown, setShown] = useState(WALL_BATCH);
  const [picked, setPicked] = useState<LookRow | null>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const foot = useRef<HTMLDivElement | null>(null);

  // Grow when the foot comes into view; a browser without the observer
  // gets the SHOW MORE word under the wall instead.
  useEffect(() => {
    const el = foot.current;
    if (!el || shown >= tiles.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((s) => Math.min(tiles.length, s + WALL_BATCH));
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, tiles.length]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  const reel: LightboxPhoto[] = useMemo(
    () => (picked ? picked.photos.map((p, i) => ({ full: p.full, alt: photoAlt(picked, i) })) : []),
    [picked],
  );

  const visible = tiles.slice(0, shown);
  const more = tiles.length - visible.length;

  return (
    <section className="lk-wallsec">
      <Eyebrow aside={<span>{tiles.length} photos</span>}>The wall · {todayStr}</Eyebrow>
      {tiles.length === 0 ? (
        <p className="lk-empty mono">No photos from the people you follow yet.</p>
      ) : (
        <div className="lk-wall">
          {visible.map((t) =>
            t.kind === "elite" ? (
              <a key={t.key} className="lk-tile dark" href={eliteHref}>
                {ELITE_LABEL}
              </a>
            ) : (
              <button
                key={t.key}
                type="button"
                className={picked && picked.id === t.row.id ? "lk-tile on" : "lk-tile"}
                onClick={() => setPicked(picked && picked.id === t.row.id ? null : t.row)}
                aria-label={`${t.row.numStr} ${t.row.name}, ${t.row.metersStr}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.row.photos[t.i].thumb ?? t.row.photos[t.i].full}
                  alt={photoAlt(t.row, t.i)}
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const full = t.row.photos[t.i].full;
                    if (img.getAttribute("src") !== full) img.src = full;
                  }}
                />
                <span className="lb mono">
                  {t.row.numStr} · {t.row.metersStr}
                </span>
              </button>
            ),
          )}
        </div>
      )}
      <div ref={foot} className="lk-foot" aria-hidden="true" />
      {more > 0 ? (
        <p className="lk-more mono">
          <button type="button" className="lk-word" onClick={() => setShown((s) => s + WALL_BATCH)}>
            Show more
          </button>
          <span className="dim"> · {more} left</span>
        </p>
      ) : null}

      {picked ? (
        <div className="lk-sheet" role="dialog" aria-label={`${picked.numStr} ${picked.name}`}>
          <div className="wrap front">
            <p className="lk-sheet-top mono">
              <span>The row</span>
              <button type="button" className="lk-word" onClick={() => setPicked(null)}>
                Close
              </button>
            </p>
            <RowCard row={picked} eliteHref={eliteHref} onOpen={(i) => setIdx(i)} />
          </div>
        </div>
      ) : null}

      {idx != null && reel.length > 0 && (
        <Lightbox photos={reel} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </section>
  );
}
