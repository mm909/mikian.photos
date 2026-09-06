"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zipStore } from "@/lib/zip";
import {
  SIZES,
  SLIDE_H,
  SLIDE_W,
  slidesFor,
  type FontBox,
  type PostData,
  type PostFonts,
  type SizeKey,
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
 * Two sizes: POST is that 4:5 frame, STORY is 1080x1920. The story is the
 * SAME composition on a taller photo — the picture fills the real canvas
 * (slides.ts paints the bed frame-wide) and the 1080x1350 block of type and
 * decals is dropped in centred, 285px down. Nothing is re-laid-out for it,
 * which is what the owner asked for ("crop to story size and put the decals
 * on those as well") and is why the 4:5 output is untouched.
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

/* The filename says which frame it is. A post keeps the name it always had,
 * so nothing changes for someone who never touches the picker; a story picks
 * up the suffix — 01-board-1-10-story.png. */
function fileNameFor(slide: Slide, size: SizeKey): string {
  const suffix = SIZES[size].suffix;
  return suffix ? slide.file.replace(/\.png$/i, `${suffix}.png`) : slide.file;
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
  /* Which frame the whole pack renders into. POST by default. */
  const [size, setSize] = useState<SizeKey>("post");
  const sizeRef = useRef<SizeKey>(size);
  sizeRef.current = size;
  const frame = SIZES[size];
  const [working, setWorking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopy, setCanCopy] = useState(false);

  useEffect(() => {
    setCanShareFiles(typeof navigator.canShare === "function");
    // Image clipboard needs ClipboardItem + a secure context (iOS Safari has
    // both since 13.4); resolved after mount so the server markup matches.
    setCanCopy(
      typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard?.write === "function" &&
        window.isSecureContext,
    );
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

    const box = SIZES[sizeRef.current];
    const attempt = (assets: SlideAssets): Promise<Rendered | null> => {
      const canvas = document.createElement("canvas");
      canvas.width = box.w;
      canvas.height = box.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return Promise.resolve(null);
      try {
        // THE STORY IS THE SAME COMPOSITION ON A TALLER PHOTO — the owner
        // asked to "crop to story size and put the decals on those as well",
        // not for a second layout. Every slide draws from absolute y
        // coordinates inside a 1080x1350 box, so that box is dropped into
        // the middle of the taller frame ((1920-1350)/2 = 285px) and the
        // type and decals land exactly where they were composed. The photo
        // bed ignores this translate and paints the real canvas edge to edge
        // (slides.ts inFrame), so the picture is a true crop, not a letterbox.
        ctx.save();
        ctx.translate((box.w - SLIDE_W) / 2, (box.h - SLIDE_H) / 2);
        slide.draw(ctx, live, readFonts(), assets);
        ctx.restore();
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
   * change (a refresh) and when the frame changes (post to story), never on
   * an ordinary re-render. A size flip is the same slides on a different
   * canvas, so it keeps whatever photos you picked; new numbers start the
   * picks over. */
  /* The club welcome is the first slide whose EXISTENCE decays on the clock
   * alone: a crossing rolls out of its 24-hour window with no new meters
   * logged, so asOfIso, totalMeters and standings.length can all be unchanged
   * while the slide list gets one shorter. It belongs in the signature, or a
   * Refresh in that minute leaves outsRef longer than the list and every card
   * from the dropped index on shows the previous slide's picture under the
   * wrong label (review, 2026-09-05). */
  const clubSig = data.clubJoins.map((c) => `${c.label}:${c.rowers.length}`).join(",");
  const signature = `${data.asOfIso}|${data.totalMeters}|${data.standings.length}|${clubSig}|${data.photos.length}|${data.photos[0] ?? ""}`;
  const sigRef = useRef<string>("");
  useEffect(() => {
    let cancelled = false;
    const list = slidesRef.current;
    const fresh = sigRef.current !== signature;
    sigRef.current = signature;
    const kept = picksRef.current;
    const nextPicks =
      fresh || kept.length !== list.length
        ? defaultPicks(list, dataRef.current.photos.length)
        : kept.slice();
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
    // Only the live numbers and the frame matter here; everything else is
    // read off refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, size]);

  // Unmount: hand every object URL back.
  useEffect(
    () => () => {
      for (const out of outsRef.current) if (out) URL.revokeObjectURL(out.url);
    },
    [],
  );

  /* Tap a photo slide to move it to the next gallery photo; one tap past the
   * last photo is the PLAIN version — the same type on the dark ground with
   * no picture, which is the one to paste over your own shot (owner ask:
   * "copy the top 10 sticker without the images"). Another tap starts the
   * photos over. */
  const swapPhoto = async (index: number, to?: number) => {
    const slide = slidesRef.current[index];
    const photos = dataRef.current.photos;
    if (!slide?.usesPhoto || photos.length < 1 || working !== null) return;
    const cur = picksRef.current[index] ?? -1;
    const next = to !== undefined ? to : cur + 1 >= photos.length ? -1 : cur + 1;
    const nextPicks = picksRef.current.slice();
    nextPicks[index] = next;
    picksRef.current = nextPicks;
    setPicks(nextPicks);
    setWorking(index);
    // The frame can move under a swap. The size picker restarts the whole
    // pack, and this render — begun at 4:5, landing after the flip — would
    // otherwise commit a 1080x1350 blob into a story pack: hidden on screen
    // (the preview crops it to fill), then shipped inside the -story zip at
    // the wrong aspect. So the frame is read before the await and the work is
    // thrown away if it moved, the way the render loop drops its own on
    // `cancelled` (review, 2026-09-05). Returning here also leaves `working`
    // alone: the restarted loop owns the indicator now.
    const at = sizeRef.current;
    const out = await paint(index, next);
    if (sizeRef.current !== at) {
      if (out) URL.revokeObjectURL(out.url);
      return;
    }
    commit(index, out);
    setWorking(null);
  };

  const ready = () =>
    outsRef.current
      .map((out, i) => {
        // Belt and braces on top of the signature: a filename needs a slide,
        // and a render slot with no slide behind it is simply not packed —
        // rather than Download all throwing on slide.file and the button
        // doing nothing with no status line.
        const slide = slidesRef.current[i];
        return out && slide
          ? { name: fileNameFor(slide, sizeRef.current), blob: out.blob }
          : null;
      })
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
    const payload = {
      files,
      title: `Rowtember · ${data.asOfDay}${size === "story" ? " · story" : ""}`,
    };
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
      saveBlob(zipStore(entries), `rowtember-${data.asOfIso}${SIZES[size].suffix}.zip`);
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
    const name = fileNameFor(slide, sizeRef.current);
    const file = new File([out.blob], name, { type: "image/png" });
    const payload = { files: [file] };
    if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    saveBlob(out.blob, name);
  };

  /* One slide onto the clipboard, for pasting straight into a story or a
   * message without the round trip through Photos. */
  const copyOne = async (index: number) => {
    const out = outsRef.current[index];
    const slide = slidesRef.current[index];
    if (!out || !slide) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": out.blob })]);
      setStatus(`COPIED ${slide.label.toUpperCase()}`);
    } catch (err) {
      console.error("row100k/post: copy failed", err);
      setStatus("COULD NOT COPY — SAVE IT INSTEAD");
    }
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

      {/* The frame, for the whole pack. Same control as the leaderboard tabs
       * — square, mono, ink when it is on — because that is the switch this
       * site already uses. POST is the default, so a pack nobody touches is
       * the 4:5 carousel it has always been.
       *
       * It goes quiet while anything is rendering, exactly like the Refresh
       * button above it: both restart the pack, and a restart landing on top
       * of a slide already in flight is how a 4:5 image ends up in a story
       * zip (review, 2026-09-05). The dimming is .pp-size in the theme, so
       * a control that cannot act does not look live. */}
      <div
        className="tabs pp-size"
        role="group"
        aria-label="Slide size"
        style={{ marginTop: 16, marginBottom: 0 }}
      >
        {(["post", "story"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={size === key ? "on" : undefined}
            aria-pressed={size === key}
            onClick={() => setSize(key)}
            disabled={busy || working !== null}
          >
            {SIZES[key].label}
          </button>
        ))}
      </div>

      <p className="pk-note">
        {canShareFiles
          ? "Download all opens the share sheet with every slide — save them all to Photos in one go."
          : "Download all saves every slide as one zip."}
        {data.photos.length > 0
          ? " Tap a photo slide to swap its picture; one tap past the last photo is the plain version, no picture."
          : ""}
        {size === "story"
          ? " Story is the same slide on a 9:16 crop of the photo — files end in -story."
          : ""}
      </p>

      <div className="pk-strip">
        {slides.map((slide, i) => {
          const out = outs[i];
          const swappable = slide.usesPhoto && data.photos.length > 0;
          return (
            <div className="pk-card" key={slide.id}>
              <button
                type="button"
                className="pk-frame"
                /* The preview is the frame it will save as: the card keeps
                 * its width (so nothing can push the strip off a phone) and
                 * the box takes the aspect of the picked size. */
                style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
                onClick={() => (swappable ? void swapPhoto(i) : void saveOne(i))}
                aria-label={
                  swappable ? `${slide.label} — tap to swap the photo` : `${slide.label} — save`
                }
              >
                {out ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={out.url} alt={slide.label} width={frame.w} height={frame.h} />
                ) : null}
                {(!out || working === i) && (
                  <span className="pk-wait">{working === i ? "Rendering" : "Waiting"}</span>
                )}
              </button>
              <div className="pk-cap">
                <span className="pk-name">
                  {i + 1}. {slide.label}
                  {swappable ? (picks[i] >= 0 ? ` · photo ${picks[i] + 1}` : " · plain") : ""}
                </span>
                <span style={{ display: "flex", gap: 14, flex: "none" }}>
                  {/* One tap to the version with no picture (and back), so
                   * the plain sticker is a button, not a hunt through the
                   * photos (owner ask, 2026-09-05). */}
                  {swappable && (
                    <button
                      type="button"
                      className="pk-save"
                      onClick={() => void swapPhoto(i, picks[i] >= 0 ? -1 : 0)}
                      disabled={!out || working !== null}
                    >
                      {picks[i] >= 0 ? "Plain" : "Photo"}
                    </button>
                  )}
                  {canCopy && (
                    <button
                      type="button"
                      className="pk-save"
                      onClick={() => void copyOne(i)}
                      disabled={!out}
                    >
                      Copy
                    </button>
                  )}
                  <button
                    type="button"
                    className="pk-save"
                    onClick={() => void saveOne(i)}
                    disabled={!out}
                  >
                    Save
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {status && <p className="pk-status">{status}</p>}
    </>
  );
}
