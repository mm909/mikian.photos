"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LOOKS, W, type Fonts, type Kit, type Look, type Painter } from "./shareCards";
import { COUNT_MS, TICK_MS, VIDEO_MS, canRecord, recordCanvas, type Anim } from "./shareAnim";

/* THE FRAME AROUND A STICKER: the look row (clear / ink / lime), the
 * canvas, the exits (the share sheet on a phone, copy where the clipboard
 * takes an image, download always, SAVE AS VIDEO for a card that moves),
 * and the font probes. next/font hands out hashed family names, so the
 * real names are read off three probe spans — display (Archivo Black),
 * condensed (Barlow Condensed), mono (IBM Plex Mono) — once, and handed to
 * the painter as the `kit`.
 *
 * `paint` lays the card out and returns the height it used; it is called
 * once to measure and once to draw, so a sticker is exactly as tall as
 * its content. Anything the page wants above the look row (card, runner
 * and size pickers) comes in as `pickers`.
 *
 * ANIMATION (owner, 2026-10-15: "can we try some animated stickers?"):
 * with `animated` on, the canvas is repainted in a requestAnimationFrame
 * loop — every frame while a number counts up, every TICK_MS after — and
 * the painter gets the ms since the card was picked (`animKey`), not
 * since the last poll, so a new snapshot does not replay the count. SAVE
 * AS VIDEO records that loop for VIDEO_MS with MediaRecorder and shares
 * the clip or downloads it; the clear look has nothing a video can keep,
 * so it records on ink and says so.
 *
 * A DECK: `deck` names every slide of the current pick; SHARE ALL hands
 * them to the share sheet together (on a phone, Save Images puts the lot
 * in the camera roll) and DOWNLOAD ALL saves them one after another. Each
 * slide paints offscreen, in the look on screen, at its final frame. */

export type Deck = (look: Look) => { paint: Painter; name: string }[];

async function loadKit(d: HTMLSpanElement | null, c: HTMLSpanElement | null, m: HTMLSpanElement | null): Promise<Kit> {
  const fonts: Fonts = {
    display: d ? window.getComputedStyle(d).fontFamily : "Impact, sans-serif",
    cond: c ? window.getComputedStyle(c).fontFamily : "sans-serif",
    mono: m ? window.getComputedStyle(m).fontFamily : "monospace",
  };
  try {
    await Promise.all([
      document.fonts.load(`400 100px ${fonts.display}`),
      document.fonts.load(`600 100px ${fonts.cond}`),
      document.fonts.load(`700 100px ${fonts.cond}`),
      document.fonts.load(`500 40px ${fonts.mono}`),
      document.fonts.ready,
    ]);
  } catch {
    /* paint in the fallback */
  }
  return { fonts };
}

function render(canvas: HTMLCanvasElement, paint: Painter, look: Look, kit: Kit, anim?: Anim): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const h = Math.max(1, Math.ceil(paint(ctx, look, kit, false, anim)));
  /* Resizing clears the canvas and restarts a capture stream: only when
   * the card's height actually changes. */
  if (canvas.width !== W || canvas.height !== h) {
    canvas.width = W;
    canvas.height = h;
  }
  ctx.clearRect(0, 0, W, h);
  paint(ctx, look, kit, true, anim);
}

const blobOf = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

