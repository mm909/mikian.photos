"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { END_MS, LOG_CLOSE_MS, fmtRowerNumber, nowMs } from "@/lib/row100k";
import { fileName, freeCanvas, ladder, previewTarget, render, toPdf, toPng } from "../poster/engine";
import { FORMATS, INSTAGRAM_KEYS, PRINT_KEYS, isFormatKey } from "../poster/formats";
import { communityLayout, rowerLayout } from "../poster/layouts";
import type {
  CommunityPoster,
  FontBox,
  PosterAssets,
  PosterData,
  PosterFonts,
  PosterFormatKey,
  PosterLayoutLog,
  PosterPpi,
  PosterRenderTarget,
  PosterRosterRower,
  RowerPoster,
} from "../poster/types";

/* THE POSTER STUDIO (SPEC.md §11). Pick the subject — Rowtember, or one
 * rower — pick the format, watch the preview, then SHARE, DOWNLOAD PNG or
 * DOWNLOAD PDF. The server has already gathered everything into a
 * serialisable payload (poster/data.ts); this component only draws.
 *
 * Two canvases, never mounted: the preview (about a thousand pixels wide,
 * drawn at once on every change) and the full-res render, which follows
 * after a 300 ms debounce and whose blobs are KEPT — SHARE has to build
 * its File synchronously inside the tap, the way post/PostPack.tsx does,
 * or iOS refuses the share sheet. Only one full-res canvas is alive at a
 * time and it is freed the moment it has been encoded.
 *
 * Fonts: next/font hashes the family names, so the real names — and the
 * line boxes those families make — are read off three laid-out probes
 * (PostPack.readFonts + boxOf under the .po- prefix), and every face is
 * loaded through document.fonts.load with the poster's glyph set before
 * the first draw: the unicode-range subsets load lazily and the metric
 * override fallbacks report "loaded" too, so fonts.check is not proof. */

const BEAR = "/row100k/partners/grizzly-bear.png";
const WORDMARK = "/row100k/partners/grizzly-wordmark.png";
const FORMAT_KEY = "row100k.poster.format";
const BLEED_IN = 0.125;
/* The glyphs a poster can carry that a lazily-subset face may not have
 * loaded yet: digits and punctuation, the arrows, a run of accented
 * capitals; every name in the payload is appended at load time. */
const GLYPHS = "0123456789 ,.:/%#·—…→←‘’ AÁÉÍÓÚÑÖØÜ ÆŒ ROWTEMBER";

const PROBE_SIZE = 100;

/* PostPack.boxOf: the probe is one line at PROBE_SIZE with
 * line-height:normal, so its height IS the normal line height, and the
 * zero-sized strut inside sits on the baseline. */
function boxOf(probe: HTMLElement | null): FontBox | undefined {
  if (!probe) return undefined;
  const strut = probe.querySelector(".po-strut");
  if (!strut) return undefined;
  const line = probe.getBoundingClientRect();
  const base = strut.getBoundingClientRect();
  const lh = line.height / PROBE_SIZE;
  const baseline = (base.bottom - line.top) / PROBE_SIZE;
  if (!(lh > 0) || !(baseline > 0) || baseline > lh) return undefined;
  return { lh, baseline };
}

/* PostPack.saveBlob: object URL, a download anchor, click, revoke later. */
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

/* PostPack.loadImage: once per URL, never rejects. The marks are
 * same-origin, so no crossOrigin. */
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imgCache.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imgCache.set(url, pending);
  return pending;
}

const mb = (blob: Blob): string => `${(blob.size / 1_048_576).toFixed(1)} MB`;

