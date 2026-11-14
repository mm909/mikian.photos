"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canRecord, recordCanvas } from "../../track/shareAnim";
import { BG_SWATCH, fmtClock, fmtInt, paintClip, paintThumb, type BgId, type ClipId, type Fonts, type PaintOpts, type ScreenId, type UnitId } from "./paint";
import { frameAt, rowTimeAt, type ReelSeries } from "./series";

/* THE REEL STUDIO (owner, 2026-11-13: "graphics for the daily reel videos
 * that I make after I row my daily 5k ... I need to be able to select the
 * time frame ... an overlay for the thumbnails ... on my phone as soon as
 * possible b/c that is where I need these assets").
 *
 * Built for a thumb: the preview on top, the choices under it, one button
 * that films the canvas for exactly the length picked and hands back a file
 * the share sheet can put in the camera roll.
 *
 * THE CLIP IS FILMED IN REAL TIME — MediaRecorder watches the canvas while
 * it plays — so a ten second clip takes ten seconds to make and the tab has
 * to stay in front. RECORD ALL does the same for every clip in turn. */

const CLIPS: { id: ClipId; name: string }[] = [
  { id: "meters", name: "Meters + avg pace" },
  { id: "clock", name: "Elapsed clock" },
  { id: "pace", name: "Pace graph" },
  { id: "stack", name: "Full stat stack" },
  { id: "stroke", name: "My stroke" },
  { id: "monitor", name: "Monitor screen" },
];
const SCREENS: { id: ScreenId; name: string }[] = [
  { id: "all", name: "All data" },
  { id: "large", name: "Large print" },
  { id: "force", name: "Force curve" },
  { id: "bars", name: "Bar chart" },
];
const UNITS: { id: UnitId; name: string }[] = [
  { id: "pace", name: "/500m" },
  { id: "watts", name: "Watts" },
  { id: "cal", name: "Cal/hr" },
];
const BGS: { id: BgId; name: string }[] = [
  { id: "green", name: "Green screen" },
  { id: "blue", name: "Blue screen" },
  { id: "black", name: "Black" },
  { id: "brown", name: "Brown card" },
  { id: "cream", name: "Cream card" },
];
/* 4:5 is the feed post; 9:16 the reel and the story. */
const FORMATS = [
  { id: "story", name: "9:16", w: 1080, h: 1920 },
  { id: "post", name: "4:5", w: 1080, h: 1350 },
  { id: "square", name: "1:1", w: 1080, h: 1080 },
] as const;
/* "" leaves the ground's own colour. The blue is the Rowtember water blue,
 * the brown the V of the Rowvember mark. */
const COLORS: { id: string; name: string }[] = [
  { id: "", name: "Auto" },
  { id: "#ffffff", name: "White" },
  { id: "#15171a", name: "Black" },
  { id: "#1a90d4", name: "Blue" },
  { id: "#c98a5a", name: "Brown" },
  { id: "#f2c230", name: "Yellow" },
];
type TitleMode = "off" | "text" | "mark" | "both";
const LENGTHS = [5, 10, 15, 30];
const MAX_LENGTH = 120;

export type ReelProps = {
  series: ReelSeries;
  /* "ROWVEMBER" */
  label: string;
  /* Day of the month the row was rowed. */
  day: number;
  /* The month's logged metres before the row's day. */
  before: number;
  markSrc: string | null;
  fileBase: string;
};

type Out = { file: File; url: string; kind: "video" | "image" };

