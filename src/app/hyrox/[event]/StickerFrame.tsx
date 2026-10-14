"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LOOKS, W, palette, type Fonts, type Look } from "./stickerPaint";

/* THE FRAME AROUND A STICKER: the look picker, the canvas, the three
 * exits (the share sheet on a phone, copy where the clipboard can take
 * an image, download always — the ShareMenu way), and the font probes.
 * next/font hands out hashed family names, so the real names are read
 * off two probe spans and handed to the painter.
 *
 * `paint` lays the card out and returns the height it used; it is called
 * once to measure and once to draw, so a sticker is exactly as tall as
 * its content. Anything a sticker wants above the look picker (a card or
 * a day picker) comes in as `pickers`. */

export type Painter = (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean) => number;

export function StickerFrame({ paint, filename, pickers, label }: { paint: Painter; filename: (look: Look) => string; pickers?: ReactNode; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dProbe = useRef<HTMLSpanElement | null>(null);
  const cProbe = useRef<HTMLSpanElement | null>(null);
  const [look, setLook] = useState<Look>("yellow");
  const [msg, setMsg] = useState("");
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fonts: Fonts = {
      display: dProbe.current ? window.getComputedStyle(dProbe.current).fontFamily : "Impact, sans-serif",
      cond: cProbe.current ? window.getComputedStyle(cProbe.current).fontFamily : "sans-serif",
    };
    try {
      await Promise.all([document.fonts.load(`400 100px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.cond}`), document.fonts.ready]);
    } catch {
      /* paint in the fallback */
    }
    const h = Math.ceil(paint(ctx, look, fonts, false));
    canvas.width = W;
    canvas.height = h;
    ctx.clearRect(0, 0, W, h);
    const ground = palette(look).ground;
    if (ground) {
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, W, h);
    }
    paint(ctx, look, fonts, true);
  }, [paint, look]);

  useEffect(() => {
    void repaint();
  }, [repaint]);

  const name = filename(look);
  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      c.toBlob(resolve, "image/png");
    });

  const onDownload = async () => {
    const blob = await toBlob();
    if (!blob) return setMsg("Couldn't make the image");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="hx-stk">
      <span ref={dProbe} aria-hidden className="hx-probe d">
        A
      </span>
      <span ref={cProbe} aria-hidden className="hx-probe c">
        A
      </span>
      {pickers}
      <div className="hx-stk-pick" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" aria-pressed={look === l.id} onClick={() => setLook(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={W} height={W} aria-label={label} className={look.startsWith("clear") ? "clear" : ""} />
      <div className="hx-stk-btns">
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
      <p className="hx-stk-msg">{msg}</p>
    </div>
  );
}