/* RowerSearch.fold / search / SHOWN — the roster idiom, copied so the
 * picker ranks names exactly the way the profile's nameplate search does. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
const SHOWN = 8;
type Hit = { rower: PosterRosterRower; score: number };
function search(roster: PosterRosterRower[], query: string): Hit[] {
  const q = fold(query);
  if (!q) return [];
  const digits = /^[0-9]+$/.test(q);
  const hits: Hit[] = [];
  for (const rower of roster) {
    const pad = fmtRowerNumber(rower.rowerNumber);
    const name = fold(rower.displayName);
    let score: number | null = null;
    if (digits) {
      if (Number(q) === rower.rowerNumber) score = 0;
      else if (pad.startsWith(q)) score = 1;
      else if (pad.includes(q)) score = 4;
    }
    const at = name.indexOf(q);
    if (at >= 0) {
      const wordStart = at === 0 || /[\s\-.']/.test(name.charAt(at - 1));
      const byName = wordStart ? 2 : 3;
      if (score === null || byName < score) score = byName;
    }
    if (score !== null) hits.push({ rower, score });
  }
  hits.sort((a, b) => a.score - b.score || a.rower.rowerNumber - b.rower.rowerNumber);
  return hits;
}

type Files = { png: Blob; pdf: Blob | null; target: PosterRenderTarget };

export type PosterStudioProps = {
  community: CommunityPoster | null;
  rower: RowerPoster | null;
  /* The picker's roster; null on the rower's own page (no picker). */
  roster: PosterRosterRower[] | null;
  /* The subject is fixed (the rower's own page): no SUBJECT chips. */
  fixed?: boolean;
  /* The dev fixture: the layout log and the payload under the preview. */
  dev?: boolean;
  /* Dev: the ppi the ladder must refuse (?noprobe=300) so the fallback
   * path is exercised on a desktop that can allocate anything. */
  refusePpi?: PosterPpi | null;
  /* Where the SUBJECT chips go. The rower href gets the number appended. */
  hrefs?: { community: string; rowerPrefix: string };
  initialFormat?: PosterFormatKey;
};

