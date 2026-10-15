"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LOOKS, W, loadMarks, palette, type Fonts, type Kit, type Look, type Painter } from "./shareCards";

/* THE FRAME AROUND A STICKER — the tracker's copy of the Hyrox one
 * (src/app/hyrox/[event]/StickerFrame.tsx), generalised: the look row, the
 * canvas, the three exits (the share sheet on a phone, copy where the
 * clipboard can take an image, download always), and the probes. next/font
 * hands out hashed family names, so the real names are read off three
 * probe spans — display (Archivo Black), condensed (Barlow Condensed),
 * mono (IBM Plex Mono) — and handed to the painter with the brand marks as
 * one `kit`.
 *
 * `paint` lays the card out and returns the height it used; it is called
 * once to measure and once to draw, so a sticker is exactly as tall as its
 * content. Anything the page wants above the look row (card, runner and
 * size pickers) comes in as `pickers`.
 *
 * A DECK: `deck` names every slide of the current pick; SHARE ALL hands
 * them to the share sheet together (on a phone, Save Images puts the lot
 * in the camera roll) and DOWNLOAD ALL saves them one after another. Each
 * slide paints on an offscreen canvas in the look on screen. */

export type Deck = (ctx: CanvasRenderingContext2D, look: Look, kit: Kit) => { paint: Painter; name: string }[];

async function loadKit(d: HTMLSpanElement | null, c: HTMLSpanElement | null, m: HTMLSpanElement | null): Promise<Kit> {
  const fonts: Fonts = {
    display: d ? window.getComputedStyle(d).fontFamily : "Impact, sans-serif",
    cond: c ? window.getComputedStyle(c).fontFamily : "sans-serif",
    mono: m ? window.getComputedStyle(m).fontFamily : "monospace",
  };
  const ready = (async () => {
    try {
      await Promise.all([
        document.fonts.load(`400 100px ${fonts.display}`),
        document.fonts.load(`700 100px ${fonts.cond}`),
        document.fonts.load(`600 100px ${fonts.cond}`),
        document.fonts.load(`700 40px ${fonts.mono}`),
        document.fonts.ready,
      ]);
    } catch {
      /* paint in the fallback */
    }
  })();
  const [marks] = await Promise.all([loadMarks(), ready]);
  return { fonts, marks };
}

function render(canvas: HTMLCanvasElement, paint: Painter, look: Look, kit: Kit): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const h = Math.max(1, Math.ceil(paint(ctx, look, kit, false)));
  canvas.width = W;
  canvas.height = h;
  ctx.clearRect(0, 0, W, h);
  const ground = palette(look).ground;
  if (ground) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, h);
  }
  paint(ctx, look, kit, true);
}

const blobOf = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

export function ShareFrame({
  paint,
  filename,
  pickers,
  label,
  deck,
  initialLook = "jf",
}: {
  paint: Painter;
  filename: (look: Look) => string;
  pickers?: ReactNode;
  label: string;
  deck?: Deck;
  initialLook?: Look;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dProbe = useRef<HTMLSpanElement | null>(null);
  const cProbe = useRef<HTMLSpanElement | null>(null);
  const mProbe = useRef<HTMLSpanElement | null>(null);
  const [look, setLook] = useState<Look>(initialLook);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [handheld, setHandheld] = useState(false);

  useEffect(() => {
    const share = typeof navigator.canShare === "function";
    setCanShareFiles(share);
    setCanCopy(typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function" && window.isSecureContext);
    setHandheld(share && !!window.matchMedia?.("(pointer: coarse)").matches);
  }, []);

  const repaint = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const kit = await loadKit(dProbe.current, cProbe.current, mProbe.current);
    /* The pick may have moved on while the fonts loaded. */
    if (canvasRef.current !== canvas) return;
    render(canvas, paint, look, kit);
  }, [paint, look]);

  useEffect(() => {
    void repaint();
  }, [repaint]);

  const name = filename(look);
  const toBlob = () => (canvasRef.current ? blobOf(canvasRef.current) : Promise.resolve(null));

  const download = (blob: Blob, file: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const onDownload = async () => {
    const blob = await toBlob();
    if (!blob) return setMsg("Couldn't make the image");
    download(blob, name);
    setMsg("Saved");
  };
  const onCopy = async () => {
    try {
      const pending = toBlob().then((b) => {
        if (!b) throw new Error("no image");
        return b;
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
      setMsg("Copied — paste it into your story");
    } catch {
      setMsg("Couldn't copy — download instead");
    }
  };
  const onShare = async () => {
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("no image");
      const file = new File([blob], name, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("unsupported");
      await navigator.share({ files: [file] });
      setMsg("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMsg("Sharing isn't available — copy or download");
    }
  };

  /* Every slide of the deck as a file, painted offscreen. */
  const deckFiles = async (): Promise<File[]> => {
    if (!deck) return [];
    const kit = await loadKit(dProbe.current, cProbe.current, mProbe.current);
    const off = document.createElement("canvas");
    const ctx = off.getContext("2d");
    if (!ctx) return [];
    const slides = deck(ctx, look, kit);
    const files: File[] = [];
    for (const s of slides) {
      render(off, s.paint, look, kit);
      const blob = await blobOf(off);
      if (blob) files.push(new File([blob], s.name, { type: "image/png" }));
    }
    return files;
  };
  const onShareAll = async () => {
    setBusy(true);
    try {
      const files = await deckFiles();
      if (!files.length) throw new Error("none");
      if (!navigator.canShare?.({ files })) throw new Error("unsupported");
      await navigator.share({ files });
      setMsg("");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setMsg("Sharing all isn't available here — download all instead");
    }
    setBusy(false);
  };
  const onDownloadAll = async () => {
    setBusy(true);
    const files = await deckFiles();
    for (let i = 0; i < files.length; i++) {
      download(files[i], files[i].name);
      /* Browsers drop downloads fired in the same instant. */
      await new Promise((r) => setTimeout(r, 400));
    }
    setMsg(files.length ? `Saved ${files.length} ${files.length === 1 ? "sticker" : "stickers"}` : "Nothing to save");
    setBusy(false);
  };

  return (
    <div className="shr-stk">
      <span ref={dProbe} aria-hidden className="shr-probe d">
        A
      </span>
      <span ref={cProbe} aria-hidden className="shr-probe c">
        A
      </span>
      <span ref={mProbe} aria-hidden className="shr-probe m">
        A
      </span>
      {pickers}
      <div className="shr-pick looks" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" aria-pressed={look === l.id} onClick={() => setLook(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={W} height={W} aria-label={label} className={look === "clear" ? "clear" : ""} />
      <div className="shr-btns">
        {canShareFiles ? (
          <button type="button" className={handheld ? "primary" : ""} onClick={() => void onShare()}>
            Share
          </button>
        ) : null}
        {canCopy ? (
          <button type="button" onClick={() => void onCopy()}>
            Copy
          </button>
        ) : null}
        <button type="button" className={canShareFiles ? "" : "primary"} onClick={() => void onDownload()}>
          Download
        </button>
      </div>
      {deck ? (
        <div className="shr-btns deck">
          {canShareFiles ? (
            <button type="button" disabled={busy} onClick={() => void onShareAll()}>
              {busy ? "Making…" : "Share all stickers"}
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => void onDownloadAll()}>
            {busy ? "Making…" : "Download all stickers"}
          </button>
        </div>
      ) : null}
      <p className="shr-msg" role="status">
        {msg}
      </p>
    </div>
  );
}
