"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BLACK, YELLOW } from "../theme";

/* THE STICKER (owner, 2026-10-13: "a little sticker shareable that says
 * like Las Vegas Hyrox 2027 or just 27, something like that. With their
 * name and their partner's name and their day. Eventually, when start
 * times are announced, we'll have a sticker for their start time as
 * well").
 *
 * Painted on a canvas. THREE LOOKS (owner, 2026-10-13: "shareable with a
 * transparent background and black and yellow text, or like one with
 * black text, one with yellow text. And then also with the opaque
 * background. So both of them"): YELLOW — the opaque yellow block, black
 * type; BLACK — the same type on nothing, for a light story; CLEAR YELLOW
 * — yellow type on nothing, for a dark one. The year sits in a box whose
 * colours flip with the look. Two cards: THE RACE — city, year, category,
 * day, the names — and START, the same block with the start time huge,
 * once the entry carries one. The same three exits as ShareMenu: the share
 * sheet on a phone, copy where the clipboard can take an image, download
 * always.
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
  startTime: string;
  /* For the file name. */
  slug: string;
};

type Card = "race" | "start";
type Look = "yellow" | "black" | "clear";

const LOOKS: { id: Look; label: string }[] = [
  { id: "yellow", label: "Yellow" },
  { id: "black", label: "Black on clear" },
  { id: "clear", label: "Yellow on clear" },
];

const W = 1080;
const PAD = 72;
/* The year's type size and the room above and below it inside its box
 * (owner, 2026-10-13: "the top part of the 27 doesn't have enough
 * margin"). Anton's figures stand nearly the full em, so the box is cut
 * from the baseline, not the em box. */
const YEAR = 150;
const YEAR_PAD = 26;

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
function paint(
  ctx: CanvasRenderingContext2D,
  facts: StickerFacts,
  card: Card,
  look: Look,
  fonts: { display: string; cond: string },
  draw: boolean,
): number {
  const inner = W - PAD * 2;
  const up = (s: string) => s.toUpperCase();
  /* The type colour, the box behind the year and the year's colour. */
  const ink = look === "clear" ? YELLOW : BLACK;
  const box = look === "clear" ? YELLOW : BLACK;
  const onBox = look === "clear" ? BLACK : YELLOW;
  const dim = look === "clear" ? "rgba(255,237,0,.7)" : "rgba(10,10,10,.7)";
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
  line("HYROX", fonts.cond, 700, 40, ink, 10, 10);

  const yr = `’${String(facts.year).slice(-2)}`;
  const city = up(facts.city);
  ctx.font = `400 ${YEAR}px ${fonts.display}`;
  const yw = ctx.measureText(yr).width + 36;
  const citySize = fit(ctx, city, fonts.display, YEAR, 60, inner - yw - 24);
  /* The year's baseline, and the box cut around the figures. */
  const baseline = y + YEAR_PAD + YEAR * 0.86;
  const boxTop = y;
  const boxH = YEAR_PAD + YEAR * 0.86 + YEAR_PAD;
  if (draw) {
    ctx.fillStyle = ink;
    ctx.font = `400 ${citySize}px ${fonts.display}`;
    ctx.fillText(city, PAD, baseline);
    ctx.fillStyle = box;
    ctx.fillRect(W - PAD - yw, boxTop, yw, boxH);
    ctx.fillStyle = onBox;
    ctx.font = `400 ${YEAR}px ${fonts.display}`;
    ctx.fillText(yr, W - PAD - yw + 18, baseline);
  }
  y = boxTop + boxH + 26;

  /* A rule. */
  if (draw) {
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, y, inner, 6);
  }
  y += 6 + 26;

  if (card === "start") {
    /* START — the time, the names small, the day. */
    line("START", fonts.cond, 700, 40, ink, 4, 10);
    const t = up(facts.startTime || "TBA");
    const ts = fit(ctx, t, fonts.display, 220, 80, inner);
    line(t, fonts.display, 400, ts, ink, 18);
    line(up(facts.day), fonts.cond, 700, 48, ink, 22, 4);
    const who = [facts.name, ...facts.partners].filter(Boolean).map(up).join("  ·  ");
    const ws = fit(ctx, who, fonts.cond, 44, 24, inner);
    line(who, fonts.cond, 600, ws, ink, 8, 2);
    line(up(facts.category), fonts.cond, 600, 32, dim, 0, 4);
  } else {
    /* THE RACE — category, day, the names. */
    const cat = up(facts.category);
    const cs = fit(ctx, cat, fonts.display, 72, 40, inner);
    line(cat, fonts.display, 400, cs, ink, 6);
    line(up(facts.day) + (facts.startTime ? `  ·  ${up(facts.startTime)}` : ""), fonts.cond, 700, 44, ink, 26, 4);

    const names = [facts.name, ...facts.partners].filter(Boolean);
    names.forEach((n, i) => {
      const text = (i === 0 ? "" : "& ") + up(n);
      const ns = fit(ctx, text, fonts.display, 92, 44, inner);
      line(text, fonts.display, 400, ns, ink, 4);
    });
  }

  return y + PAD;
}

export function Sticker({ facts }: { facts: StickerFacts }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dProbe = useRef<HTMLSpanElement | null>(null);
  const cProbe = useRef<HTMLSpanElement | null>(null);
  const [card, setCard] = useState<Card>("race");
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
    const fonts = {
      display: dProbe.current ? window.getComputedStyle(dProbe.current).fontFamily : "Impact, sans-serif",
      cond: cProbe.current ? window.getComputedStyle(cProbe.current).fontFamily : "sans-serif",
    };
    try {
      await Promise.all([document.fonts.load(`400 100px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.cond}`), document.fonts.ready]);
    } catch {
      /* paint in the fallback */
    }
    const h = Math.ceil(paint(ctx, facts, card, look, fonts, false));
    canvas.width = W;
    canvas.height = h;
    ctx.clearRect(0, 0, W, h);
    if (look === "yellow") {
      ctx.fillStyle = YELLOW;
      ctx.fillRect(0, 0, W, h);
    }
    paint(ctx, facts, card, look, fonts, true);
  }, [facts, card, look]);

  useEffect(() => {
    void repaint();
  }, [repaint]);

  const filename = `hyrox-${facts.slug}-${card}-${look}.png`;
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
        <div className="hx-stk-pick" role="group" aria-label="Card">
          <button type="button" aria-pressed={card === "race"} onClick={() => setCard("race")}>
            The race
          </button>
          <button type="button" aria-pressed={card === "start"} onClick={() => setCard("start")}>
            Start time
          </button>
        </div>
      ) : null}
      <div className="hx-stk-pick" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" aria-pressed={look === l.id} onClick={() => setLook(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={W} height={W} aria-label="Your Hyrox sticker" className={look === "yellow" ? "" : "clear"} />
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
