"use client";

export type Bbox = { x0: number; y0: number; x1: number; y1: number };
export type Word = { text: string; confidence: number; bbox: Bbox };
export type Rejected = { word: Word; reason: string };

export type DebugPayload = {
  preparedPngBase64: string;
  preparedWidth: number;
  preparedHeight: number;
  pageConfidence: number;
  rawText: string;
  words: Word[];
  bibs: { bib: number; confidence: number }[];
  rejected: Rejected[];
};

export type OcrState = "idle" | "running" | "ok" | "err";

type ControlsProps = {
  /** Latest debug payload (null until first run completes). */
  debug: DebugPayload | null;
  state: OcrState;
  error: string | null;
  onRun: () => void;
};

/**
 * Right-pane OCR debug controls + readouts.
 *
 * The big preprocessed-image overlay (`OcrTesseractView` below) used to live
 * here too, but the modal needs ONE image surface — original preview by
 * default, swap to the Tesseract view after OCR runs. So this panel is now
 * purely controlled: parent owns the state machine and we render a run
 * button, summary stats, and the kept/rejected/raw text breakdowns.
 */
export function OcrDebugPanel({ debug, state, error, onRun }: ControlsProps) {
  return (
    <div>
      {state === "idle" && (
        <button className="btn btn--ghost btn--sm" onClick={onRun} style={{ width: "100%" }}>
          Show OCR intermediates
        </button>
      )}
      {state === "running" && (
        <button className="btn btn--ghost btn--sm" disabled style={{ width: "100%" }}>
          Running Tesseract… (~5–25s)
        </button>
      )}
      {state === "err" && (
        <>
          <button
            className="btn btn--ghost btn--sm"
            onClick={onRun}
            style={{ width: "100%", color: "var(--accent)" }}
          >
            ↻ Retry OCR debug
          </button>
          {error && (
            <div style={{ marginTop: 6, color: "var(--accent)", fontSize: 12 }}>{error}</div>
          )}
        </>
      )}
      {state === "ok" && debug && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <button className="btn btn--ghost btn--sm" onClick={onRun} style={{ width: "100%" }}>
            ↻ Re-run OCR debug
          </button>
          <DebugStats debug={debug} />
          <DebugLists debug={debug} />
        </div>
      )}
    </div>
  );
}

/**
 * Modal-left-pane Tesseract view: the preprocessed image (exactly what
 * Tesseract saw) with bbox overlays drawn on top.
 *
 * - Green box = digits parsed into a kept bib detection
 * - Red box   = digit-like token Tesseract found but the filter rejected
 * - Faint box = non-digit word (visual reference only)
 *
 * Coordinate space is the preprocessed image's native pixel space; SVG scales
 * with whatever container size we render at.
 */
export function OcrTesseractView({ debug }: { debug: DebugPayload }) {
  const keptDigitWords = new Set<string>();
  const bibSet = new Set(debug.bibs.map((b) => b.bib));
  for (const w of debug.words) {
    const digits = w.text.replace(/[^0-9]/g, "");
    if (digits.length === 0) continue;
    const n = Number(digits);
    if (bibSet.has(n)) keptDigitWords.add(`${w.bbox.x0},${w.bbox.y0},${w.bbox.x1},${w.bbox.y1}`);
  }

  return (
    <div
      style={{
        position: "relative",
        background: "#111",
        borderRadius: 6,
        overflow: "hidden",
        width: "100%",
        maxHeight: "82vh",
        aspectRatio: `${debug.preparedWidth} / ${Math.max(debug.preparedHeight, 1)}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${debug.preparedPngBase64}`}
        alt="preprocessed for OCR"
        style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
      />
      <svg
        viewBox={`0 0 ${debug.preparedWidth} ${debug.preparedHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {debug.words.map((w, i) => {
          const key = `${w.bbox.x0},${w.bbox.y0},${w.bbox.x1},${w.bbox.y1}`;
          const digits = w.text.replace(/[^0-9]/g, "");
          const kept = keptDigitWords.has(key);
          const hasDigits = digits.length > 0;
          const wasRejected =
            !kept &&
            hasDigits &&
            debug.rejected.some(
              (r) => r.word.bbox.x0 === w.bbox.x0 && r.word.bbox.y0 === w.bbox.y0
            );
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
                  {digits}·{(w.confidence * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend />
    </div>
  );
}

function DebugStats({ debug }: { debug: DebugPayload }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 6,
      }}
    >
      <MiniStat label="Page conf" value={`${(debug.pageConfidence * 100).toFixed(0)}%`} />
      <MiniStat label="Words" value={debug.words.length.toString()} />
      <MiniStat label="Kept bibs" value={debug.bibs.length.toString()} />
      <MiniStat label="Rejected" value={debug.rejected.length.toString()} muted />
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 6,
        left: 6,
        display: "flex",
        gap: 10,
        background: "rgba(0,0,0,.55)",
        color: "#fdf8f1",
        padding: "4px 8px",
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: ".1em",
        textTransform: "uppercase",
      }}
    >
      <LegendItem swatch="#3fd17d" label="kept" />
      <LegendItem swatch="#ff7152" label="rejected" />
      <LegendItem swatch="rgba(255,255,255,.35)" label="non-digit" />
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 2,
          border: `2px solid ${swatch}`,
        }}
      />
      {label}
    </span>
  );
}

function DebugLists({ debug }: { debug: DebugPayload }) {
  return (
    <>
      {debug.bibs.length > 0 && (
        <Box title={`Kept bibs (${debug.bibs.length})`}>
          {debug.bibs.map((b) => (
            <div key={b.bib} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)" }}>
                #{b.bib}
              </span>
              <span style={{ color: "var(--muted)", fontSize: 11 }}>
                {(b.confidence * 100).toFixed(1)}% confidence
              </span>
            </div>
          ))}
        </Box>
      )}

      {debug.rejected.length > 0 && (
        <Box title={`Rejected digit-like tokens (${debug.rejected.length})`}>
          {debug.rejected.map((r, i) => (
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
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                {JSON.stringify(r.word.text)}
              </span>
              <span style={{ color: "var(--muted)" }}>{r.reason}</span>
              <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {(r.word.confidence * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </Box>
      )}

      {debug.rawText.trim() && (
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
              wordBreak: "break-word",
            }}
          >
            {debug.rawText.trim()}
          </pre>
        </Box>
      )}
    </>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 10,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

function MiniStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 5,
        padding: "6px 8px",
        opacity: muted ? 0.7 : 1,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 17,
          fontWeight: 500,
          color: "var(--ink)",
          marginTop: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