export function ShareFrame({
  paint,
  basename,
  pickers,
  label,
  deck,
  animated = false,
  animKey = "",
  initialLook = "clear",
}: {
  paint: Painter;
  /* The file name without its extension, per look: lasd26-mile-sticker-ink. */
  basename: (look: Look) => string;
  pickers?: ReactNode;
  label: string;
  deck?: Deck;
  /* True for a card that moves: the frame runs the loop and offers video. */
  animated?: boolean;
  /* Changes when the pick changes; the animation starts over then. */
  animKey?: string;
  initialLook?: Look;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dProbe = useRef<HTMLSpanElement | null>(null);
  const cProbe = useRef<HTMLSpanElement | null>(null);
  const mProbe = useRef<HTMLSpanElement | null>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const t0Ref = useRef(0);
  const recordingRef = useRef(false);
  const pendingVideo = useRef(false);
  const reducedRef = useRef(false);

  const [kit, setKit] = useState<Kit | null>(null);
  const [look, setLook] = useState<Look>(initialLook);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [canVideo, setCanVideo] = useState(false);
  const [handheld, setHandheld] = useState(false);

  useEffect(() => {
    const share = typeof navigator.canShare === "function";
    setCanShareFiles(share);
    setCanCopy(typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function" && window.isSecureContext);
    setHandheld(share && !!window.matchMedia?.("(pointer: coarse)").matches);
    setCanVideo(canRecord());
    reducedRef.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let alive = true;
    void loadKit(dProbe.current, cProbe.current, mProbe.current).then((k) => {
      if (alive) setKit(k);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* The count starts over when the pick or the look changes, not when a
   * poll lands. */
  useEffect(() => {
    t0Ref.current = performance.now();
  }, [animKey, look]);

  /* Paint once, or keep painting. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !kit) return;
    if (!animated) {
      render(canvas, paintRef.current, look, kit);
      return;
    }
    let raf = 0;
    let last = -Infinity;
    const tick = () => {
      const now = performance.now();
      /* Reduced motion: no count-up, straight to the number (the clock
       * still keeps time). */
      const t = reducedRef.current ? Number.POSITIVE_INFINITY : now - t0Ref.current;
      const rec = recordingRef.current;
      if (rec || t < COUNT_MS + 300 || now - last >= TICK_MS) {
        render(canvas, paintRef.current, look, kit, { t, now: Date.now(), video: rec });
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kit, look, animated, animKey, paint]);

  const base = basename(look);
  const pngName = `${base}.png`;
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
    download(blob, pngName);
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
      const file = new File([blob], pngName, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("unsupported");
      await navigator.share({ files: [file] });
      setMsg("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMsg("Sharing isn't available — copy or download");
    }
  };

  /* SAVE AS VIDEO: the loop paints every frame while this records. */
  const startVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !kit || recordingRef.current) return;
    setBusy(true);
    setRecording(true);
    recordingRef.current = true;
    t0Ref.current = performance.now();
    render(canvas, paintRef.current, look, kit, { t: 0, now: Date.now(), video: true });
    setMsg(`Recording ${Math.round(VIDEO_MS / 1000)} s…`);
    const file = await recordCanvas(canvas, VIDEO_MS, basename(look));
    recordingRef.current = false;
    setRecording(false);
    if (!file) {
      setMsg("Couldn't record here — download the image instead");
    } else if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setMsg("");
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          download(file, file.name);
          setMsg("Saved the clip — add it to a story from your camera roll");
        }
      }
    } else {
      download(file, file.name);
      setMsg("Saved the clip — add it to a story from your camera roll");
    }
    setBusy(false);
  }, [kit, look, basename]);

  const onVideo = () => {
    if (look === "clear") {
      /* Transparent backgrounds do not survive video: record on ink. */
      pendingVideo.current = true;
      setLook("ink");
      setMsg("A video can't be clear — recording on ink");
      return;
    }
    void startVideo();
  };
  useEffect(() => {
    if (pendingVideo.current && look !== "clear" && kit) {
      pendingVideo.current = false;
      void startVideo();
    }
  }, [look, kit, startVideo]);

  /* Every slide of the deck as a file, painted offscreen at its final
   * frame. */
  const deckFiles = async (): Promise<File[]> => {
    if (!deck || !kit) return [];
    const off = document.createElement("canvas");
    const files: File[] = [];
    for (const s of deck(look)) {
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

  const showVideo = animated && canVideo;

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
          <button key={l.id} type="button" aria-pressed={look === l.id} disabled={recording} onClick={() => setLook(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={W} height={W} aria-label={label} className={look === "clear" ? "clear" : ""} />
      <div className="shr-btns">
        {canShareFiles ? (
          <button type="button" className={handheld ? "primary" : ""} disabled={busy} onClick={() => void onShare()}>
            Share
          </button>
        ) : null}
        {canCopy ? (
          <button type="button" disabled={busy} onClick={() => void onCopy()}>
            Copy
          </button>
        ) : null}
        <button type="button" className={canShareFiles ? "" : "primary"} disabled={busy} onClick={() => void onDownload()}>
          Download
        </button>
      </div>
      {showVideo ? (
        <div className="shr-btns video">
          <button type="button" disabled={busy} onClick={onVideo}>
            {recording ? "Recording…" : "Save as video"}
          </button>
          <p className="shr-video-note">
            A {Math.round(VIDEO_MS / 1000)}-second clip: it drops onto a story like any video from your camera roll. Clear can&rsquo;t be a video, so it records on ink or lime.
          </p>
        </div>
      ) : null}
      {deck ? (
        <div className="shr-btns deck">
          {canShareFiles ? (
            <button type="button" disabled={busy} onClick={() => void onShareAll()}>
              {busy && !recording ? "Making…" : "Share all stickers"}
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => void onDownloadAll()}>
            {busy && !recording ? "Making…" : "Download all stickers"}
          </button>
        </div>
      ) : null}
      <p className="shr-msg" role="status">
        {msg}
      </p>
    </div>
  );
}
