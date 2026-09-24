"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDay, fmtDuration, fmtMeters } from "@/lib/row100k";
import { useCardsOff } from "../../../RowSite";
import { TextMenu } from "../../../TextMenu";
import { availableCards, prepareCard, type ShareCard, type ShareData, type ShareFonts } from "../../../share/cards";
import type { ShareRow } from "../shareData";

/* THE MASTER SHAREABLES (owner, 2026-09-24: "a page where you can go to
 * get all the copy-pasteable shareables: the ones you'd have for your
 * profile — meters this month, meters this day, the bests — and also
 * select a row and share based on that row's stats"). Every card the
 * dialog would offer this rower, laid out at once and painted here in the
 * browser, the way the dialog paints its one (ShareMenu.tsx): wait for the
 * webfonts, read the hashed families off two probe spans, prepareCard,
 * card.draw onto a canvas the size of the card. COPY and DOWNLOAD under
 * each are the dialog's own two exits, and SHARE joins them where the
 * browser has a share sheet. The dialog itself is untouched — the share
 * buttons on the profile and the log still open it (owner, same day:
 * "keep the existing share buttons working as they are"). */

type Best = { label: string; value: string; place?: number | null; shape?: string };

/* Cards with no person on them, which anyone may take away: named without
 * a rower number, as the dialog names them (ShareMenu.tsx ANYONES). The
 * two race day event cards never reach this page — the rower's own deck
 * carries MY WAVE only (shareables/waveShare.ts) — but the rule is kept so
 * a download here is called what a download there is called. */
const ANYONES = new Set(["rowtember-raceday-bill", "rowtember-raceday-name"]);

function filenameOf(card: ShareCard, rowerNumber: number): string {
  const mine = !ANYONES.has(card.id) && !card.id.startsWith("rowtember-community");
  return mine ? `rowtember-${rowerNumber}-${card.id}.png` : `${card.id}.png`;
}

/* Usage ping, fired only AFTER an action actually succeeded, so the owner
 * can see which cards get used (the dialog's own, ShareMenu.tsx). Strictly
 * fire-and-forget. */
function track(card: ShareCard, action: "share" | "copy" | "download", rowerNumber: number) {
  try {
    void fetch("/api/row100k/share-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, action, rowerNumber }),
      keepalive: true,
    }).catch(() => {
      /* analytics never gets to break sharing */
    });
  } catch {
    /* fetch itself unavailable — same policy */
  }
}

type Exits = { share: boolean; copy: boolean };

