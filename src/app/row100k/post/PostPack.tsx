"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zipStore } from "@/lib/zip";
import {
  SLIDE_H,
  SLIDE_W,
  slidesFor,
  type FontBox,
  type PostData,
  type PostFonts,
  type Slide,
  type SlideAssets,
} from "./slides";

/* The post pack: every carousel slide rendered in the browser off the live
 * numbers, and one button that gets all of them onto the phone.
 *
 * How the images are made: each slide is drawn onto a detached 1080x1350
 * canvas, turned into a PNG blob, and shown as an object URL. The canvases
 * are thrown away — eight live canvases at that size is 45 MB of backing
 * store on a phone, eight PNG blobs is a couple.
 *
 * Fonts: next/font hashes the family names at build time, so the real names
 * are read off the probe spans below (the same trick share/ShareMenu.tsx
 * uses) and handed to the painter.
 *
 * Getting them off the page:
 *   - phones — navigator.share with ALL the files at once. A burst of
 *     <a download> clicks only ever saves the first file on iOS, and the
 *     share sheet is where Instagram lives anyway.
 *   - everything else — one uncompressed ZIP, built here (src/lib/zip.ts),
 *     downloaded as a single file.
 */

const BEAR = "/row100k/partners/grizzly-bear.png";
const WORDMARK = "/row100k/partners/grizzly-wordmark.png";

type Rendered = { url: string; blob: Blob };

/* Which gallery photo each slide starts on: the newest photo goes to the
 * first photo slide, the next to the second, and so on. */
function defaultPicks(slides: Slide[], photoCount: number): number[] {
  let taken = 0;
  return slides.map((s) => {
    if (!s.usesPhoto || photoCount === 0) return -1;
    const pick = taken % photoCount;
    taken += 1;
    return pick;
  });
}

/* Read a family's layout box off a probe: the probe is one line of text at
 * PROBE_SIZE with line-height:normal, so its height IS the normal line
 * height, and the zero-sized inline-block inside it sits on the baseline —
 * which is how far down the baseline is. Both come back as ratios per 1px of
 * font-size. Canvas can't answer this: fontBoundingBox* is the ink box of
 * the glyphs, a different (and, for these families, taller) box. */
const PROBE_SIZE = 100;