function Chips<T extends string | number>({ items, value, onPick, disabled, swatch }: { items: { id: T; name: string }[]; value: T; onPick: (id: T) => void; disabled?: boolean; swatch?: (id: T) => string | null }) {
  return (
    <div className="rl-chips">
      {items.map((it) => {
        const sw = swatch?.(it.id);
        return (
          <button key={String(it.id)} type="button" className={`rl-chip${it.id === value ? " on" : ""}`} aria-pressed={it.id === value} disabled={disabled} onClick={() => onPick(it.id)}>
            {sw ? <i className="rl-sw" style={{ background: sw }} /> : null}
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

export function ReelStudio(p: ReelProps) {
  const { series } = p;
  const [tab, setTab] = useState<"video" | "thumb">("video");
  const [clip, setClip] = useState<ClipId>("meters");
  const [screen, setScreen] = useState<ScreenId>("all");
  const [unit, setUnit] = useState<UnitId>("pace");
  const [bg, setBg] = useState<BgId>("green");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("story");
  const [numColor, setNumColor] = useState("");
  const [labColor, setLabColor] = useState("");
  const [titleMode, setTitleMode] = useState<TitleMode>("off");
  const [titleText, setTitleText] = useState(`${p.label} day ${p.day}`);
  const [lengthS, setLengthS] = useState(10);
  const [realTime, setRealTime] = useState(false);
  const [fromS, setFromS] = useState(series.startS);
  const [toS, setToS] = useState(series.totalS);
  const [startTotal, setStartTotal] = useState(p.before);
  const [scrub, setScrub] = useState(1);
  const [busy, setBusy] = useState<"" | "play" | "record">("");
  const [batch, setBatch] = useState<{ i: number; n: number; name: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [outs, setOuts] = useState<Out[]>([]);
  const [msg, setMsg] = useState("");
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [recordable, setRecordable] = useState(true);

  /* thumbnail */
  const [day, setDay] = useState(p.day);
  const [showDay, setShowDay] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showMark, setShowMark] = useState(true);
  const [color, setColor] = useState<"white" | "ink">("white");
  const [pos, setPos] = useState<"top" | "middle" | "bottom">("bottom");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [mark, setMark] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const cancelRef = useRef(false);

  const size = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const W = size.w;
  const H = tab === "thumb" ? 1920 : size.h;

  /* 1X REAL TIME (owner, 2026-11-13): the stretch of the row is exactly as
   * long as the video, so FROM slides a window and TO follows it. */
  const rFrom = realTime ? Math.max(series.startS, Math.min(fromS, series.totalS - lengthS)) : fromS;
  const rTo = realTime ? Math.min(series.totalS, rFrom + lengthS) : toS;

  /* The faces the page already loads, by the names the browser knows them. */
  useEffect(() => {
    const el = probeRef.current;
    if (!el) return;
    const fam = (i: number) => window.getComputedStyle(el.children[i]).fontFamily || "sans-serif";
    const f: Fonts = { black: fam(0), sans: fam(1), mono: fam(2) };
    let live = true;
    Promise.all([document.fonts.load(`400 100px ${f.black}`), document.fonts.load(`700 40px ${f.sans}`), document.fonts.load(`700 40px ${f.mono}`), document.fonts.ready])
      .catch(() => null)
      .then(() => {
        if (live) setFonts(f);
      });
    setRecordable(canRecord());
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!p.markSrc) return;
    const img = new Image();
    img.onload = () => setMark(img);
    img.src = p.markSrc;
  }, [p.markSrc]);

  const markRatio = mark && mark.naturalHeight ? mark.naturalWidth / mark.naturalHeight : 858 / 188;

  const opts = useMemo<PaintOpts | null>(
    () =>
      fonts
        ? {
            clip,
            bg,
            unit,
            screen,
            startTotal,
            label: p.label,
            fromS: rFrom,
            toS: rTo,
            fonts,
            numColor: numColor || null,
            labColor: labColor || null,
            title: titleMode === "text" || titleMode === "both" ? titleText.trim() : "",
            mark: titleMode === "mark" || titleMode === "both" ? mark : null,
            markRatio,
          }
        : null,
    [fonts, clip, bg, unit, screen, startTotal, p.label, rFrom, rTo, numColor, labColor, titleMode, titleText, mark, markRatio],
  );

  const drawThumb = useCallback(
    (ctx: CanvasRenderingContext2D, withPhoto: boolean) => {
      if (!fonts) return;
      paintThumb(ctx, 1080, 1920, {
        day: showDay ? day : null,
        total: showTotal ? startTotal + series.totalM : null,
        mark: showMark ? mark : null,
        markRatio,
        color,
        pos,
        photo: withPhoto ? photo : null,
        photoW: photo?.naturalWidth ?? 0,
        photoH: photo?.naturalHeight ?? 0,
        fonts,
      });
    },
    [fonts, showDay, day, showTotal, startTotal, series.totalM, showMark, mark, markRatio, color, pos, photo],
  );

  /* One frame of a clip, `clipS` seconds in, with the options given. */
  const drawWith = useCallback(
    (o: PaintOpts, clipS: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) paintClip(ctx, W, H, series, frameAt(series, rowTimeAt(clipS, lengthS, o.fromS, o.toS)), o);
    },
    [W, H, series, lengthS],
  );

  /* At rest the canvas shows the scrubbed frame (or the thumbnail). */
  useEffect(() => {
    if (busy) return;
    if (tab === "thumb") {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) drawThumb(ctx, true);
    } else if (opts) drawWith(opts, scrub * lengthS);
  }, [busy, tab, scrub, lengthS, opts, drawWith, drawThumb]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const clearOuts = () =>
    setOuts((prev) => {
      prev.forEach((o) => URL.revokeObjectURL(o.url));
      return [];
    });
  const toOut = (file: File, kind: Out["kind"]): Out => ({ file, url: URL.createObjectURL(file), kind });

  /* Plays one clip on the canvas from 0 to its length; resolves at the end. */
  const run = (o: PaintOpts, mode: "play" | "record"): Promise<void> =>
    new Promise((resolve) => {
      setBusy(mode);
      setProgress(0);
      const t0 = performance.now();
      const tick = () => {
        if (cancelRef.current) return resolve();
        const c = (performance.now() - t0) / 1000;
        drawWith(o, Math.min(c, lengthS));
        setProgress(Math.min(1, c / lengthS));
        /* A recording holds the last frame a beat past the end so the file is not cut short. */
        if (c < lengthS + (mode === "record" ? 0.4 : 0)) rafRef.current = requestAnimationFrame(tick);
        else resolve();
      };
      drawWith(o, 0);
      rafRef.current = requestAnimationFrame(tick);
    });

  const rest = () => {
    cancelAnimationFrame(rafRef.current);
    setBusy("");
    setBatch(null);
    setScrub(1);
  };

  const stop = () => {
    cancelRef.current = true;
    rest();
  };

  const play = async () => {
    if (!opts) return;
    cancelRef.current = false;
    await run(opts, "play");
    rest();
  };

  const nameOf = (o: PaintOpts) => `${p.fileBase}-${o.clip}${o.clip === "monitor" ? `-${o.screen}` : ""}-${lengthS}s`;

  const film = async (o: PaintOpts): Promise<File | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    drawWith(o, 0);
    const [file] = await Promise.all([recordCanvas(canvas, lengthS * 1000 + 150, nameOf(o)), run(o, "record")]);
    return file;
  };

  const record = async () => {
    if (!opts) return;
    clearOuts();
    setMsg("");
    cancelRef.current = false;
    const file = await film(opts);
    rest();
    if (file) setOuts([toOut(file, "video")]);
    else setMsg("This browser would not record the canvas. Try Chrome, or Safari 17 or newer.");
  };

  /* EVERY CLIP AT THIS LENGTH (owner, 2026-11-13: "a button to download all
   * clips of a set length"): the five clips and the four monitor screens,
   * one after another, same stretch of the row, same ground and colours. */
  const recordAll = async () => {
    if (!opts) return;
    clearOuts();
    setMsg("");
    cancelRef.current = false;
    const list: { o: PaintOpts; name: string }[] = [
      ...CLIPS.filter((c) => c.id !== "monitor").map((c) => ({ o: { ...opts, clip: c.id }, name: c.name })),
      ...SCREENS.map((sc) => ({ o: { ...opts, clip: "monitor" as ClipId, screen: sc.id }, name: `Monitor: ${sc.name}` })),
    ];
    const made: Out[] = [];
    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) break;
      setBatch({ i: i + 1, n: list.length, name: list[i].name });
      const file = await film(list[i].o);
      if (cancelRef.current) break;
      if (!file) {
        setMsg("This browser would not record the canvas. Try Chrome, or Safari 17 or newer.");
        break;
      }
      made.push(toOut(file, "video"));
      setOuts([...made]);
    }
    rest();
  };

  /* A canvas the page never shows, painted once and turned into a file. */
  const still = (name: string, type: "image/png" | "image/jpeg", w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    paint(ctx);
    c.toBlob(
      (blob) => {
        clearOuts();
        if (blob) setOuts([toOut(new File([blob], name, { type }), "image")]);
        else setMsg("Could not make the image.");
      },
      type,
      0.92,
    );
  };

  /* The frame on screen with nothing behind it: a sticker. */
  const stillPng = () => {
    if (!opts) return;
    const o = { ...opts, bg: "clear" as BgId };
    still(`${p.fileBase}-${clip}.png`, "image/png", W, H, (ctx) => paintClip(ctx, W, H, series, frameAt(series, rowTimeAt(scrub * lengthS, lengthS, o.fromS, o.toS)), o));
  };

  const share = async (files: File[]) => {
    try {
      if (!navigator.canShare?.({ files })) throw new Error("unsupported");
      await navigator.share({ files });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setMsg("Sharing is not available here. Use the download links.");
    }
  };

  const downloadAll = () => {
    outs.forEach((o, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = o.url;
        a.download = o.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350),
    );
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return setPhoto(null);
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = URL.createObjectURL(file);
  };

  const a = frameAt(series, rFrom);
  const b = frameAt(series, rTo);
  const span = Math.max(1, rTo - rFrom);
  const speed = span / lengthS;
  const pad = series.totalS >= 600;
  const locked = busy !== "";
  const setRange = (from: number, to: number) => {
    const lo = Math.max(series.startS, Math.min(from, series.totalS - 2));
    setFromS(lo);
    setToS(Math.min(series.totalS, Math.max(to, lo + 2)));
  };
  const timeAtMetres = (m: number) => {
    const k = series.ticks.find((t) => t.m >= m);
    return k ? k.t : series.totalS;
  };
  const allCount = CLIPS.length - 1 + SCREENS.length;

  return (
    <div className="rl">
      <div ref={probeRef} aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <span style={{ fontFamily: "var(--eg-black), Impact, sans-serif" }}>0</span>
        <span style={{ fontFamily: "var(--eg-archivo), sans-serif", fontWeight: 700 }}>0</span>
        <span style={{ fontFamily: "var(--eg-mono), monospace", fontWeight: 700 }}>0</span>
      </div>

      <div className="rl-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "video"} className={tab === "video" ? "on" : ""} disabled={locked} onClick={() => (setTab("video"), clearOuts())}>
          Video clips
        </button>
        <button type="button" role="tab" aria-selected={tab === "thumb"} className={tab === "thumb" ? "on" : ""} disabled={locked} onClick={() => (setTab("thumb"), clearOuts())}>
          Thumbnail
        </button>
      </div>

      <div className="rl-grid">
        <div className="rl-stage">
          <div className={`rl-frame${tab === "thumb" && !photo ? " rl-check" : ""}`}>
            <canvas ref={canvasRef} width={W} height={H} style={{ aspectRatio: `${W} / ${H}` }} />
          </div>
          {tab === "video" ? (
            <>
              <div className="rl-bar" aria-hidden>
                <i style={{ width: `${(locked ? progress : scrub) * 100}%` }} />
              </div>
              <label className="rl-field">
                <span>Preview frame</span>
                <input type="range" min={0} max={1} step={0.001} value={scrub} disabled={locked} onChange={(e) => setScrub(Number(e.target.value))} />
              </label>
              <div className="rl-actions">
                {busy === "record" ? (
                  <>
                    <button type="button" className="eg-btn" disabled>
                      {batch ? `${batch.i} of ${batch.n} · ${batch.name} · ` : "Recording "}
                      {Math.max(0, lengthS * (1 - progress)).toFixed(0)} s
                    </button>
                    <button type="button" className="eg-btn eg-btn-quiet" onClick={stop}>
                      Stop
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="eg-btn rl-go" disabled={locked || !fonts || !recordable} onClick={record}>
                      Record {lengthS} s video
                    </button>
                    <button type="button" className="eg-btn" disabled={locked || !fonts || !recordable} onClick={recordAll}>
                      Record all {allCount} clips · {fmtClock(allCount * (lengthS + 0.6), false)}
                    </button>
                    <button type="button" className="eg-btn eg-btn-quiet" disabled={!fonts} onClick={busy === "play" ? stop : play}>
                      {busy === "play" ? "Stop" : "Preview"}
                    </button>
                    <button type="button" className="eg-btn eg-btn-quiet" disabled={locked || !fonts} onClick={stillPng}>
                      Still PNG
                    </button>
                  </>
                )}
              </div>
              {!recordable ? <p className="rl-note">This browser cannot record a canvas. The still PNG still works.</p> : null}
            </>
          ) : (
            <div className="rl-actions">
              <button type="button" className="eg-btn rl-go" disabled={!fonts} onClick={() => still(`${p.fileBase}-thumbnail-overlay.png`, "image/png", 1080, 1920, (ctx) => drawThumb(ctx, false))}>
                Overlay PNG
              </button>
              <button type="button" className="eg-btn eg-btn-quiet" disabled={!fonts || !photo} onClick={() => still(`${p.fileBase}-thumbnail.jpg`, "image/jpeg", 1080, 1920, (ctx) => drawThumb(ctx, true))}>
                Photo + overlay JPG
              </button>
            </div>
          )}

          {outs.length ? (
            <div className="rl-out">
              <b>
                {outs.length > 1 || batch ? `${outs.length} clips ready` : outs[0].kind === "video" ? "Clip ready" : "Image ready"} · {(outs.reduce((n, o) => n + o.file.size, 0) / 1_000_000).toFixed(1)} MB
              </b>
              <div className="rl-actions">
                <button type="button" className="eg-btn rl-go" disabled={locked} onClick={() => share(outs.map((o) => o.file))}>
                  Save / share{outs.length > 1 ? " all" : ""}
                </button>
                {outs.length > 1 ? (
                  <button type="button" className="eg-btn eg-btn-quiet" disabled={locked} onClick={downloadAll}>
                    Download all
                  </button>
                ) : null}
              </div>
              <ul className="rl-files">
                {outs.map((o) => (
                  <li key={o.url}>
                    <a href={o.url} download={o.file.name}>
                      {o.file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {msg ? <p className="rl-note">{msg}</p> : null}
        </div>

        {tab === "video" ? (
          <div className="rl-controls">
            <section>
              <h2>Clip</h2>
              <Chips items={CLIPS} value={clip} onPick={setClip} disabled={locked} />
              {clip === "monitor" ? <Chips items={SCREENS} value={screen} onPick={setScreen} disabled={locked} /> : null}
              {clip === "monitor" || clip === "pace" ? <Chips items={UNITS} value={unit} onPick={setUnit} disabled={locked} /> : null}
            </section>

            <section>
              <h2>
                Video length <em>{speed >= 1.05 ? `${speed.toFixed(speed < 10 ? 1 : 0)}x real time` : speed <= 0.95 ? `${(1 / speed).toFixed(1)}x slow motion` : "1x real time"}</em>
              </h2>
              <div className="rl-row">
                <Chips items={LENGTHS.map((n) => ({ id: n, name: `${n} s` }))} value={lengthS} onPick={setLengthS} disabled={locked} />
                <label className="rl-num">
                  <input type="number" inputMode="numeric" min={1} max={MAX_LENGTH} value={lengthS} disabled={locked} onChange={(e) => setLengthS(Math.max(1, Math.min(MAX_LENGTH, Math.round(Number(e.target.value)) || 1)))} />
                  <span>s</span>
                </label>
              </div>
              <div className="rl-chips">
                <button type="button" className={`rl-chip${realTime ? " on" : ""}`} aria-pressed={realTime} disabled={locked} onClick={() => setRealTime(!realTime)}>
                  1x real time
                </button>
              </div>
            </section>

            <section>
              <h2>
                Part of the row{" "}
                <em>
                  {fmtClock(rFrom, false, pad)} to {fmtClock(rTo, false, pad)} · {fmtInt(a.m)} to {fmtInt(b.m)} m
                </em>
              </h2>
              <label className="rl-field">
                <span>From</span>
                <input type="range" min={series.startS} max={realTime ? Math.max(series.startS, series.totalS - lengthS) : series.totalS} step={1} value={rFrom} disabled={locked} onChange={(e) => setRange(Number(e.target.value), Math.max(toS, Number(e.target.value) + 2))} />
              </label>
              {realTime ? null : (
                <label className="rl-field">
                  <span>To</span>
                  <input type="range" min={series.startS} max={series.totalS} step={1} value={toS} disabled={locked} onChange={(e) => setRange(Math.min(fromS, Number(e.target.value) - 2), Number(e.target.value))} />
                </label>
              )}
              <div className="rl-chips">
                {realTime ? (
                  <>
                    <button type="button" className="rl-chip" disabled={locked} onClick={() => setFromS(series.startS)}>
                      First {lengthS} s
                    </button>
                    <button type="button" className="rl-chip" disabled={locked} onClick={() => setFromS(series.totalS - lengthS)}>
                      Last {lengthS} s
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="rl-chip" disabled={locked} onClick={() => setRange(series.startS, series.totalS)}>
                      Whole row
                    </button>
                    <button type="button" className="rl-chip" disabled={locked} onClick={() => setRange(timeAtMetres(series.totalM - 500), series.totalS)}>
                      Last 500 m
                    </button>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2>Colours</h2>
              <div className="rl-sub">Big numbers</div>
              <Chips items={COLORS} value={numColor} onPick={setNumColor} disabled={locked} swatch={(id) => id || null} />
              <div className="rl-sub">Labels and units</div>
              <Chips items={COLORS} value={labColor} onPick={setLabColor} disabled={locked} swatch={(id) => id || null} />
              <div className="rl-sub">Behind them</div>
              <Chips items={BGS} value={bg} onPick={setBg} disabled={locked} swatch={(id) => BG_SWATCH[id]} />
              <div className="rl-sub">Shape</div>
              <Chips items={FORMATS.map((f) => ({ id: f.id, name: f.name }))} value={format} onPick={setFormat} disabled={locked} />
            </section>

            <section>
              <h2>Title on top</h2>
              <Chips
                items={[
                  { id: "off" as TitleMode, name: "None" },
                  { id: "text" as TitleMode, name: "Text" },
                  ...(p.markSrc
                    ? [
                        { id: "mark" as TitleMode, name: `${p.label} mark` },
                        { id: "both" as TitleMode, name: "Mark + text" },
                      ]
                    : []),
                ]}
                value={titleMode}
                onPick={setTitleMode}
                disabled={locked}
              />
              {titleMode === "text" || titleMode === "both" ? <input className="rl-text" type="text" maxLength={40} value={titleText} disabled={locked} onChange={(e) => setTitleText(e.target.value)} aria-label="Title text" /> : null}
            </section>

            <section>
              <h2>
                {p.label} total before this row{" "}
                <em>
                  counts {fmtInt(startTotal)} to {fmtInt(startTotal + series.totalM)}
                </em>
              </h2>
              <div className="rl-row">
                <label className="rl-num wide">
                  <input type="number" inputMode="numeric" min={0} step={1} value={startTotal} disabled={locked} onChange={(e) => setStartTotal(Math.max(0, Math.round(Number(e.target.value)) || 0))} />
                  <span>m</span>
                </label>
                <button type="button" className="rl-chip" disabled={locked} onClick={() => setStartTotal(p.before)}>
                  Logged: {fmtInt(p.before)}
                </button>
                <button type="button" className="rl-chip" disabled={locked} onClick={() => setStartTotal(0)}>
                  This row only
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="rl-controls">
            <section>
              <h2>On the overlay</h2>
              <div className="rl-chips">
                <button type="button" className={`rl-chip${showDay ? " on" : ""}`} aria-pressed={showDay} onClick={() => setShowDay(!showDay)}>
                  Day number
                </button>
                <button type="button" className={`rl-chip${showTotal ? " on" : ""}`} aria-pressed={showTotal} onClick={() => setShowTotal(!showTotal)}>
                  Running total
                </button>
                {p.markSrc ? (
                  <button type="button" className={`rl-chip${showMark ? " on" : ""}`} aria-pressed={showMark} onClick={() => setShowMark(!showMark)}>
                    {p.label} mark
                  </button>
                ) : null}
              </div>
              <div className="rl-row">
                <label className="rl-num">
                  <span>Day</span>
                  <input type="number" inputMode="numeric" min={1} max={99} value={day} onChange={(e) => setDay(Math.max(1, Math.round(Number(e.target.value)) || 1))} />
                </label>
                <label className="rl-num wide">
                  <span>Total</span>
                  <input type="number" inputMode="numeric" min={0} value={startTotal + series.totalM} onChange={(e) => setStartTotal(Math.max(0, (Math.round(Number(e.target.value)) || 0) - series.totalM))} />
                  <span>m</span>
                </label>
              </div>
            </section>
            <section>
              <h2>Where and what colour</h2>
              <Chips
                items={[
                  { id: "top", name: "Top" },
                  { id: "middle", name: "Middle" },
                  { id: "bottom", name: "Bottom" },
                ]}
                value={pos}
                onPick={setPos}
              />
              <Chips
                items={[
                  { id: "white", name: "White on dark photos" },
                  { id: "ink", name: "Ink on light photos" },
                ]}
                value={color}
                onPick={setColor}
              />
            </section>
            <section>
              <h2>Try it on a photo</h2>
              <label className="eg-btn eg-btn-quiet rl-file">
                {photo ? "Change photo" : "Pick a photo"}
                <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </label>
              {photo ? (
                <button type="button" className="rl-chip" onClick={() => setPhoto(null)}>
                  Remove photo
                </button>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
