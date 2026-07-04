"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Roster import UI (client).
 *
 * Flow: pick an event → paste a results link OR CSV/table text (or upload a
 * .csv) → Preview (dryRun) shows the detected source + first rows + warnings →
 * Import commits. Shows the current stored roster count with a Clear button.
 * Phone-friendly; uses the shared .btn/.input/.card classes + inline styles
 * (no new CSS).
 *
 * When the detected source is a live URL we can't scrape (Race Roster, Athlinks,
 * ChronoTrack…), the API returns 0 rows with an honest guidance warning telling
 * the owner to export the CSV — we surface that prominently.
 */

type EventOption = { id: string; name: string };

type ParsedRow = {
  bib: number;
  name: string;
  distance?: string;
  finishTime?: string;
  ageGroup?: string;
  gender?: string;
  city?: string;
};

type PreviewResponse = {
  dryRun: true;
  eventId: string;
  source: string;
  sourceLabel: string;
  isUrl: boolean;
  total: number;
  warnings: string[];
  preview: ParsedRow[];
  previewTruncated: boolean;
};

type ImportResponse = {
  ok: boolean;
  eventId: string;
  source: string;
  sourceLabel: string;
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  warnings: string[];
  rosterCount: number;
};

type SampleRow = {
  bib: number;
  name: string;
  distance: string | null;
  finishTime: string | null;
  gender: string | null;
  ageGroup: string | null;
  city: string | null;
};

type StatusResponse = {
  eventId: string;
  count: number;
  sample: SampleRow[];
};

const MONO = "var(--font-mono)";