/* One card: painted once the fonts are in, its three exits under it. */
function Cell({ card, data, fonts, exits }: { card: ShareCard; data: ShareData; fonts: React.RefObject<ShareFonts | null>; exits: Exits }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<{ kind: "done" | "error"; message: string } | null>(null);

  const paint = useCallback(async () => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      await document.fonts.ready;
    } catch {
      /* older browsers just paint in the fallback */
    }
    // The race cards carry the house mark: same capped wait as the dialog.
    await prepareCard(card, data);
    canvas.width = card.width;
    canvas.height = card.height;
    ctx.clearRect(0, 0, card.width, card.height);
    try {
      card.draw(ctx, data, fonts.current ?? { black: "sans-serif", mono: "monospace" });
    } catch (err) {
      console.error(`shareables: ${card.id} failed to paint`, err);
    }
  }, [card, data, fonts]);

  useEffect(() => {
    void paint();
  }, [paint]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = ref.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });
  const filename = filenameOf(card, data.rowerNumber);

  async function onCopy() {
    // Safari wants the write to START inside the click gesture, so hand
    // ClipboardItem a promise; Chromiums that predate promise items get the
    // awaited-blob fallback (the dialog's two-step).
    try {
      const pending = toBlob().then((b) => {
        if (!b) throw new Error("no image");
        return b;
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
      track(card, "copy", data.rowerNumber);
      setStatus({ kind: "done", message: "COPIED" });
    } catch {
      try {
        const blob = await toBlob();
        if (!blob) throw new Error("no image");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        track(card, "copy", data.rowerNumber);
        setStatus({ kind: "done", message: "COPIED" });
      } catch {
        setStatus({ kind: "error", message: "COULD NOT COPY" });
      }
    }
  }

  async function onDownload() {
    const blob = await toBlob();
    if (!blob) return setStatus({ kind: "error", message: "NO IMAGE" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    track(card, "download", data.rowerNumber);
    setStatus({ kind: "done", message: "SAVED" });
  }

  async function onShare() {
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("no image");
      const file = new File([blob], filename, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("unsupported");
      await navigator.share({ files: [file] });
      track(card, "share", data.rowerNumber);
      setStatus(null);
    } catch (err) {
      // Dismissing the share sheet is a choice, not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus({ kind: "error", message: "NO SHARE SHEET" });
    }
  }

  return (
    <div className="shp-card">
      <div className="shp-lab">
        <span>{card.labelFor?.(data) ?? card.label}</span>
        <span className="sz">
          {card.width}×{card.height}
        </span>
      </div>
      <div className={`share-stage${card.light ? " dark" : ""}`}>
        <canvas ref={ref} className="share-canvas" aria-label={`${card.label} preview`} />
      </div>
      <div className="shp-acts">
        {exits.share ? (
          <button type="button" className="shp-act" onClick={onShare}>
            Share
          </button>
        ) : null}
        {exits.copy ? (
          <button type="button" className="shp-act" onClick={onCopy}>
            Copy
          </button>
        ) : null}
        <button type="button" className="shp-act" onClick={onDownload}>
          Download
        </button>
        {status ? <span className={status.kind === "error" ? "shp-status bad" : "shp-status"}>{status.message}</span> : null}
      </div>
    </div>
  );
}

function Grid({ cards, data, fonts, exits }: { cards: ShareCard[]; data: ShareData; fonts: React.RefObject<ShareFonts | null>; exits: Exits }) {
  return (
    <div className="shp-grid">
      {cards.map((c) => (
        <Cell key={c.id} card={c} data={data} fonts={fonts} exits={exits} />
      ))}
    </div>
  );
}

function Eyebrow({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="pf-eye">
      <span>{left}</span>
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

export function ShareGrid({
  data,
  bests,
  rows,
  initialRowId,
  base,
  periodLabel,
}: {
  data: ShareData;
  bests: Best[];
  rows: ShareRow[];
  /* ?row= on the page, so a link to one row lands with it picked. */
  initialRowId: string | null;
  /* This page with the month query it already carries, for the row lines. */
  base: string;
  periodLabel: string;
}) {
  /* THE SWITCHES (rowSettings cards.off): the cards the owner turned off
   * come out of every pool here, exactly as the dialog drops them. */
  const off = useCardsOff();
  const pool = useCallback((d: ShareData) => availableCards(d).filter((c) => !off.includes(c.id)), [off]);

  /* The two probe spans the painter reads the hashed font families off. */
  const fonts = useRef<ShareFonts | null>(null);
  const blackProbe = useRef<HTMLSpanElement | null>(null);
  const monoProbe = useRef<HTMLSpanElement | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fonts.current = {
      black: blackProbe.current ? window.getComputedStyle(blackProbe.current).fontFamily : "sans-serif",
      mono: monoProbe.current ? window.getComputedStyle(monoProbe.current).fontFamily : "monospace",
    };
    setReady(true);
  }, []);

  // Resolved after mount, never during render: the server cannot know
  // whether this browser has a share sheet or a writable clipboard.
  // Clipboard needs a secure context; on plain http COPY hides instead of
  // failing (the dialog's rule).
  const [exits, setExits] = useState<Exits>({ share: false, copy: false });
  useEffect(() => {
    setExits({
      share: typeof navigator.canShare === "function",
      copy: typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function" && window.isSecureContext,
    });
  }, []);

  /* THE PROFILE SET: what the profile SHARE button offers — the totals,
   * today, the month, the wave, the logo. */
  const profileCards = useMemo(() => pool(data), [pool, data]);
  const profileIds = useMemo(() => new Set(profileCards.map((c) => c.id)), [profileCards]);

  /* THE BESTS: the best card once per best the rower holds. */
  const bestCards = useMemo(
    () => bests.map((best) => ({ best, cards: pool({ ...data, best }).filter((c) => c.id === "rowtember-best") })).filter((b) => b.cards.length > 0),
    [pool, data, bests],
  );

  /* A ROW: the picked row, and the cards it unlocks that the profile set
   * does not already carry. */
  const [rowId, setRowId] = useState<string | null>(initialRowId && rows.some((r) => r.id === initialRowId) ? initialRowId : (rows[0]?.id ?? null));
  const row = rows.find((r) => r.id === rowId) ?? null;
  const rowData = useMemo<ShareData | null>(() => (row ? { ...data, row: { day: row.day, meters: row.meters, seconds: row.seconds, title: row.title } } : null), [data, row]);
  const rowCards = useMemo(() => (rowData ? pool(rowData).filter((c) => !profileIds.has(c.id)) : []), [pool, rowData, profileIds]);
  const rowOptions = rows.map((r) => ({
    key: r.id,
    label: `${fmtDay(r.day)} · ${fmtMeters(r.meters)} · ${fmtDuration(r.seconds)}`,
    href: `${base}${base.includes("?") ? "&" : "?"}row=${encodeURIComponent(r.id)}`,
    soft: true,
  }));

  return (
    <>
      <span ref={blackProbe} aria-hidden className="share-probe blk" />
      <span ref={monoProbe} aria-hidden className="share-probe mono" />

      <div className="shp-sec">
        <Eyebrow left="The profile" right={periodLabel} />
        {profileCards.length === 0 ? (
          <p className="shp-empty">NOTHING TO SHARE YET — LOG A ROW.</p>
        ) : ready ? (
          <Grid cards={profileCards} data={data} fonts={fonts} exits={exits} />
        ) : null}
      </div>

      <div className="shp-sec">
        <Eyebrow left="The bests" right={periodLabel} />
        {bestCards.length === 0 ? (
          <p className="shp-empty">NO BESTS YET.</p>
        ) : ready ? (
          <div className="shp-grid">
            {bestCards.map(({ best, cards }) =>
              cards.map((c) => <Cell key={`${best.label}-${c.id}`} card={c} data={{ ...data, best }} fonts={fonts} exits={exits} />),
            )}
          </div>
        ) : null}
      </div>

      <div className="shp-sec shp-rows">
        <Eyebrow
          left="A row"
          right={
            rows.length > 0 && row ? (
              <TextMenu options={rowOptions} value={row.id} ariaLabel="Which row" align="right" onPick={setRowId} />
            ) : (
              periodLabel
            )
          }
        />
        {!row ? (
          <p className="shp-empty">NO ROWS THIS MONTH.</p>
        ) : rowCards.length === 0 ? (
          <p className="shp-empty">THE ROW CARDS ARE SWITCHED OFF.</p>
        ) : ready && rowData ? (
          <>
            {row.title ? <p className="shp-note">{row.title}</p> : null}
            <Grid cards={rowCards} data={rowData} fonts={fonts} exits={exits} />
          </>
        ) : null}
      </div>
    </>
  );
}