export function PosterStudio({
  community,
  rower,
  roster,
  fixed,
  dev,
  refusePpi,
  hrefs = { community: "/row100k/posters", rowerPrefix: "/row100k/posters?r=" },
  initialFormat,
}: PosterStudioProps) {
  const router = useRouter();
  const subject: "community" | "rower" = rower ? "rower" : "community";
  const data: PosterData | null = subject === "rower" ? rower : community;

  const blackProbe = useRef<HTMLDivElement | null>(null);
  const monoProbe = useRef<HTMLDivElement | null>(null);
  const archivoProbe = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [formatKey, setFormatKey] = useState<PosterFormatKey>(initialFormat ?? "24x36");
  const format = FORMATS[formatKey];
  const [ppi, setPpi] = useState<PosterPpi>(format.ppi?.default ?? 150);
  const [bleed, setBleed] = useState(false);
  const [fonts, setFonts] = useState<PosterFonts | null>(null);
  const [assets, setAssets] = useState<PosterAssets | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const [log, setLog] = useState<PosterLayoutLog | null>(null);
  const [files, setFiles] = useState<Files | null>(null);
  const filesRef = useRef<Files | null>(null);
  const [status, setStatus] = useState<string>("WAITING FOR FONTS");
  const [rendering, setRendering] = useState(true);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [handheld, setHandheld] = useState(false);
  const [refused300, setRefused300] = useState(false);
  const seq = useRef(0);

  // The remembered format, read after mount so the server markup matches.
  useEffect(() => {
    if (initialFormat) return;
    try {
      const saved = window.sessionStorage.getItem(FORMAT_KEY);
      if (isFormatKey(saved)) {
        setFormatKey(saved);
        // The remembered format's own default ppi (Letter/A4 are 300), not
        // the first format's (review, 2026-09-10).
        setPpi(FORMATS[saved].ppi?.default ?? 150);
      }
    } catch {
      /* private mode, blocked storage — the default stands */
    }
  }, [initialFormat]);

  useEffect(() => {
    setCanShareFiles(typeof navigator.canShare === "function");
    try {
      setHandheld(window.matchMedia("(pointer: coarse)").matches);
    } catch {
      setHandheld(false);
    }
  }, []);

  /* The fonts and the marks, once. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* older browsers paint in the fallback family */
      }
      const read = (): PosterFonts => ({
        black: blackProbe.current ? window.getComputedStyle(blackProbe.current).fontFamily : "sans-serif",
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
      const f = read();
      // Every face and weight, with every glyph the sheet can carry.
      const names: string[] = [];
      for (const d of [community, rower]) {
        if (!d) continue;
        if (d.kind === "community") {
          for (const r of [...d.standings.men, ...d.standings.women]) names.push(r.name);
          for (const r of d.club.roll) names.push(r.name);
          for (const rec of d.records) for (const l of rec.lines) names.push(l.holder.name);
        } else {
          names.push(d.rower.name);
          for (const l of d.log) names.push(l.title);
        }
      }
      const sample = `${GLYPHS} ${names.join(" ")}`;
      const loads = [
        `400 100px ${f.black}`,
        `400 100px ${f.mono}`,
        `700 100px ${f.mono}`,
        `400 100px ${f.archivo}`,
        `600 100px ${f.archivo}`,
        `700 100px ${f.archivo}`,
      ].map((spec) => document.fonts.load(spec, sample).catch(() => []));
      await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 8000))]);
      const [bear, wordmark] = await Promise.all([
        loadImage(data?.partner?.bear ?? BEAR),
        loadImage(data?.partner?.wordmark ?? WORDMARK),
      ]);
      if (cancelled) return;
      // Re-read after the loads: the line boxes belong to the real faces.
      setFonts(read());
      setAssets({ bear, wordmark });
    })();
    return () => {
      cancelled = true;
    };
    // The payload names only matter on first load; the subject is fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* THE RENDER: the preview at once, the full-res after a debounce. */
  useEffect(() => {
    if (!fonts || !assets || !data) return;
    const my = ++seq.current;
    const stale = () => seq.current !== my;

    // The preview, drawn immediately.
    try {
      const css = frameRef.current?.clientWidth || 720;
      const pt = previewTarget(format, Math.min(1000, Math.max(320, css)), window.devicePixelRatio || 1);
      const drawn =
        subject === "rower"
          ? render({ target: pt, layout: rowerLayout, data: data as RowerPoster, fonts, assets })
          : render({ target: pt, layout: communityLayout, data: data as CommunityPoster, fonts, assets });
      setLog(drawn.log);
      void toPng(drawn.canvas)
        .then((blob) => {
          freeCanvas(drawn.canvas);
          if (stale()) return;
          const url = URL.createObjectURL(blob);
          if (previewRef.current) URL.revokeObjectURL(previewRef.current);
          previewRef.current = url;
          setPreview(url);
        })
        .catch((err) => {
          freeCanvas(drawn.canvas);
          console.error("row100k/poster: preview encode failed", err);
        });
    } catch (err) {
      console.error("row100k/poster: preview failed", err);
      setStatus("THE PREVIEW COULD NOT BE DRAWN");
    }

    setFiles(null);
    filesRef.current = null;
    setRendering(true);
    setStatus("RENDERING …");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const target = await ladder(
            format,
            format.kind === "print" ? ppi : null,
            bleed ? BLEED_IN : 0,
            refusePpi ? [refusePpi] : [],
          );
          if (stale()) return;
          if (format.kind === "print" && ppi === 300 && target.ppi !== 300) setRefused300(true);
          setStatus(`RENDERING ${target.pxW} × ${target.pxH} …`);
          // Let the status paint before the main thread goes under. A
          // background tab never fires requestAnimationFrame, so a timer
          // stands in for it there — the render must not wait for a tab
          // to be looked at.
          await new Promise<void>((r) => {
            let done = false;
            const go = () => {
              if (done) return;
              done = true;
              setTimeout(r, 0);
            };
            requestAnimationFrame(go);
            setTimeout(go, 120);
          });
          if (stale()) return;
          const drawn =
            subject === "rower"
              ? render({ target, layout: rowerLayout, data: data as RowerPoster, fonts, assets })
              : render({ target, layout: communityLayout, data: data as CommunityPoster, fonts, assets });
          let png: Blob;
          let pdf: Blob | null = null;
          try {
            png = await toPng(drawn.canvas);
            if (format.kind === "print") pdf = await toPdf(drawn.canvas, target);
          } finally {
            freeCanvas(drawn.canvas);
          }
          if (stale()) return;
          const out = { png, pdf, target };
          filesRef.current = out;
          setFiles(out);
          setRendering(false);
          // The dev fixture's verification hook: the last files and the
          // layout log, readable from the Browser pane (SPEC.md §13.5).
          if (dev) {
            (window as unknown as { __rowtemberPoster?: unknown }).__rowtemberPoster = {
              format: format.key,
              target,
              png,
              pdf,
              log: drawn.log,
            };
          }
          const size = `${target.pxW} × ${target.pxH}`;
          const p = target.ppi ? ` · ${target.ppi} PPI` : "";
          setStatus(`READY · ${size}${p} · ${mb(png)} PNG${pdf ? ` · ${mb(pdf)} PDF` : ""}`);
        } catch (err) {
          if (stale()) return;
          console.error("row100k/poster: render failed", err);
          setRendering(false);
          setStatus("THE POSTER COULD NOT BE RENDERED ON THIS DEVICE");
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
    // The two data casts follow `subject`, which the layouts are picked by.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, assets, data, subject, format, ppi, bleed, refusePpi]);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const pickFormat = (key: PosterFormatKey) => {
    setFormatKey(key);
    const f = FORMATS[key];
    setPpi(f.ppi?.default ?? 150);
    try {
      window.sessionStorage.setItem(FORMAT_KEY, key);
    } catch {
      /* nothing to remember with */
    }
  };

  /* SHARE hands over the PNG only — Instagram's sheet takes images; the
   * PDF is DOWNLOAD. The File is built synchronously from a blob that
   * already exists, inside the tap. */
  const share = async () => {
    const out = filesRef.current;
    if (!out || !data) return;
    const name = fileName(data, format, "png", { ppi: out.target.ppi, bleed: out.target.bleedIn > 0 });
    const file = new File([out.png], name, { type: "image/png" });
    const title =
      data.kind === "rower"
        ? `Rower ${fmtRowerNumber(data.rower.rowerNumber)} · poster`
        : `Rowtember ${data.year} · poster`;
    const payload = { files: [file], title };
    if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
      try {
        await navigator.share(payload);
        setStatus(`SHARED ${name.toUpperCase()}`);
        return;
      } catch (err) {
        // A dismissed sheet is a choice, not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    saveBlob(out.png, name);
    setStatus(`SAVED ${name.toUpperCase()}`);
  };

  const downloadPng = () => {
    const out = filesRef.current;
    if (!out || !data) return;
    const name = fileName(data, format, "png", { ppi: out.target.ppi, bleed: out.target.bleedIn > 0 });
    saveBlob(out.png, name);
    setStatus(`SAVED ${name.toUpperCase()}`);
  };

  const downloadPdf = () => {
    const out = filesRef.current;
    if (!out?.pdf || !data) return;
    const name = fileName(data, format, "pdf", { ppi: out.target.ppi, bleed: out.target.bleedIn > 0 });
    saveBlob(out.pdf, name);
    setStatus(`SAVED ${name.toUpperCase()}`);
  };

  /* ---- the roster picker (RowerSearch idiom, panel under the chips) ---- */
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const chipRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLInputElement>(null);
  const close = () => {
    setOpen(false);
    chipRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      chipRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const hits = useMemo(() => (open && roster ? search(roster, q) : []), [open, roster, q]);
  const shown = hits.slice(0, SHOWN);
  const more = hits.length - shown.length;
  const typed = q.trim() !== "";
  const go = (num: number) => {
    setOpen(false);
    router.push(`${hrefs.rowerPrefix}${num}`);
  };
  const onEnter = (e: ReactKeyEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || hits.length !== 1) return;
    e.preventDefault();
    go(hits[0].rower.rowerNumber);
  };

  /* ---- what the sheet says about itself ---- */
  const masked = data ? (data.kind === "community" ? data.blackout.active : data.masked) : false;
  const now = nowMs();
  const lateLogs = now >= END_MS && now < LOG_CLOSE_MS;
  const fellBack = files?.target.fellBack ?? false;
  const shareIsPrimary = canShareFiles && handheld;
  const tallFrame = format.h / format.w > 1.3;
  const untilNote = data?.blackout.until ? ` UNTIL ${data.blackout.until.toUpperCase()}` : "";

  if (!data) {
    return <p className="po-first">NOTHING TO DRAW — THE PAYLOAD IS EMPTY</p>;
  }

  return (
    <>
      <div ref={blackProbe} aria-hidden className="po-probe blk">
        Hxg
        <i className="po-strut" />
      </div>
      <div ref={monoProbe} aria-hidden className="po-probe mn">
        Hxg
        <i className="po-strut" />
      </div>
      <div ref={archivoProbe} aria-hidden className="po-probe arc">
        Hxg
        <i className="po-strut" />
      </div>

      {!fixed && (
        <>
          <p className="po-eye">Subject</p>
          <div className="po-subject">
            <div className="tabs" role="group" aria-label="Subject" style={{ marginBottom: 0 }}>
              <Link className={subject === "community" ? "on" : undefined} href={hrefs.community}>
                Rowtember
              </Link>
              <button
                ref={chipRef}
                type="button"
                className={subject === "rower" ? "on" : undefined}
                aria-pressed={subject === "rower"}
                aria-expanded={open}
                onClick={() => {
                  if (open) close();
                  else {
                    setQ("");
                    setOpen(true);
                  }
                }}
              >
                {rower ? `${fmtRowerNumber(rower.rower.rowerNumber)} · ${rower.rower.name} ▾` : "A rower ▾"}
              </button>
            </div>
            {open ? <div className="pf-find-overlay" onClick={close} aria-hidden="true" /> : null}
            <div className="pf-find" role="search" aria-label="Find a rower" hidden={!open}>
              <input
                ref={boxRef}
                type="text"
                className="pf-find-in"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onEnter}
                placeholder="NAME OR NUMBER"
                aria-label="Find a rower by name or number"
                autoComplete="off"
                spellCheck={false}
              />
              {!roster || roster.length === 0 ? (
                <p className="pf-find-note">THE ROSTER COULD NOT BE READ.</p>
              ) : typed && shown.length === 0 ? (
                <p className="pf-find-note">NOBODY BY THAT NAME OR NUMBER.</p>
              ) : shown.length === 0 ? null : (
                <ul className="pf-find-list">
                  {shown.map(({ rower: r }) => (
                    <li key={r.rowerNumber}>
                      <Link
                        className="pf-find-row"
                        href={`${hrefs.rowerPrefix}${r.rowerNumber}`}
                        onClick={() => setOpen(false)}
                      >
                        <span className="n">{fmtRowerNumber(r.rowerNumber)}</span>
                        <span className="nm">{r.displayName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {more > 0 ? <p className="pf-find-more">{more} MORE — KEEP TYPING</p> : null}
            </div>
          </div>
        </>
      )}

      <div className="po-groups">
        <div className="po-group">
          <p className="po-eye">Print</p>
          <div className="tabs" role="group" aria-label="Print formats">
            {PRINT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={formatKey === key ? "on" : undefined}
                aria-pressed={formatKey === key}
                onClick={() => pickFormat(key)}
              >
                {FORMATS[key].label}
              </button>
            ))}
          </div>
        </div>
        <div className="po-group">
          <p className="po-eye">Instagram</p>
          <div className="tabs" role="group" aria-label="Instagram formats">
            {INSTAGRAM_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={formatKey === key ? "on" : undefined}
                aria-pressed={formatKey === key}
                onClick={() => pickFormat(key)}
              >
                {FORMATS[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {format.kind === "print" && format.ppi ? (
        <div className="st-sub po-opts" role="group" aria-label="Print options">
          {format.ppi.options.map((p) => (
            <button
              key={p}
              type="button"
              className={ppi === p ? "on" : undefined}
              aria-pressed={ppi === p}
              disabled={p === 300 && refused300}
              title={p === 300 && refused300 ? "This device cannot make 300 ppi" : undefined}
              onClick={() => setPpi(p)}
            >
              {p} ppi
            </button>
          ))}
          <span className="po-sep" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            className={bleed ? "on" : undefined}
            aria-pressed={bleed}
            onClick={() => setBleed((v) => !v)}
          >
            Bleed {bleed ? "on" : "off"}
          </button>
        </div>
      ) : null}

      <div
        ref={frameRef}
        className="po-frame"
        style={{
          aspectRatio: `${format.w} / ${format.h}`,
          width: tallFrame ? `min(100%, calc(60vh * ${(format.w / format.h).toFixed(4)}))` : "100%",
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`${subject === "rower" ? "Rower" : "Rowtember"} poster preview, ${format.label}`}
          />
        ) : (
          <span className="po-wait">{fonts ? "Drawing" : "Waiting for fonts"}</span>
        )}
      </div>
      <p className="po-status" aria-live="polite">
        {status}
      </p>
      <ul className="po-notes">
        {format.kind === "print" ? <li>Print borderless or trim to size</li> : null}
        {fellBack && files ? <li>Rendered at {files.target.ppi} ppi — this device cannot make 300</li> : null}
        {masked ? <li>Blackout — this poster prints with blocks{untilNote}</li> : null}
        {lateLogs ? <li>Late logs through Oct 3 — the poster reads final</li> : null}
      </ul>

      <div className="po-acts">
        {canShareFiles ? (
          <button
            type="button"
            className={shareIsPrimary ? "po-btn primary" : "po-btn"}
            onClick={() => void share()}
            disabled={rendering || !files}
          >
            Share
          </button>
        ) : null}
        <button
          type="button"
          className={shareIsPrimary ? "po-btn" : "po-btn primary"}
          onClick={downloadPng}
          disabled={rendering || !files}
        >
          Download PNG
        </button>
        {format.kind === "print" ? (
          <button type="button" className="po-btn" onClick={downloadPdf} disabled={rendering || !files?.pdf}>
            Download PDF
          </button>
        ) : null}
      </div>

      {dev && log ? (
        <div className="po-log">
          <div>
            <span className="k">plan </span>
            {log.plan}
            <span className="k"> · slack </span>
            <span className={log.slack < 0 ? "neg" : undefined}>{log.slack}</span>
            {log.dropped.length ? (
              <>
                <span className="k"> · dropped </span>
                {log.dropped.join(", ")}
              </>
            ) : null}
            {log.shrinks.length ? (
              <>
                <span className="k"> · shrinks </span>
                {log.shrinks.join(" → ")}
              </>
            ) : null}
          </div>
          {log.rows.map((r) => (
            <div key={r.id}>
              <span className="k">{r.id} </span>
              {r.h}
              <span className="k"> · </span>
              {r.slots.join(" | ")}
            </div>
          ))}
          <details>
            <summary>The payload</summary>
            <pre>{JSON.stringify(data, null, 1)}</pre>
          </details>
        </div>
      ) : null}
    </>
  );
}