export function RosterImportClient({
  events,
  initialEventId,
}: {
  events: EventOption[];
  initialEventId: string;
}) {
  const [eventId, setEventId] = useState(initialEventId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | "preview" | "import" | "clear">(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const eventName =
    events.find((e) => e.id === eventId)?.name ?? eventId;

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/admin/roster-import?eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store" }
      );
      if (!r.ok) {
        setStatus(null);
        return;
      }
      setStatus((await r.json()) as StatusResponse);
    } catch {
      setStatus(null);
    }
  }, [eventId]);

  useEffect(() => {
    // Reset the transient panels when the event changes, then refresh count.
    setPreview(null);
    setResult(null);
    setError(null);
    void loadStatus();
  }, [eventId, loadStatus]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setInput(text);
      setPreview(null);
      setResult(null);
      setError(null);
    } catch {
      setError("Could not read that file.");
    }
  }

  async function doPreview() {
    if (!input.trim()) {
      setError("Paste a results link or CSV/table text first.");
      return;
    }
    setBusy("preview");
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const r = await fetch("/api/admin/roster-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, input, dryRun: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || `Preview failed (${r.status}).`);
        return;
      }
      setPreview(j as PreviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    if (!input.trim()) {
      setError("Nothing to import — paste or preview first.");
      return;
    }
    setBusy("import");
    setError(null);
    try {
      const r = await fetch("/api/admin/roster-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, input, dryRun: false }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || `Import failed (${r.status}).`);
        return;
      }
      setResult(j as ImportResponse);
      setPreview(null);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  }

  async function doClear() {
    if (!confirm(`Delete the entire stored roster for "${eventName}"? This can't be undone.`))
      return;
    setBusy("clear");
    setError(null);
    try {
      const r = await fetch("/api/admin/roster-import/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || `Clear failed (${r.status}).`);
        return;
      }
      setResult(null);
      setPreview(null);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed.");
    } finally {
      setBusy(null);
    }
  }

  const previewIsGuidance = preview != null && preview.total === 0;

  return (
    <main className="screen" style={{ padding: "28px 20px 72px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 4,
            }}
          >
            Owner · Roster import
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 28,
              letterSpacing: "-.015em",
            }}
          >
            Import a race roster.
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8, marginBottom: 0 }}>
            Paste a results link, or paste CSV / table text, or upload a .csv exported from your
            timing provider. Preview the parsed rows, then import. Rows dedupe by bib.
          </p>
        </div>

        {/* Event + current count */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <label style={{ flex: 1, minWidth: 220 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                Event
              </span>
              <select
                className="input"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 14 }}
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </option>
                ))}
              </select>
            </label>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: "var(--muted)",
                whiteSpace: "nowrap",
                paddingBottom: 8,
              }}
            >
              Stored roster:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {status ? status.count : "…"}
              </strong>{" "}
              {status && status.count === 1 ? "entrant" : "entrants"}
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={doClear}
              disabled={busy != null || !status || status.count === 0}
              title="Delete the whole stored roster for this event"
              style={{ paddingBottom: 8 }}
            >
              {busy === "clear" ? "Clearing…" : "Clear roster"}
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Results link, CSV, or table text
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain,.tsv,.txt"
                onChange={onFile}
                style={{ display: "none" }}
              />
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => fileRef.current?.click()}
                disabled={busy != null}
                type="button"
              >
                Upload .csv
              </button>
              {input && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setInput("");
                    setPreview(null);
                    setResult(null);
                    setError(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  disabled={busy != null}
                  type="button"
                >
                  Clear text
                </button>
              )}
            </div>
          </div>
          <textarea
            className="input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            placeholder={
              "Paste a results URL (RunSignup, Race Roster, Athlinks…)\n" +
              "— or —\n" +
              "Bib,Name,Time,Gender,Age,City\n" +
              "101,Jane Doe,1:32:04,F,34,Long Beach\n" +
              "102,John Smith,1:45:10,M,41,San Pedro"
            }
            rows={9}
            spellCheck={false}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 13,
              fontFamily: MONO,
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="btn btn--ghost"
              onClick={doPreview}
              disabled={busy != null || !input.trim()}
              type="button"
            >
              {busy === "preview" ? "Detecting…" : "Preview"}
            </button>
            <button
              className="btn btn--primary"
              onClick={doImport}
              disabled={busy != null || !input.trim() || previewIsGuidance}
              type="button"
              title={
                previewIsGuidance
                  ? "Nothing to import — export a CSV as described above"
                  : "Import the parsed rows"
              }
            >
              {busy === "import" ? "Importing…" : "Import"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              color: "var(--accent)",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Import result */}
        {result && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              Imported · {result.sourceLabel}
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }}>
              <ResultStat label="New" value={result.imported} />
              <ResultStat label="Updated" value={result.updated} />
              <ResultStat label="Skipped" value={result.skipped} />
              <ResultStat label="Roster now" value={result.rosterCount} strong />
            </div>
            <Warnings warnings={result.warnings} />
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Preview · detected {preview.sourceLabel}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--muted)" }}>
                {preview.total} row{preview.total === 1 ? "" : "s"} parsed
                {preview.previewTruncated ? ` · showing first ${preview.preview.length}` : ""}
              </div>
            </div>

            {previewIsGuidance ? (
              <GuidanceBox warnings={preview.warnings} isUrl={preview.isUrl} />
            ) : (
              <>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table
                    style={{
                      borderCollapse: "collapse",
                      width: "100%",
                      minWidth: 560,
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        {["Bib", "Name", "Distance", "Time", "Sex", "Age", "City"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "6px 10px",
                              fontFamily: MONO,
                              fontSize: 10,
                              letterSpacing: ".1em",
                              textTransform: "uppercase",
                              color: "var(--muted)",
                              borderBottom: "1px solid var(--line)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, i) => (
                        <tr key={`${row.bib}-${i}`}>
                          <Td mono>{row.bib}</Td>
                          <Td>{row.name || <span style={{ color: "var(--line)" }}>—</span>}</Td>
                          <Td muted>{row.distance || "—"}</Td>
                          <Td mono muted>
                            {row.finishTime || "—"}
                          </Td>
                          <Td muted>{row.gender || "—"}</Td>
                          <Td muted>{row.ageGroup || "—"}</Td>
                          <Td muted>{row.city || "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Warnings warnings={preview.warnings} />
                <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                  Looks right? Press <strong>Import</strong> to write these {preview.total} row
                  {preview.total === 1 ? "" : "s"} (existing bibs are updated in place).
                </p>
              </>
            )}
          </div>
        )}

        {/* Stored sample */}
        {status && status.count > 0 && (
          <div className="card" style={{ padding: 16 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 10,
              }}
            >
              Stored roster · {eventName} · {status.count} total
              {status.sample.length < status.count ? ` (showing ${status.sample.length})` : ""}
            </div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  minWidth: 480,
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    {["Bib", "Name", "Distance", "Time"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          fontFamily: MONO,
                          fontSize: 10,
                          letterSpacing: ".1em",
                          textTransform: "uppercase",
                          color: "var(--muted)",
                          borderBottom: "1px solid var(--line)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status.sample.map((row) => (
                    <tr key={row.bib}>
                      <Td mono>{row.bib}</Td>
                      <Td>{row.name || "—"}</Td>
                      <Td muted>{row.distance || "—"}</Td>
                      <Td mono muted>
                        {row.finishTime || "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ResultStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: MONO,
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
          fontSize: strong ? 22 : 20,
          fontWeight: strong ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Td({
  children,
  mono,
  muted,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      style={{
        padding: "6px 10px",
        borderBottom: "1px solid var(--line)",
        fontFamily: mono ? MONO : undefined,
        color: muted ? "var(--muted)" : "var(--ink)",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        whiteSpace: "nowrap",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {children}
    </td>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <ul
      style={{
        margin: "12px 0 0",
        paddingLeft: 18,
        color: "var(--muted)",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {warnings.map((w, i) => (
        <li key={i}>{w}</li>
      ))}
    </ul>
  );
}

/** Prominent honest-guidance panel for live URLs we can't scrape. */
function GuidanceBox({ warnings, isUrl }: { warnings: string[]; isUrl: boolean }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--cream)",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        {isUrl ? "Couldn't read this link automatically" : "Nothing parsed"}
      </div>
      {warnings.map((w, i) => (
        <p
          key={i}
          style={{
            margin: i === 0 ? 0 : "8px 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          {w}
        </p>
      ))}
    </div>
  );
}
