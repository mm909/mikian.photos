"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_OCR_SETTINGS,
  OEM_OPTIONS,
  PROVIDER_OPTIONS,
  PSM_OPTIONS,
  type OcrSettings,
  type OemKey,
  type ProviderKey,
  type PsmKey,
} from "@/lib/bibOcrTypes";

type Bbox = { x0: number; y0: number; x1: number; y1: number };
type Word = { text: string; confidence: number; bbox: Bbox };
type Rejected = { word: Word; reason: string };

type DebugPayload = {
  preparedPngBase64: string;
  preparedWidth: number;
  preparedHeight: number;
  pageConfidence: number;
  rawText: string;
  words: Word[];
  bibs: { bib: number; confidence: number }[];
  rejected: Rejected[];
  settings: OcrSettings;
  durationMs: number;
};

type RecentPhoto = { id: string; previewUrl: string; bibs: number[] };
type State = "idle" | "running" | "ok" | "err";

export function OcrLab({
  recent,
  initialPhotoId,
}: {
  recent: RecentPhoto[];
  initialPhotoId?: string;
}) {
  const [photoId, setPhotoId] = useState<string | null>(
    initialPhotoId ?? recent[0]?.id ?? null
  );
  const [settings, setSettings] = useState<OcrSettings>(DEFAULT_OCR_SETTINGS);
  const [debug, setDebug] = useState<DebugPayload | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  /** In-session cache: (photoId + settings) → DebugPayload. Saves Rekognition
   *  API calls when the user clicks Run with the same config repeatedly.
   *  Wiped on page reload — fine for a lab tool. */
  const cacheRef = useRef<Map<string, DebugPayload>>(new Map());
  function cacheKey(pid: string, s: OcrSettings) {
    return `${pid}|${JSON.stringify(s)}`;
  }

  /** Per-thumb refs so we can scroll the active one into view when the user
   *  navigates with arrow keys. Without this, the highlight runs off-screen
   *  in the horizontally-scrolling strip. */
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    if (!photoId) return;
    const el = thumbRefs.current[photoId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [photoId]);
  /** When debug is loaded, this controls whether the single image box shows
   *  the Original photo or the OCR-prepared view with bbox overlays. Flips
   *  to true on a successful run; user can toggle back with the chip. */
  const [showOcrView, setShowOcrView] = useState(false);

  // Reset result when photo changes (avoids confusion — the overlay would
  // still be showing the old photo).
  useEffect(() => {
    setDebug(null);
    setState("idle");
    setError(null);
    setShowOcrView(false);
  }, [photoId]);

  // Arrow-key navigation through the recent photo strip. Skips when focus is
  // inside an editable element so we don't hijack input typing.
  const currentIndex = useMemo(
    () => recent.findIndex((p) => p.id === photoId),
    [recent, photoId]
  );
  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setPhotoId(recent[currentIndex - 1].id);
  }, [currentIndex, recent]);
  const goNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= recent.length - 1) return;
    setPhotoId(recent[currentIndex + 1].id);
  }, [currentIndex, recent]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  async function run(opts: { force?: boolean } = {}) {
    if (!photoId) return;
    const key = cacheKey(photoId, settings);
    if (!opts.force) {
      const cached = cacheRef.current.get(key);
      if (cached) {
        setDebug(cached);
        setState("ok");
        setShowOcrView(true);
        return;
      }
    }
    setState("running");
    setError(null);
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/ocr-debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `${r.status}`);
      }
      const d = (await r.json()) as DebugPayload;
      cacheRef.current.set(key, d);
      setDebug(d);
      setState("ok");
      // Auto-flip to the OCR view on success — that's why you ran it.
      setShowOcrView(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("err");
    }
  }

  const settingsJson = useMemo(() => JSON.stringify(settings, null, 2), [settings]);
  function resetDefaults() {
    setSettings(DEFAULT_OCR_SETTINGS);
  }

  function patch<K extends keyof OcrSettings>(key: K, value: OcrSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  const selectedPhoto = photoId ? recent.find((r) => r.id === photoId) ?? null : null;

  return (
    <main
      className="screen ocr-lab-main"
      style={{
        padding: "12px 16px 16px",
        // dvh respects mobile address-bar collapse; max-height keeps the
        // page strictly within the viewport so the photo box can't push
        // the page into a scroll. Nav-h fallback is generous to cover
        // chunkier nav variants.
        maxHeight: "calc(100dvh - var(--nav-h, 80px))",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 0,
        }}
      >
        {/* Compact header — single row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 20,
                letterSpacing: "-.012em",
                color: "var(--ink)",
              }}
            >
              OCR <em className="acc-l" style={{ fontStyle: "italic" }}>lab</em>
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              {recent.length} photo{recent.length === 1 ? "" : "s"}
              {debug && ` · ${debug.durationMs}ms · ${debug.bibs.length} kept`}
            </span>
          </div>
        </div>

        {/* Photo picker strip — smaller tiles. Active thumb auto-scrolls
            into view when the user navigates with arrow keys. */}
        {recent.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 5,
              overflowX: "auto",
              padding: "2px 0 4px",
              flex: "0 0 auto",
            }}
          >
            {recent.map((p) => (
              <button
                key={p.id}
                ref={(el) => {
                  thumbRefs.current[p.id] = el;
                }}
                onClick={() => setPhotoId(p.id)}
                title={p.bibs.length ? `Bibs: ${p.bibs.join(", ")}` : "Untagged"}
                style={{
                  position: "relative",
                  flex: "0 0 auto",
                  width: 62,
                  height: 62,
                  padding: 0,
                  borderRadius: 5,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "var(--cream)",
                  border:
                    photoId === p.id ? "2px solid var(--accent)" : "1px solid var(--line)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Result + controls — both panes constrained, scroll independently */}
        <div
          className="ocr-lab-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gridTemplateRows: "minmax(0, 1fr)",
            gap: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LEFT — ONE image box. Shows original by default; flips to the
             OCR preprocessed view + bbox overlays after a run. A toggle chip
             in the top-right swaps between them. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 0,
            }}
          >
            {!photoId ? (
              <Empty>No photos yet. Upload one to start tuning.</Empty>
            ) : (
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  minHeight: 0,
                  background: showOcrView && debug ? "#111" : "var(--cream)",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showOcrView && debug ? (
                  <ResultOverlay debug={debug} fitHeight />
                ) : selectedPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPhoto.previewUrl}
                    alt=""
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                ) : null}

                {/* Status badge — when OCR is running or failed, surface that
                    in the image box instead of replacing the photo. */}
                {(state === "running" || state === "err") && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      background: state === "err" ? "var(--accent)" : "rgba(0,0,0,.65)",
                      color: "var(--paper)",
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {state === "running" ? "Running OCR…" : `Failed: ${error ?? "unknown"}`}
                  </div>
                )}

                {/* Toggle chip — only visible after a successful run */}
                {debug && state === "ok" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      background: "rgba(0,0,0,.55)",
                      borderRadius: 6,
                      padding: 2,
                      gap: 2,
                    }}
                  >
                    <ToggleChip
                      label="Original"
                      active={!showOcrView}
                      onClick={() => setShowOcrView(false)}
                    />
                    <ToggleChip
                      label="OCR view"
                      active={showOcrView}
                      onClick={() => setShowOcrView(true)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — controls + lists. Scrolls within its grid cell so the
             whole page stays viewport-fit. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 0,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {/* Run button. The cache returns a memoised result instantly for
                identical (photoId + settings). "Force re-run" bypasses it
                when you want to hit the provider again. */}
            {(() => {
              const hasCachedFor = photoId
                ? cacheRef.current.has(cacheKey(photoId, settings))
                : false;
              return (
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "var(--paper)",
                    paddingBottom: 4,
                    zIndex: 1,
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn--primary"
                      onClick={() => run()}
                      disabled={state === "running" || !photoId}
                      style={{ flex: 1 }}
                    >
                      {state === "running"
                        ? "Running…"
                        : hasCachedFor
                          ? "Show cached"
                          : "Run OCR"}
                    </button>
                    {hasCachedFor && state !== "running" && (
                      <button
                        className="btn btn--ghost"
                        onClick={() => run({ force: true })}
                        title="Bypass cache and call the provider again"
                      >
                        ↻ Force
                      </button>
                    )}
                  </div>
                  {debug && (
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: ".12em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                        textAlign: "right",
                      }}
                    >
                      {debug.durationMs} ms · {debug.words.length} words ·{" "}
                      {debug.bibs.length} kept
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Result chips */}
            {debug && debug.bibs.length > 0 && (
              <Box title={`Kept bibs (${debug.bibs.length})`}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {debug.bibs.map((b) => (
                    <span
                      key={b.bib}
                      style={{
                        background: "var(--green, #3b8c5f)",
                        color: "var(--paper)",
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      }}
                    >
                      #{b.bib} · {(b.confidence * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </Box>
            )}

            <Box title="Provider">
              <Field label="OCR backend">
                <Select
                  value={settings.provider}
                  onChange={(v) => patch("provider", v as ProviderKey)}
                  options={Object.entries(PROVIDER_OPTIONS).map(([k, label]) => ({
                    value: k,
                    label,
                  }))}
                />
              </Field>
            </Box>

            {settings.provider === "tesseract" && (
              <Box title="Tesseract">
                <Field label="PSM (page seg)">
                  <Select
                    value={settings.psm}
                    onChange={(v) => patch("psm", v as PsmKey)}
                    options={Object.entries(PSM_OPTIONS).map(([k, label]) => ({
                      value: k,
                      label: `${k} — ${label}`,
                    }))}
                  />
                </Field>
                <Field label="OEM (engine)">
                  <Select
                    value={settings.oem}
                    onChange={(v) => patch("oem", v as OemKey)}
                    options={Object.entries(OEM_OPTIONS).map(([k, label]) => ({
                      value: k,
                      label: `${k} — ${label}`,
                    }))}
                  />
                </Field>
                <Toggle
                  label="Whitelist digits only"
                  value={settings.whitelistDigits}
                  onChange={(v) => patch("whitelistDigits", v)}
                />
              </Box>
            )}

            <Box title="Preprocessing">
              <Field label={`Prep width: ${settings.prepWidth}px`}>
                <Slider
                  min={1200}
                  max={4500}
                  step={100}
                  value={settings.prepWidth}
                  onChange={(v) => patch("prepWidth", v)}
                />
              </Field>
              {settings.provider === "tesseract" ? (
                <>
                  <Toggle
                    label="Sharpen"
                    value={settings.sharpen}
                    onChange={(v) => patch("sharpen", v)}
                  />
                  <Toggle
                    label="Normalize (histogram stretch)"
                    value={settings.normalize}
                    onChange={(v) => patch("normalize", v)}
                  />
                  <Field
                    label={`Contrast linear(a=${settings.contrastA}, b=${settings.contrastB})`}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <NumberInput
                        value={settings.contrastA}
                        step={0.05}
                        min={0.5}
                        max={2.5}
                        onChange={(v) => patch("contrastA", v)}
                      />
                      <NumberInput
                        value={settings.contrastB}
                        step={2}
                        min={-60}
                        max={60}
                        onChange={(v) => patch("contrastB", v)}
                      />
                    </div>
                  </Field>
                  <Field
                    label={
                      settings.threshold == null
                        ? "Threshold (binarize): off"
                        : `Threshold (binarize): ${settings.threshold}`
                    }
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Slider
                        min={0}
                        max={255}
                        step={1}
                        value={settings.threshold ?? 128}
                        onChange={(v) => patch("threshold", v)}
                        disabled={settings.threshold == null}
                      />
                      <Toggle
                        label="on"
                        inline
                        value={settings.threshold != null}
                        onChange={(v) => patch("threshold", v ? 128 : null)}
                      />
                    </div>
                  </Field>
                  <Toggle
                    label="Invert (negate)"
                    value={settings.invert}
                    onChange={(v) => patch("invert", v)}
                  />
                </>
              ) : (
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    color: "var(--muted)",
                    lineHeight: 1.4,
                  }}
                >
                  Rekognition is trained on real-world photos — sharpen / contrast /
                  threshold / invert are not applied. Only prep width (byte-size cap)
                  has effect.
                </div>
              )}
            </Box>

            <Box title="Bib filter">
              <Field label={`Min digits: ${settings.minDigits}`}>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={settings.minDigits}
                  onChange={(v) => patch("minDigits", v)}
                />
              </Field>
              <Field label={`Max digits: ${settings.maxDigits}`}>
                <Slider
                  min={3}
                  max={7}
                  step={1}
                  value={settings.maxDigits}
                  onChange={(v) => patch("maxDigits", v)}
                />
              </Field>
              <Field label={`Floor 1-digit: ${(settings.floor1 * 100).toFixed(0)}%`}>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.floor1}
                  onChange={(v) => patch("floor1", v)}
                />
              </Field>
              <Field label={`Floor 2-digit: ${(settings.floor2 * 100).toFixed(0)}%`}>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.floor2}
                  onChange={(v) => patch("floor2", v)}
                />
              </Field>
              <Field label={`Floor 3-digit: ${(settings.floor3 * 100).toFixed(0)}%`}>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.floor3}
                  onChange={(v) => patch("floor3", v)}
                />
              </Field>
              <Field label={`Floor 4-5 digit: ${(settings.floor4plus * 100).toFixed(0)}%`}>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.floor4plus}
                  onChange={(v) => patch("floor4plus", v)}
                />
              </Field>
            </Box>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={resetDefaults}
                style={{ flex: 1 }}
              >
                Reset to defaults
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => navigator.clipboard?.writeText(settingsJson)}
                style={{ flex: 1 }}
              >
                Copy settings JSON
              </button>
            </div>

            {debug && debug.rejected.length > 0 && (
              <Box title={`Rejected (${debug.rejected.length})`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {debug.rejected.slice(0, 30).map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 8,
                        fontSize: 11,
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}
                      >
                        {JSON.stringify(r.word.text)}
                      </span>
                      <span style={{ color: "var(--muted)" }}>{r.reason}</span>
                      <span
                        style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}
                      >
                        {(r.word.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  {debug.rejected.length > 30 && (
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>
                      …and {debug.rejected.length - 30} more
                    </div>
                  )}
                </div>
              </Box>
            )}

            {debug && debug.rawText.trim() && (
              <Box title="Raw OCR text">
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    background: "var(--cream)",
                    borderRadius: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--ink)",
                    maxHeight: 160,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {debug.rawText.trim()}
                </pre>
              </Box>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .ocr-lab-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

function ResultOverlay({
  debug,
  fitHeight,
}: {
  debug: DebugPayload;
  /** When true, fill the parent height instead of using intrinsic aspect ratio.
   *  Used in the viewport-fit layout where the left column owns its height. */
  fitHeight?: boolean;
}) {
  const bibSet = new Set(debug.bibs.map((b) => b.bib));
  return (
    <div
      style={{
        position: "relative",
        background: "#111",
        borderRadius: 8,
        overflow: "hidden",
        width: "100%",
        height: fitHeight ? "100%" : undefined,
        aspectRatio: fitHeight
          ? undefined
          : `${debug.preparedWidth} / ${Math.max(debug.preparedHeight, 1)}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${debug.preparedPngBase64}`}
        alt="preprocessed for OCR"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: fitHeight ? "contain" : "cover",
        }}
      />
      <svg
        viewBox={`0 0 ${debug.preparedWidth} ${debug.preparedHeight}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {debug.words.map((w, i) => {
          const digits = w.text.replace(/[^0-9]/g, "");
          const n = digits.length > 0 ? Number(digits) : NaN;
          const kept = Number.isFinite(n) && bibSet.has(n);
          const hasDigits = digits.length > 0;
          const wasRejected =
            !kept && hasDigits && debug.rejected.some((r) => r.word.bbox.x0 === w.bbox.x0 && r.word.bbox.y0 === w.bbox.y0);
          const stroke = kept ? "#3fd17d" : wasRejected ? "#ff7152" : "rgba(255,255,255,.35)";
          const strokeWidth = kept ? 5 : wasRejected ? 4 : 2;
          const w_ = w.bbox.x1 - w.bbox.x0;
          const h_ = w.bbox.y1 - w.bbox.y0;
          return (
            <g key={i}>
              <rect
                x={w.bbox.x0}
                y={w.bbox.y0}
                width={w_}
                height={h_}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {(kept || wasRejected) && (
                <text
                  x={w.bbox.x0}
                  y={Math.max(w.bbox.y0 - 6, 14)}
                  fill={kept ? "#3fd17d" : "#ff7152"}
                  fontSize={Math.max(h_ * 0.6, 16)}
                  fontFamily="ui-monospace, monospace"
                  fontWeight="700"
                >
                  {(digits || w.text) + "·" + (w.confidence * 100).toFixed(0) + "%"}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          right: 8,
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          background: "rgba(0,0,0,.55)",
          color: "#fdf8f1",
          padding: "5px 10px",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        <span>page conf {(debug.pageConfidence * 100).toFixed(0)}%</span>
        <span>
          {debug.preparedWidth}×{debug.preparedHeight}
        </span>
        <span>{debug.durationMs}ms</span>
      </div>
    </div>
  );
}

function Empty({
  children,
  compact,
}: {
  children: React.ReactNode;
  /** Slim banner used in the lab when an Original preview is also showing —
   *  avoids the big aspect-ratio box when we just want a one-liner. */
  compact?: boolean;
}) {
  return (
    <div
      style={{
        ...(compact
          ? { padding: "10px 14px" }
          : { aspectRatio: "3 / 2", padding: 24 }),
        background: "var(--cream)",
        border: "1px dashed var(--line)",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontFamily: "var(--font-sans)",
        fontSize: compact ? 12 : 14,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        background: active ? "var(--paper)" : "transparent",
        color: active ? "var(--ink)" : "var(--paper)",
        border: 0,
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 12,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="input"
      style={{ padding: "6px 8px", fontSize: 13, width: "100%" }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
      style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  value,
  onChange,
  inline,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  inline?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: inline ? 11 : 13,
        color: "var(--ink)",
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer" }}
      />
      {label}
    </label>
  );
}
