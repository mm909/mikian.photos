"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { END_MS, LOG_CLOSE_MS, fmtRowerNumber, nowMs } from "@/lib/row100k";
import { fileName, freeCanvas, ladder, previewTarget, render, toPdf, toPng } from "../poster/engine";
import { FORMATS, INSTAGRAM_KEYS, PRINT_KEYS, isFormatKey } from "../poster/formats";
import { communityLayout, rowerLayout } from "../poster/layouts";
import { RACE_GROUNDS, raceFileName, renderRaceDay } from "../poster/raceGround";
import type {
  CommunityPoster,
  FontBox,
  PosterAssets,
  PosterData,
  PosterFonts,
  PosterFormatKey,
  PosterGround,
  PosterLayoutLog,
  PosterPpi,
  PosterRenderTarget,
  PosterRosterRower,
  RaceDayPoster,
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

/* The race's own words, for the face loader: every glyph a race day frame
 * can set has to be loaded before the first one is drawn.
 *
 * THEY COME OFF THE PAYLOAD, not off currentRace(). This file used to hold a
 * module-level `const RACE = currentRace()` and build its own race day
 * payload from it — which in a "use client" file can never see the settings
 * row, so the studio drew the deploy-time doors and no photograph however
 * the console was set (review, 2026-09-11). The server builds the payload
 * now (poster/raceData.ts) and the studio only draws what it is handed. */
const raceWords = (d: RaceDayPoster | null | undefined): string =>
  d
    ? [
        ...d.race.head,
        d.race.piece,
        d.race.venue,
        /* No town in the list any more: the house block says the room and
         * stops (owner, 2026-09-11, taking Las Vegas off race day). */
        d.race.room,
        "SIGN UP",
        ...d.race.roles.map((r) => r.label),
      ].join(" ")
    : "";

/* The overlay preview sits on a chequer, not on the studio's cream: a
 * transparent PNG has to LOOK transparent while it is being judged. Inline
 * so no style tag carries it (theme.ts's quoting rule). It is what shows
 * when the race has no photograph to sit on, and what the backdrop chip
 * switches back to. */
const CHEQUER = {
  backgroundImage:
    "repeating-conic-gradient(#e6e5df 0% 25%, #fbfbf8 0% 50%)",
  backgroundSize: "20px 20px",
} as const;

/* THE PHOTOGRAPH BEHIND AN OVERLAY (owner, 2026-09-11: he picks the shot,
 * and "have it be black and white most likely"). The overlay export is a
 * transparent PNG and stays one — the picture belongs to the wall, not to
 * the file — so the chosen shot is laid UNDER the preview here, cropped
 * like Instagram would crop it and desaturated when he asked for black and
 * white. What he judges is what he will post; what he downloads is still a
 * hole. Inline, like the chequer, so no style tag carries it. */
const BEHIND = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

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
 * same-origin; the race photograph is not — it comes off R2 — so CORS is
 * armed BEFORE src exactly the way the post pack does it, or the canvas it
 * is drawn into is tainted and toPng throws a SecurityError. A bucket that
 * refuses the CORS fetch fails the load, which resolves null and costs the
 * picture rather than the studio. */
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imgCache.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (/^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)) {
      img.crossOrigin = "anonymous";
    }
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

type Subject = "community" | "rower" | "raceday";

