"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BLACK, YELLOW } from "../theme";

/* THE STICKER (owner, 2026-10-13: "a little sticker shareable that says
 * like Las Vegas Hyrox 2027 or just 27, something like that. With their
 * name and their partner's name and their day. Eventually, when start
 * times are announced, we'll have a sticker for their start time as
 * well").
 *
 * Painted on a canvas, transparent outside the yellow block, so it goes on
 * top of a story the way the Rowtember cards do (share/cards.ts). Two
 * cards: THE RACE — city, year, category, day, the names — and START,
 * which is the same block with the start time huge; it appears once the
 * entry carries one. The same three exits as ShareMenu: the share sheet on
 * a phone, copy where the clipboard can take an image, download always.
 *
 * Fonts: next/font hands out hashed family names, so the real names are
 * read off two probe spans on the page and handed to the painter. */

export type StickerFacts = {
  city: string;
  year: number;
  /* "Women's Pro Doubles". */
  category: string;
  /* "Sat, Mar 13". */
  day: string;
  name: string;
  partners: string[];
  teamName: string;
  startTime: string;
  /* For the file name. */
  slug: string;
};

type Card = "race" | "start";

const W = 1080;
const PAD = 72;

function fit(ctx: CanvasRenderingContext2D, text: string, family: string, max: number, min: number, width: number): number {
  let size = max;
  for (; size > min; size -= 2) {
    ctx.font = `400 ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  return size;
}

/* Lays the card out and paints it; returns the height used so the canvas
 * can be sized to the block. Two passes: measure, then paint. */
function paint(ctx: CanvasRenderingContext2D, facts: StickerFacts, card: Card, fonts: { display: string; cond: string }, draw: boolean): number {
  const inner = W - PAD * 2;
  const up = (s: string) => s.toUpperCase();
  let y = PAD;

  const line = (text: string, family: string, weight: number, size: number, color: string, gapAfter: number, track = 0) => {
    if (draw) {
      ctx.font = `${weight} ${size}px ${family}`;
      ctx.fillStyle = color;
      ctx.textBaseline = "alphabetic";
      if (track) ctx.letterSpacing = `${track}px`;
      ctx.fillText(text, PAD, y + size * 0.86);
      if (track) ctx.letterSpacing = "0px";
    }
    y += size + gapAfter;
  };

  /* HYROX, then the city huge and the year in a box — "Las Vegas Hyrox
   * 2027 or just 27", the owner's own suggestion. */
  line("HYROX", fonts.cond, 700, 40, BLACK, 10, 10);

  const yr = `’${String(facts.year).slice(-2)}`;
  const city = up(facts.city);
  const citySize = fit(ctx, city, fonts.display, 150, 60, inner - 230);
  if (draw) {
    ctx.font = `400 ${citySize}px ${fonts.display}`;
    ctx.fillStyle = BLACK;
    ctx.fillText(city, PAD, y + citySize * 0.86);
    /* The year sits in a black box at the right edge. */
    ctx.font = `400 150px ${fonts.display}`;
    const yw = ctx.measureText(yr).width + 36;
    ctx.fillStyle = BLACK;
    ctx.fillRect(W - PAD - yw, y - 6, yw, 150 + 2);
    ctx.fillStyle = YELLOW;
    ctx.fillText(yr, W - PAD - yw + 18, y + 150 * 0.86 - 4);
  }
  y += Math.max(citySize, 150) + 26;

  /* A rule. */
  if (draw) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(PAD, y, inner, 6);
  }
  y += 6 + 26;

  if (card === "start") {
    /* START — the time, the names small, the day. */
    line("START", fonts.cond, 700, 40, BLACK, 4, 10);
    const t = up(facts.startTime || "TBA");
    const ts = fit(ctx, t, fonts.display, 220, 80, inner);
    line(t, fonts.display, 400, ts, BLACK, 18);
    line(up(facts.day), fonts.cond, 700, 48, BLACK, 22, 4);
    const who = [facts.name, ...facts.partners].filter(Boolean).map(up).join("  ·  ");
    const ws = fit(ctx, who, fonts.cond, 44, 24, inner);
    line(who, fonts.cond, 600, ws, BLACK, 8, 2);
    line(up(facts.category), fonts.cond, 600, 32, "rgba(10,10,10,.7)", 0, 4);
  } else {
    /* THE RACE — category, day, the names. */
    const cat = up(facts.category);
    const cs = fit(ctx, cat, fonts.display, 72, 40, inner);
    line(cat, fonts.display, 400, cs, BLACK, 6);
    line(up(facts.day) + (facts.startTime ? `  ·  ${up(facts.startTime)}` : ""), fonts.cond, 700, 44, BLACK, 26, 4);

    const names = [facts.name, ...facts.partners].filter(Boolean);
    names.forEach((n, i) => {
      const text = (i === 0 ? "" : "& ") + up(n);
      const ns = fit(ctx, text, fonts.display, 92, 44, inner);
      line(text, fonts.display, 400, ns, BLACK, 4);
    });
    if (facts.teamName) {
      y += 8;
      line(up(facts.teamName), fonts.cond, 600, 36, "rgba(10,10,10,.7)", 0, 4);
    }
  }

  return y + PAD;
}

export function Sticker({ facts }: { facts: StickerFacts }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dProbe = useRef<HTMLSpanElement | null>(null);
  const cProbe = useRef<HTMLSpanElement | null>(null);
  const [card, setCard] = useState<Card>("race");
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
    const fonts = {
      display: dProbe.current ? window.getComputedStyle(dProbe.current).fontFamily : "Impact, sans-serif",
      cond: cProbe.current ? window.getComputedStyle(cProbe.current).fontFamily : "sans-serif",
    };
    try {
      await Promise.all([document.fonts.load(`400 100px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.cond}`), document.fonts.ready]);
    } catch {
      /* paint in the fallback */
    }
    const h = Math.ceil(paint(ctx, facts, card, fonts, false));
    canvas.width = W;
    canvas.height = h;
    ctx.clearRect(0, 0, W, h);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(0, 0, W, h);
    paint(ctx, facts, card, fonts, true);
  }, [facts, card]);

  useEffect(() => {
    void repaint();
  }, [repaint]);

  const filename = `hyrox-${facts.slug}-${card}.png`;
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
    a.download = filename;
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
      const file = new File([blob], filename, { type: "image/png" });
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
      {facts.startTime ? (
        <div className="hx-stk-pick" role="tablist" aria-label="Sticker">
          <button type="button" role="tab" aria-pressed={card === "race"} onClick={() => setCard("race")}>
            The race
          </button>
          <button type="button" role="tab" aria-pressed={card === "start"} onClick={() => setCard("start")}>
            Start time
          </button>
        </div>
      ) : null}
      <canvas ref={canvasRef} width={W} height={W} aria-label="Your Hyrox sticker" />
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
        <button type="button" className={handheld || !canShareFiles ? (canShareFiles ? "" : "primary") : ""} onClick={() => void onDownload()}>
          Download
        </button>
      </div>
      <p className="hx-stk-msg">{msg}</p>
    </div>
  );
}
