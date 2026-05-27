"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import {
  DEFAULT_OCR_SETTINGS,
  OEM_OPTIONS,
  PSM_OPTIONS,
  type OcrSettings,
  type OemKey,
  type PsmKey,
} from "@/lib/bibOcr";

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

  // Reset result when photo changes (avoids confusion — the overlay would
  // still be showing the old photo).
  useEffect(() => {
    setDebug(null);
    setState("idle");
    setError(null);
  }, [photoId]);

  async function run() {
    if (!photoId) return;
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
      setDebug((await r.json()) as DebugPayload);
      setState("ok");
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

  return (
    <main className="screen" style={{ padding: "32px 24px 96px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              Tuning · {recent.length} recent photo{recent.length === 1 ? "" : "s"}
            </div>
            <Headline
              as="h1"
              text="OCR lab."
              accent="lab."
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 36,
                letterSpacing: "-.015em",
              }}
            />
          </div>
          <Link href="/photographer/photos" className="btn btn--ghost">
            ← Library
          </Link>
        </div>

        {/* Photo picker strip */}
        {recent.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              padding: "4px 0 14px",
              marginBottom: 14,
            }}
          >
            {recent.map((p) => (
              <button
                key={p.id}
                onClick={() => setPhotoId(p.id)}
                title={p.bibs.length ? `Bibs: ${p.bibs.join(", ")}` : "Untagged"}
                style={{
                  position: "relative",
                  flex: "0 0 auto",
                  width: 86,
                  height: 86,
                  padding: 0,
                  borderRadius: 6,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "var(--cream)",
                  border: photoId === p.id ? "3px solid var(--accent)" : "1px solid var(--line)",
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

        {/* Result + controls */}
        <div
          className="ocr-lab-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* LEFT — overlay */}
          <div>
            {!photoId ? (
              <Empty>No photos yet. Upload one to start tuning.</Empty>
            ) : !debug ? (
              <Empty>
                {state === "running"
                  ? "Running OCR…"
                  : state === "err"
                    ? error ?? "Failed"
                    : "Pick a photo, tweak settings, hit Run OCR."}
              </Empty>
            ) : (
              <ResultOverlay debug={debug} />
            )}
          </div>

          {/* RIGHT — controls + lists */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Run button */}
            <div>
              <button
                className="btn btn--primary"
                onClick={run}
                disabled={state === "running" || !photoId}
                style={{ width: "100%" }}
              >
                {state === "running" ? "Running…" : "Run OCR"}
              </button>
              {debug && (
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    textAlign: "right",
                  }}
                >
                  {debug.durationMs} ms · {debug.words.length} words · {debug.bibs.length} kept
                </div>
              )}
            </div>

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
              <Field label={`Contrast linear(a=${settings.contrastA}, b=${settings.contrastB})`}>
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

function ResultOverlay({ debug }: { debug: DebugPayload }) {
  const bibSet = new Set(debug.bibs.map((b) => b.bib));
  return (
    <div
      style={{
        position: "relative",
        background: "#111",
        borderRadius: 8,
        overflow: "hidden",
        aspectRatio: `${debug.preparedWidth} / ${Math.max(debug.preparedHeight, 1)}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${debug.preparedPngBase64}`}
        alt="preprocessed for OCR"
        style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        aspectRatio: "3 / 2",
        background: "var(--cream)",
        border: "1px dashed var(--line)",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        padding: 24,
        textAlign: "center",
      }}
    >
      {children}
    </div>
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