function boxOf(probe: HTMLElement | null): FontBox | undefined {
  if (!probe) return undefined;
  const strut = probe.querySelector(".pk-strut");
  if (!strut) return undefined;
  const line = probe.getBoundingClientRect();
  const base = strut.getBoundingClientRect();
  const lh = line.height / PROBE_SIZE;
  const baseline = (base.bottom - line.top) / PROBE_SIZE;
  if (!(lh > 0) || !(baseline > 0) || baseline > lh) return undefined;
  return { lh, baseline };
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function PostPack({ data }: { data: PostData }) {
  const router = useRouter();
  const slides = slidesFor(data);

  // Latest props, reachable from async work without re-running the render
  // effect on every parent render.
  const dataRef = useRef(data);
  dataRef.current = data;
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const blackProbe = useRef<HTMLDivElement | null>(null);
  const monoProbe = useRef<HTMLDivElement | null>(null);
  const archivoProbe = useRef<HTMLDivElement | null>(null);

  const [outs, setOuts] = useState<(Rendered | null)[]>(() => slides.map(() => null));
  const outsRef = useRef<(Rendered | null)[]>(outs);
  const [picks, setPicks] = useState<number[]>(() => defaultPicks(slides, data.photos.length));
  const picksRef = useRef<number[]>(picks);
  const [working, setWorking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    setCanShareFiles(typeof navigator.canShare === "function");
  }, []);

  /* One render slot, committed: the previous image for that slot is revoked
   * so swapping photos all afternoon doesn't leak blobs. */
  const commit = (index: number, out: Rendered | null) => {
    const prev = outsRef.current[index];
    if (prev && prev.url !== out?.url) URL.revokeObjectURL(prev.url);
    const next = outsRef.current.slice();
    next[index] = out;
    outsRef.current = next;
    setOuts(next);
  };

  const imgCache = useRef(new Map<string, Promise<HTMLImageElement | null>>());

  /* Load once per URL, and never reject — a photo that fails to load leaves
   * its slide on the dark ground instead of taking the page down. */
  const loadImage = (url: string): Promise<HTMLImageElement | null> => {
    const cached = imgCache.current.get(url);
    if (cached) return cached;
    const pending = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      // CORS must be armed BEFORE src: the gallery photos come from R2 on
      // another origin (which allows GET), and without this the canvas is
      // tainted and toBlob throws a SecurityError.
      if (/^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imgCache.current.set(url, pending);
    return pending;
  };

  const readFonts = (): PostFonts => ({
    black: blackProbe.current
      ? window.getComputedStyle(blackProbe.current).fontFamily
      : "sans-serif",
    mono: monoProbe.current ? window.getComputedStyle(monoProbe.current).fontFamily : "monospace",
    archivo: archivoProbe.current
      ? window.getComputedStyle(archivoProbe.current).fontFamily
      : "sans-serif",
    box: {
      black: boxOf(blackProbe.current),
      mono: boxOf(monoProbe.current),
      archivo: boxOf(archivoProbe.current),
    },
  });

  const paint = async (index: number, photoPick: number): Promise<Rendered | null> => {
    const slide = slidesRef.current[index];
    const live = dataRef.current;
    if (!slide) return null;

    const [photo, bear, wordmark] = await Promise.all([
      slide.usesPhoto && photoPick >= 0 && live.photos[photoPick]
        ? loadImage(live.photos[photoPick])
        : Promise.resolve(null),
      loadImage(BEAR),
      loadImage(WORDMARK),
    ]);

    const attempt = (assets: SlideAssets): Promise<Rendered | null> => {
      const canvas = document.createElement("canvas");
      canvas.width = SLIDE_W;
      canvas.height = SLIDE_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return Promise.resolve(null);
      try {
        slide.draw(ctx, live, readFonts(), assets);
      } catch (err) {
        console.error("row100k/post: slide failed to draw", slide.id, err);
        return Promise.resolve(null);
      }
      return new Promise<Rendered | null>((resolve) => {
        try {
          canvas.toBlob(
            (blob) => resolve(blob ? { url: URL.createObjectURL(blob), blob } : null),
            "image/png",
          );
        } catch (err) {
          console.error("row100k/post: slide failed to encode", slide.id, err);
          resolve(null);
        }
      });
    };

    const out = await attempt({ photo, bear, wordmark });
    if (out || !photo) return out;
    // A photo the bucket refused to serve with CORS taints the canvas, and
    // both the grayscale pass and toBlob throw on it. Draw the slide again
    // without the picture rather than showing an empty card.
    return attempt({ photo: null, bear, wordmark });
  };

  /* Render everything on load, one slide at a time so the strip fills in
   * front of you instead of freezing the tab. Re-runs when the live numbers
   * change (a refresh), never on an ordinary re-render. */
  const signature = `${data.asOfIso}|${data.totalMeters}|${data.standings.length}|${data.photos.length}|${data.photos[0] ?? ""}`;
  useEffect(() => {
    let cancelled = false;
    const list = slidesRef.current;
    const nextPicks = defaultPicks(list, dataRef.current.photos.length);
    picksRef.current = nextPicks;
    setPicks(nextPicks);
    for (const out of outsRef.current) if (out) URL.revokeObjectURL(out.url);
    outsRef.current = list.map(() => null);
    setOuts(outsRef.current);
    setStatus(null);

    void (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* older browsers just paint in the fallback family */
      }
      for (let i = 0; i < list.length; i++) {
        if (cancelled) return;
        setWorking(i);
        const out = await paint(i, nextPicks[i]);
        if (cancelled) {
          if (out) URL.revokeObjectURL(out.url);
          return;
        }
        commit(i, out);
      }
      setWorking(null);
    })();

    return () => {
      cancelled = true;
    };
    // Only the live numbers matter here; everything else is read off refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Unmount: hand every object URL back.
  useEffect(
    () => () => {
      for (const out of outsRef.current) if (out) URL.revokeObjectURL(out.url);
    },
    [],
  );

  /* Tap a photo slide to move it to the next gallery photo. */
  const swapPhoto = async (index: number) => {
    const slide = slidesRef.current[index];
    const photos = dataRef.current.photos;
    if (!slide?.usesPhoto || photos.length < 2 || working !== null) return;
    const next = ((picksRef.current[index] ?? -1) + 1) % photos.length;
    const nextPicks = picksRef.current.slice();
    nextPicks[index] = next;
    picksRef.current = nextPicks;
    setPicks(nextPicks);
    setWorking(index);
    const out = await paint(index, next);
    commit(index, out);
    setWorking(null);
  };

  const ready = () =>
    outsRef.current
      .map((out, i) => (out ? { name: slidesRef.current[i].file, blob: out.blob } : null))
      .filter((v): v is { name: string; blob: Blob } => v != null);

  /* The whole point of the page: every slide, one tap. */
  const downloadAll = async () => {
    const pack = ready();
    if (pack.length === 0) {
      setStatus("NOTHING RENDERED YET");
      return;
    }
    // Built synchronously from blobs that already exist, so the share call
    // still sits inside the tap gesture iOS requires.
    const files = pack.map((p) => new File([p.blob], p.name, { type: "image/png" }));
    const payload = { files, title: `Rowtember · ${data.asOfDay}` };
    if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
      try {
        await navigator.share(payload);
        setStatus(`SHARED ${files.length} SLIDES`);
        return;
      } catch (err) {
        // A dismissed sheet is a choice, not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: fall through to the zip.
      }
    }
    setBusy(true);
    try {
      const entries = await Promise.all(
        pack.map(async (p) => ({ name: p.name, data: new Uint8Array(await p.blob.arrayBuffer()) })),
      );
      saveBlob(zipStore(entries), `rowtember-${data.asOfIso}.zip`);
      setStatus(`SAVED ${entries.length} SLIDES AS A ZIP`);
    } catch (err) {
      console.error("row100k/post: zip failed", err);
      setStatus("COULD NOT BUILD THE ZIP");
    } finally {
      setBusy(false);
    }
  };

  /* One slide on its own — share sheet on a phone, plain download elsewhere. */
  const saveOne = async (index: number) => {
    const out = outsRef.current[index];
    const slide = slidesRef.current[index];
    if (!out || !slide) return;
    const file = new File([out.blob], slide.file, { type: "image/png" });
    const payload = { files: [file] };
    if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    saveBlob(out.blob, slide.file);
  };

  const doneCount = outs.filter(Boolean).length;

  return (
    <>
      {/* Font probes: off-screen but really laid out, so they carry both the
       * page real family names and the line box those families make. */}
      <div ref={blackProbe} aria-hidden className="pk-probe blk">
        Hxg
        <i className="pk-strut" />
      </div>
      <div ref={monoProbe} aria-hidden className="pk-probe mn">
        Hxg
        <i className="pk-strut" />
      </div>
      <div ref={archivoProbe} aria-hidden className="pk-probe arc">
        Hxg
        <i className="pk-strut" />
      </div>

      <div className="pk-head">
        <span className="pk-as">
          As of {data.asOfDay} · {data.totalMeters.toLocaleString("en-US")} m ·{" "}
          {data.rowersLogged} rowers ·{" "}
          {data.daysLeft > 0 ? `${data.daysLeft} days left` : "September done"} · {doneCount}/
          {slides.length} slides
        </span>
        <div className="pk-acts">
          <button
            type="button"
            className="pk-btn"
            onClick={() => router.refresh()}
            disabled={busy || working !== null}
          >
            Refresh
          </button>
          <button
            type="button"
            className="pk-btn primary"
            onClick={downloadAll}
            disabled={busy || doneCount === 0}
          >
            {busy ? "Packing…" : "Download all"}
          </button>
        </div>
      </div>

      <p className="pk-note">
        {canShareFiles
          ? "Download all opens the share sheet with every slide — save them all to Photos in one go."
          : "Download all saves every slide as one zip."}
        {data.photos.length > 1 ? " Tap a photo slide to swap its picture." : ""}
      </p>

      <div className="pk-strip">
        {slides.map((slide, i) => {
          const out = outs[i];
          const swappable = slide.usesPhoto && data.photos.length > 1;
          return (
            <div className="pk-card" key={slide.id}>
              <button
                type="button"
                className="pk-frame"
                onClick={() => (swappable ? void swapPhoto(i) : void saveOne(i))}
                aria-label={
                  swappable ? `${slide.label} — tap to swap the photo` : `${slide.label} — save`
                }
              >
                {out ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={out.url} alt={slide.label} width={SLIDE_W} height={SLIDE_H} />
                ) : null}
                {(!out || working === i) && (
                  <span className="pk-wait">{working === i ? "Rendering" : "Waiting"}</span>
                )}
              </button>
              <div className="pk-cap">
                <span className="pk-name">
                  {i + 1}. {slide.label}
                  {swappable && picks[i] >= 0 ? ` · photo ${picks[i] + 1}` : ""}
                </span>
                <button
                  type="button"
                  className="pk-save"
                  onClick={() => void saveOne(i)}
                  disabled={!out}
                >
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {status && <p className="pk-status">{status}</p>}
    </>
  );
}
