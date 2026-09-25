"use client";

import type { ReactNode } from "react";
import { ELITE_LABEL } from "@/lib/blackoutRules";
import { Blocks } from "../Blackout";
import type { LookPhoto, LookRecord, LookRow } from "./view";

/* THE PIECES the five looks share: the stream card, the record card, the
 * sponsor slot, the eyebrow. A client module because the thumb carries an
 * onError swap; no hooks, so the server page (LookPage.tsx) and the client
 * looks (the stream, the wall) draw the same card. Styles: looksCss.ts,
 * prefix .lk-. */

/* A section title as a mono eyebrow, not a display word (owner, 2026-09-25:
 * quieter, section titles as mono eyebrows — "The month · December
 * 2026"). `aside` sits at the right end of the rule: a count, a link. */
export function Eyebrow({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <p className="lk-eye mono">
      <span>{children}</span>
      {aside != null ? <span className="lk-eye-r">{aside}</span> : null}
    </p>
  );
}

export function photoAlt(row: LookRow, i: number): string {
  return i === 0 ? `${row.name} after the row` : "Erg screen";
}

/* One thumb, the feed's: a bare button around a lazy img on the thumb
 * URL, swapping to the full frame once if the thumb 404s. */
export function Thumb({ photo, alt, onOpen }: { photo: LookPhoto; alt: string; onOpen?: () => void }) {
  return (
    <button type="button" className="lk-pic" onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumb ?? photo.full}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.getAttribute("src") !== photo.full) img.src = photo.full;
        }}
      />
    </button>
  );
}

/* THE LIGHTS OUT mark on the photos' footprint — one of the elite while a
 * window is open (feed/Strips.tsx EliteMark): the word and the two
 * squares of the brand, paper on ink, linking to the elite block. */
export function EliteMark({ href }: { href: string }) {
  return (
    <a className="lk-elite" href={href}>
      <span className="w">{ELITE_LABEL}</span>
      <span className="sq" aria-hidden="true">
        <i />
        <i />
      </span>
    </a>
  );
}

/* The same footprint, bare: hidden by the fail-closed rule, so no word. */
export function HiddenBlock() {
  return <span className="lk-elite lk-hid" role="img" aria-label="hidden" />;
}

/* A row's meters: blocks of the right width while masked. */
export function MetersOf({ row }: { row: LookRow }) {
  return row.masked ? (
    <>
      <Blocks digits={row.digits ?? 1} /> m
    </>
  ) : (
    <>{row.metersStr}</>
  );
}

/* THE STREAM CARD (owner, 2026-09-25: "every entry has a title, a person,
 * a bib, a distance, a time, a pace and two photos"): the two photos side
 * by side on the left, then bib · name and the day on the mono line, the
 * title in grey under it, the meters big and blue, the time and the
 * split small. A masked row draws blocks for the meters, no time, the
 * real split, and the LIGHTS OUT mark where the photos were. */
export function RowCard({
  row,
  eliteHref,
  onOpen,
}: {
  row: LookRow;
  eliteHref: string;
  onOpen?: (photoIndex: number) => void;
}) {
  return (
    <article className="lk-card">
      {row.masked ? (
        row.elite ? (
          <EliteMark href={eliteHref} />
        ) : (
          <HiddenBlock />
        )
      ) : (
        <span className={row.photos.length > 0 ? "lk-pics" : "lk-pics none"}>
          {row.photos.length > 0 ? (
            row.photos.slice(0, 2).map((p, i) => (
              // Index key: two demo squares in one row can share a colour.
              <Thumb key={i} photo={p} alt={photoAlt(row, i)} onOpen={onOpen ? () => onOpen(i) : undefined} />
            ))
          ) : (
            <span className="lk-noph">—</span>
          )}
        </span>
      )}
      <span className="lk-mid">
        <span className="lk-who mono">
          <span className="n">{row.numStr} ·</span>
          <a href={`/row100k/r/${row.rowerNumber}`}>{row.name}</a>
          <span className="day">{row.today ? "TODAY" : row.dayStr}</span>
        </span>
        {row.title ? <span className="lk-ttl mono">{row.title}</span> : null}
        <span className="lk-m">
          <MetersOf row={row} />
        </span>
        <span className="lk-sub mono">
          {row.durationStr ? <span>{row.durationStr}</span> : null}
          <span className="s">{row.splitStr} /500m</span>
        </span>
      </span>
    </article>
  );
}

/* THE RECORD CARD inside the stream (owner, 2026-09-25: "a new fastest
 * 10K, men's and women's, with the time"): this month's fastest 10K per
 * division, the time in ink, the holder and their pace on the line. A
 * division nobody has rowed 10K in yet prints a dash. Times are public
 * whatever the blackout says (owner, 2026-09-08). */
export function RecordCard({
  records,
  monthLabel,
}: {
  records: { men: LookRecord | null; women: LookRecord | null };
  monthLabel: string;
}) {
  const line = (label: string, r: LookRecord | null) => (
    <div className="lk-rec-line">
      <span className="lk-rec-div mono">{label}</span>
      {r ? (
        <>
          <span className="lk-rec-t">{r.timeStr}</span>
          <span className="lk-rec-who mono">
            {r.numStr} · <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a> · {r.splitStr} pace · {r.dayStr}
          </span>
        </>
      ) : (
        <span className="lk-rec-t dim">—</span>
      )}
    </div>
  );
  return (
    <aside className="lk-card lk-rec">
      <Eyebrow aside={<a href="/row100k/records/10000">All</a>}>Fastest 10K · {monthLabel}</Eyebrow>
      {line("Men", records.men)}
      {line("Women", records.women)}
    </aside>
  );
}

/* THE SPONSOR SLOT, a placeholder (owner, 2026-09-25: "in future an ad or
 * sponsor card"): marked as such, an empty dashed frame where the card
 * will go, nothing else on it. */
export function SponsorCard() {
  return (
    <aside className="lk-card lk-spon">
      <Eyebrow>Sponsor · placeholder</Eyebrow>
      <div className="lk-spon-box" aria-hidden="true" />
    </aside>
  );
}