export type PosterStudioProps = {
  community: CommunityPoster | null;
  rower: RowerPoster | null;
  /* RACE DAY is a server read: the race as the console has it, the field
   * count and the photograph (poster/raceData.ts). Without it there is no
   * race day chip — the studio never assembles this payload itself, because
   * a client cannot see the settings row and would draw the wrong race. */
  raceday?: RaceDayPoster | null;
  /* Which subject to open on; race day is client state, not a route. */
  initialSubject?: Subject;
  /* The picker's roster; null on the rower's own page (no picker). */
  roster: PosterRosterRower[] | null;
  /* Race day only: which ground to open on (the dev fixture's ?ground=). */
  initialGround?: PosterGround;
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
  raceday,
  initialSubject,
  initialGround,
  roster,
  fixed,
  dev,
  refusePpi,
  hrefs = { community: "/row100k/posters", rowerPrefix: "/row100k/posters?r=" },
  initialFormat,
}: PosterStudioProps) {
  const router = useRouter();
  /* Rowtember and a rower are ROUTES (the payload is a server read); race
   * day is a CHIP, because its payload does not depend on which rower is
   * picked — but it is still a server read, so a page that hands the studio
   * none offers no race day at all rather than drawing one out of the code
   * defaults (review, 2026-09-11). */
  const [raceOn, setRaceOn] = useState(initialSubject === "raceday" && raceday != null);
  const [ground, setGround] = useState<PosterGround>(initialGround ?? "ink");
  /* The overlay is judged over the real photograph by default; the chequer
   * is one chip away, because the transparency has to be judged too. */
  const [onPhoto, setOnPhoto] = useState(true);
  const race = raceOn ? (raceday ?? null) : null;
  /* The PAYLOAD decides, not the chip: without a race day payload there is
   * nothing to draw as an ad, so the studio stays on the sheet it has. */
  const subject: Subject = race ? "raceday" : rower ? "rower" : "community";
  const data: PosterData | null = race ? null : rower ? rower : community;
  /* Whatever is being drawn — the null check every effect below wants. */
  const drawing: PosterData | RaceDayPoster | null = race ?? data;

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
      // Race day's own words are drawn from the same three faces; its
      // mark is an image, but SIGN UP, the venue and the room are type.
      const sample = `${GLYPHS} ${raceWords(raceday)} ${names.join(" ")}`;
      const loads = [
        `400 100px ${f.black}`,
        `400 100px ${f.mono}`,
        `700 100px ${f.mono}`,
        `400 100px ${f.archivo}`,
        `600 100px ${f.archivo}`,
        `700 100px ${f.archivo}`,
      ].map((spec) => document.fonts.load(spec, sample).catch(() => []));
      await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 8000))]);
      const venueMark = raceday?.race.venueMark?.src ?? null;
      const photoUrl = raceday?.photo.url ?? null;
      const [bear, wordmark, venue, photo] = await Promise.all([
        loadImage(data?.partner?.bear ?? BEAR),
        loadImage(data?.partner?.wordmark ?? WORDMARK),
        // The host's mark, keyed white on transparent, same-origin like the
        // rest. A null here is not fatal: the host module keeps its block
        // and sets the gym's name in type instead.
        venueMark ? loadImage(venueMark) : Promise.resolve(null),
        // The owner's picture, off R2 and through CORS. A null is what the
        // photo ground falls back to the solid ad on, and the notes say so.
        photoUrl ? loadImage(photoUrl) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      // Re-read after the loads: the line boxes belong to the real faces.
      setFonts(read());
      setAssets({ bear, wordmark, venue, photo });
    })();
    return () => {
      cancelled = true;
    };
    // The payload names only matter on first load; the subject is fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* THE RENDER: the preview at once, the full-res after a debounce. */
  useEffect(() => {
    if (!fonts || !assets || !drawing) return;
    const my = ++seq.current;
    const stale = () => seq.current !== my;
    // One draw for both passes. Race day brings its own pipeline because
    // its ground is ink or nothing at all, never the engine's cream.
    const drawOn = (t: PosterRenderTarget) =>
      race
        ? renderRaceDay({ target: t, data: race, fonts, assets, ground })
        : subject === "rower"
          ? render({ target: t, layout: rowerLayout, data: data as RowerPoster, fonts, assets })
          : render({ target: t, layout: communityLayout, data: data as CommunityPoster, fonts, assets });

    // The preview, drawn immediately.
    try {
      const css = frameRef.current?.clientWidth || 720;
      const pt = previewTarget(format, Math.min(1000, Math.max(320, css)), window.devicePixelRatio || 1);
      const drawn = drawOn(pt);
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
          const drawn = drawOn(target);
          let png: Blob;
          let pdf: Blob | null = null;
          try {
            png = await toPng(drawn.canvas);
            // No PDF for a transparent overlay: a PDF carries the canvas as
            // a JPEG and a JPEG has no alpha, so the window would print
            // solid black. The overlay is a PNG and says so.
            if (format.kind === "print" && !(race && ground === "overlay"))
              pdf = await toPdf(drawn.canvas, target);
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
              subject,
              ground: race ? ground : null,
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
  }, [fonts, assets, data, race, ground, subject, format, ppi, bleed, refusePpi]);

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

  /* Race day stems its files off the race itself — raceday-2026-09-27-story
   * -overlay.png — the way the other two stem off the year and the rower. */
  const nameFor = (ext: "png" | "pdf", target: PosterRenderTarget): string => {
    const opts = { ppi: target.ppi, bleed: target.bleedIn > 0 };
    if (race) return raceFileName(race, format, ext, { ground, ...opts });
    return data ? fileName(data, format, ext, opts) : `rowtember.${ext}`;
  };

  /* SHARE hands over the PNG only — Instagram's sheet takes images; the
   * PDF is DOWNLOAD. The File is built synchronously from a blob that
   * already exists, inside the tap. */
  const share = async () => {
    const out = filesRef.current;
    if (!out || !drawing) return;
    const name = nameFor("png", out.target);
    const file = new File([out.png], name, { type: "image/png" });
    const title = race
      ? `${race.race.head.join(" ")} · ${race.race.date}`
      : data?.kind === "rower"
        ? `Rower ${fmtRowerNumber(data.rower.rowerNumber)} · poster`
        : `Rowtember ${data?.year ?? ""} · poster`;
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
    if (!out || !drawing) return;
    const name = nameFor("png", out.target);
    saveBlob(out.png, name);
    setStatus(`SAVED ${name.toUpperCase()}`);
  };

  const downloadPdf = () => {
    const out = filesRef.current;
    if (!out?.pdf || !drawing) return;
    const name = nameFor("pdf", out.target);
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
  const overlay = subject === "raceday" && ground === "overlay";
  const flattened = subject === "raceday" && ground === "photo";
  // Null when the bucket cannot be read or the race has no gallery behind
  // it; the photo ground is not offered at all then.
  const photo = race?.photo.url ? race.photo : null;
  const onPicture = overlay && onPhoto && photo !== null;
  // The picture is in the payload but the browser could not fetch it (a
  // bucket that refuses CORS, a key that has been deleted): raceGround.ts
  // has drawn the solid ad instead, and that has to be said out loud.
  const photoFailed = flattened && photo !== null && assets !== null && !assets.photo;
  const now = nowMs();
  const lateLogs = now >= END_MS && now < LOG_CLOSE_MS;
  const fellBack = files?.target.fellBack ?? false;
  const shareIsPrimary = canShareFiles && handheld;
  const tallFrame = format.h / format.w > 1.3;
  const untilNote = data?.blackout.until ? ` UNTIL ${data.blackout.until.toUpperCase()}` : "";

  if (!drawing) {
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
              <Link
                className={subject === "community" ? "on" : undefined}
                href={hrefs.community}
                onClick={() => setRaceOn(false)}
              >
                Rowtember
              </Link>
              <button
                ref={chipRef}
                type="button"
                className={subject === "rower" ? "on" : undefined}
                aria-pressed={subject === "rower"}
                aria-expanded={open}
                onClick={() => {
                  setRaceOn(false);
                  if (open) close();
                  else {
                    setQ("");
                    setOpen(true);
                  }
                }}
              >
                {rower ? `${fmtRowerNumber(rower.rower.rowerNumber)} · ${rower.rower.name} ▾` : "A rower ▾"}
              </button>
              {/* The ad, not a summary. It is a chip and not a route — the
                  payload does not depend on which rower is picked — but it
                  IS a server read (the settings row and the photograph), so
                  a page that handed the studio none offers no ad. */}
              <button
                type="button"
                className={subject === "raceday" ? "on" : undefined}
                aria-pressed={subject === "raceday"}
                disabled={!raceday}
                title={raceday ? undefined : "The race day payload could not be read"}
                onClick={() => {
                  setOpen(false);
                  setRaceOn(true);
                }}
              >
                Race day
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

      {subject === "raceday" ? (
        <div className="st-sub po-opts" role="group" aria-label="Ground">
          {/* ON THE PHOTO is only a ground when there IS a photograph: with
              no picture to draw it would be the solid ad under another
              name. */}
          {RACE_GROUNDS.filter((g) => g.key !== "photo" || photo).map((g) => (
            <button
              key={g.key}
              type="button"
              className={ground === g.key ? "on" : undefined}
              aria-pressed={ground === g.key}
              onClick={() => setGround(g.key)}
            >
              {g.label}
            </button>
          ))}
          {/* The bleed chip's idiom: the same row, past a dot. Only an
              overlay has anything behind it, and only when the race has a
              photograph to put there. */}
          {overlay && photo ? (
            <>
              <span className="po-sep" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                className={onPhoto ? "on" : undefined}
                aria-pressed={onPhoto}
                onClick={() => setOnPhoto((v) => !v)}
              >
                Behind {onPhoto ? "the photo" : "the chequer"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

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
          ...(overlay && !onPicture ? CHEQUER : null),
        }}
      >
        {onPicture && photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="po-behind"
            src={photo.url ?? ""}
            alt=""
            aria-hidden="true"
            /* THE SAME CORS MODE AS THE CANVAS LOAD, and it is not
               decoration: this tag and loadImage() fetch the same URL, and a
               plain <img> caches a response with no CORS headers on it. The
               crossOrigin load then reuses that entry and FAILS — which is
               exactly what happened flipping Overlay → On the photo in one
               session: the picture vanished out of the drawn ad and the
               frame fell back to the solid one. Both requests ask the same
               way, so there is one cache entry and it works for both. */
            crossOrigin="anonymous"
            style={{ ...BEHIND, ...(photo.bw ? { filter: "grayscale(1)" } : null) }}
          />
        ) : null}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`${subject === "rower" ? "Rower" : subject === "raceday" ? "Race day" : "Rowtember"} poster preview, ${format.label}`}
            style={onPicture ? { position: "relative" } : undefined}
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
        {/* The one thing that blocks posting rather than building: the mark
            is OUR key of the gym logo, not a file they gave us. */}
        {race ? <li>Show {race.race.venue} these frames before anything is posted</li> : null}
        {overlay ? <li>Overlay — PNG only, a PDF has no alpha</li> : null}
        {overlay ? <li>Put the subject in the open band and keep other brands out of it</li> : null}
        {/* THE PICTURE IS A PREVIEW ON AN OVERLAY. The file that downloads
            is a hole, so neither the pick nor the black and white switch is
            in it — saying so here is what stops a grey preview being
            approved and a colour post going out (review, 2026-09-11). */}
        {onPicture ? (
          <li>
            Behind — the race photo{photo?.bw ? ", black and white" : ""}; a preview of what you lay
            this over. The file is transparent, so the pick and the switch are not in it — On the
            photo is
          </li>
        ) : null}
        {flattened && photo ? (
          <li>On the photo — the picture is IN this file{photo.bw ? ", black and white" : ""}</li>
        ) : null}
        {photoFailed ? (
          <li>The race photo could not be loaded — the solid ad was drawn instead</li>
        ) : null}
        {overlay && !photo ? <li>No race photo yet — the gallery is empty or unreachable</li> : null}
      </ul>
      {race ? (
        <div className="po-log">
          <div>
            <span className="k">The caption — post it with the file</span>
          </div>
          <pre>{race.caption}</pre>
        </div>
      ) : null}

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
        {format.kind === "print" && !overlay ? (
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
            <pre>{JSON.stringify(drawing, null, 1)}</pre>
          </details>
        </div>
      ) : null}
    </>
  );
}
