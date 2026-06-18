"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ACCESS_MODES,
  ACCESS_MODE_LABELS,
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
} from "@/lib/eventConfig";

export type AdminEvent = {
  id: string;
  name: string;
  date: string;
  city: string;
  org: string;
  type: string;
  status: string;
  accessMode: string;
  secretLinkToken: string | null;
  isFree: boolean;
  bundlePriceCents: number | null;
  ocrEnabled: boolean;
  faceRecEnabled: boolean;
  colorGroupEnabled: boolean;
  colorGroupLabels: Record<string, string> | null;
  externalBrowseUrl: string | null;
  searchHeadline: string | null;
  hasGalleryPassword: boolean;
  ownerId: string | null;
  createdAt: string;
  photoCount: number;
  photographerCount: number;
};

const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--muted)",
};

const FIELD: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  fontSize: 14,
  background: "var(--paper, #fff)",
  color: "var(--ink)",
};

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function isoToDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function EventsAdminClient() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api<{ events: AdminEvent[] }>("/api/admin/events");
      setEvents(d.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="screen" style={{ padding: "40px 24px 96px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 32,
              color: "var(--ink)",
            }}
          >
            Events
          </h1>
          <button className="btn btn--primary" onClick={() => setCreating((c) => !c)}>
            {creating ? "Cancel" : "+ New event"}
          </button>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 16, color: "var(--accent)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {creating && (
          <CreateEventForm
            onCreated={() => {
              setCreating(false);
              void load();
            }}
          />
        )}

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</div>
          ) : events.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>No events yet.</div>
          ) : (
            events.map((ev) => <EventRow key={ev.id} ev={ev} />)
          )}
        </div>
      </div>
    </main>
  );
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("camp");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({ name, type, date, status: "draft" }),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 20,
        padding: 20,
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "var(--cream)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={LABEL}>New event (starts as draft)</div>
      <Row>
        <Labeled label="Type">
          <select style={FIELD} value={type} onChange={(e) => setType(e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Date">
          <input style={FIELD} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
      </Row>
      <Row>
        <Labeled label="Name">
          <input style={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Smith Wedding" />
        </Labeled>
      </Row>
      {err && <div style={{ color: "var(--accent)", fontSize: 13 }}>{err}</div>}
      <div>
        <button className="btn btn--primary" disabled={busy || !name || !date} onClick={() => void submit()}>
          {busy ? "Creating…" : "Create event"}
        </button>
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: AdminEvent }) {
  return (
    <Link
      href={`/e/${ev.id}/settings`}
      style={{
        display: "block",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink)" }}>
        {ev.name}
      </div>
      <div style={{ ...LABEL, marginTop: 4 }}>
        /e/{ev.id} · {ev.type} · {ev.status} · {ev.accessMode} ·{" "}
        {ev.isFree ? "free" : priceLabel(ev.bundlePriceCents)} · {ev.photoCount} photos ·{" "}
        {ev.photographerCount} photographers · settings →
      </div>
    </Link>
  );
}

function priceLabel(cents: number | null): string {
  if (cents == null) return "default price";
  return `$${(cents / 100).toFixed(2)}`;
}

export function EventEditor({ ev, onChanged }: { ev: AdminEvent; onChanged: () => Promise<void> }) {
  const [type, setType] = useState(ev.type);
  const [status, setStatus] = useState(ev.status);
  const [accessMode, setAccessMode] = useState(ev.accessMode);
  const [isFree, setIsFree] = useState(ev.isFree);
  const [priceDollars, setPriceDollars] = useState(
    ev.bundlePriceCents != null ? (ev.bundlePriceCents / 100).toFixed(2) : ""
  );
  const [ocrEnabled, setOcrEnabled] = useState(ev.ocrEnabled);
  const [faceRecEnabled, setFaceRecEnabled] = useState(ev.faceRecEnabled);
  const [externalBrowseUrl, setExternalBrowseUrl] = useState(ev.externalBrowseUrl ?? "");
  const [searchHeadline, setSearchHeadline] = useState(ev.searchHeadline ?? "");
  // Password input is write-only — we never receive the plaintext back. Empty =
  // "leave unchanged"; we show whether one is already set via hasGalleryPassword.
  const [galleryPassword, setGalleryPassword] = useState("");
  const [hasGalleryPassword, setHasGalleryPassword] = useState(ev.hasGalleryPassword);
  const [date, setDate] = useState(isoToDateInput(ev.date));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState(ev.secretLinkToken);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        type,
        status,
        accessMode,
        isFree,
        ocrEnabled,
        faceRecEnabled,
        externalBrowseUrl: externalBrowseUrl.trim() || null,
        searchHeadline: searchHeadline.trim() || null,
        // Only send the password when the owner typed a new one (else keep it).
        ...(galleryPassword.trim() ? { galleryPassword: galleryPassword.trim() } : {}),
        date,
        bundlePriceCents:
          priceDollars.trim() === "" ? null : Math.round(parseFloat(priceDollars) * 100),
      };
      const d = await api<{ event: AdminEvent }>(`/api/admin/events/${ev.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setToken(d.event.secretLinkToken);
      setHasGalleryPassword(d.event.hasGalleryPassword);
      setGalleryPassword("");
      setMsg("Saved.");
      await onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    // Rotating mints a new token and invalidates the current one — anyone you've
    // already shared the ?k= link with loses access until you resend the new
    // link. Confirm before the destructive change (mirrors RerunDetection).
    if (
      !window.confirm(
        "Rotate the secure link?\n\nThe current link (the one ending in ?k=…) will stop working immediately. Anyone you've already shared it with will lose access until you send them the new link.\n\nContinue?"
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ secretLinkToken: string }>(
        `/api/admin/events/${ev.id}/rotate-link`,
        { method: "POST" }
      );
      setToken(d.secretLinkToken);
      setAccessMode("secure-link");
      setMsg("Secure link rotated.");
      await onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const secureUrl =
    (accessMode === "secure-link" || accessMode === "private") && token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${ev.id}?k=${token}`
      : null;

  return (
    <div style={{ display: "grid", gap: 26 }}>
      <Section title="Basics">
        <Labeled label="Type">
          <select style={FIELD} value={type} onChange={(e) => setType(e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Status">
          <select style={FIELD} value={status} onChange={(e) => setStatus(e.target.value)}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Date">
          <input style={FIELD} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
      </Section>

      <Section title="Access">
        <Labeled label="Who can view">
          <select style={FIELD} value={accessMode} onChange={(e) => setAccessMode(e.target.value)}>
            {ACCESS_MODES.map((m) => (
              <option key={m} value={m}>{ACCESS_MODE_LABELS[m]}</option>
            ))}
          </select>
        </Labeled>
        {secureUrl && (
          <Labeled label="Secret link">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                style={{ ...FIELD, fontSize: 12, flex: 1, minWidth: 220 }}
                readOnly
                value={secureUrl}
              />
              <button
                className="btn btn--ghost"
                onClick={() => void navigator.clipboard?.writeText(secureUrl)}
              >
                Copy
              </button>
              <button className="btn btn--ghost" disabled={busy} onClick={() => void rotate()}>
                Rotate
              </button>
            </div>
          </Labeled>
        )}
        {accessMode === "password" && (
          <Labeled label="Gallery password">
            <input
              style={FIELD}
              type="text"
              value={galleryPassword}
              onChange={(e) => setGalleryPassword(e.target.value)}
              placeholder={
                hasGalleryPassword
                  ? "•••••• (set — leave blank to keep)"
                  : "Set a password (e.g. firefly2026)"
              }
              autoComplete="off"
            />
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Visitors type this to enter the gallery — share it instead of a long link.{" "}
              {hasGalleryPassword ? "A password is currently set." : "No password set yet."}
            </div>
          </Labeled>
        )}
      </Section>

      <Section title="Pricing">
        <Labeled label="Pricing">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            Free event (skip payment)
          </label>
        </Labeled>
        <Labeled label="Bundle price ($)">
          <input
            style={{ ...FIELD, opacity: isFree ? 0.5 : 1 }}
            value={priceDollars}
            disabled={isFree}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="default"
            inputMode="decimal"
          />
        </Labeled>
      </Section>

      <Section title="Detection">
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={ocrEnabled} onChange={(e) => setOcrEnabled(e.target.checked)} />
            Bib OCR
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={faceRecEnabled} onChange={(e) => setFaceRecEnabled(e.target.checked)} />
            Face recognition
          </label>
        </div>
      </Section>

      <Section title="Runner page">
        <Labeled label="Custom header (optional)">
          <input
            style={FIELD}
            value={searchHeadline}
            onChange={(e) => setSearchHeadline(e.target.value)}
            placeholder="Find your photos."
            maxLength={120}
          />
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Replaces the “Find your photos.” headline on the search screen.
          </div>
        </Labeled>
        {type === "camp" && (
          <Labeled label="Browse-all link (Google Photos album)">
            <input
              style={FIELD}
              type="url"
              value={externalBrowseUrl}
              onChange={(e) => setExternalBrowseUrl(e.target.value)}
              placeholder="https://photos.app.goo.gl/…  (leave blank for in-app browse)"
            />
          </Labeled>
        )}
      </Section>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>}
      </div>
    </div>
  );
}

/** A labeled, vertically-stacked group of fields with a section header. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          ...LABEL,
          color: "var(--ink)",
          borderBottom: "1px solid var(--line)",
          paddingBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Owner control to force a re-run of a detection stage across every photo in
 * the event (after enabling color groups, tuning OCR, etc.). Loops the
 * cursor-paged /redetect endpoint until the server reports no next page. Stages
 * are gated on the event's SAVED toggles (the server reads saved config), so
 * save first if you just changed a toggle.
 */
type RedetectStage = "ocr" | "faces" | "colors" | "all";
type RedetectResp = { processed: number; nextCursor: string | null };
type ResumePoint = { stage: RedetectStage; label: string; cursor: string | null; done: number };

export function RerunDetection({ ev }: { ev: AdminEvent }) {
  const [total, setTotal] = useState<number | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  // Saved progress when a run stops mid-way (timeout / transient error) so the
  // owner can resume instead of restarting from photo 1 (which re-bills
  // Rekognition for work already done).
  const [resume, setResume] = useState<ResumePoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ total: number }>(`/api/admin/events/${ev.id}/redetect`)
      .then((d) => {
        if (!cancelled) setTotal(d.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ev.id]);

  // POST one batch, retrying the SAME cursor a few times on a transient error
  // (a heavy faces batch can 504; a blip shouldn't tank the whole run).
  async function postBatch(stage: RedetectStage, cursor: string | null): Promise<RedetectResp> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const reqBody = JSON.stringify({ stage, cursor });
        return await api<RedetectResp>(`/api/admin/events/${ev.id}/redetect`, {
          method: "POST",
          body: reqBody,
        });
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async function run(
    stage: RedetectStage,
    label: string,
    startCursor: string | null = null,
    startDone = 0
  ) {
    // Confirm only on a fresh start (faces re-index has a per-face Rekognition
    // cost); a resume continues silently.
    if (
      startCursor === null &&
      (stage === "faces" || stage === "all") &&
      !window.confirm(
        `Re-run ${label} on ${total ?? "all"} photos? Re-indexing faces calls Rekognition (a small per-face cost).`
      )
    ) {
      return;
    }
    setRunning(stage);
    setMsg(null);
    setResume(null);
    let cursor = startCursor;
    let done = startDone;
    setProcessed(done);
    try {
      for (let guard = 0; guard < 100000; guard++) {
        let d: RedetectResp;
        try {
          d = await postBatch(stage, cursor);
        } catch (e) {
          // Keep progress so the run can resume rather than restart + re-bill.
          setResume({ stage, label, cursor, done });
          setMsg(
            `Stopped after ${done} photo${done === 1 ? "" : "s"} — ${
              e instanceof Error ? e.message : String(e)
            }. Resume to continue.`
          );
          return;
        }
        done += d.processed;
        setProcessed(done);
        cursor = d.nextCursor;
        if (!cursor) break;
      }
      setMsg(`Re-ran ${label} on ${done} photo${done === 1 ? "" : "s"}.`);
    } finally {
      setRunning(null);
    }
  }

  const Btn = ({
    stage,
    label,
    disabled,
  }: {
    stage: RedetectStage;
    label: string;
    disabled?: boolean;
  }) => (
    <button
      className="btn btn--ghost btn--sm"
      disabled={Boolean(running) || disabled}
      onClick={() => void run(stage, label)}
      title={disabled ? `${label} is turned off for this event` : undefined}
    >
      {running === stage ? `Running… ${processed}` : label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div style={LABEL}>
        Re-run detection{typeof total === "number" ? ` · ${total} photos` : ""}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        Re-process existing photos with the current settings. Save toggle changes first.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn stage="ocr" label="Bib OCR" disabled={!ev.ocrEnabled} />
        <Btn stage="faces" label="Face rec" disabled={!ev.faceRecEnabled} />
        <Btn stage="all" label="All" />
      </div>
      {resume && !running && (
        <div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => void run(resume.stage, resume.label, resume.cursor, resume.done)}
          >
            Resume {resume.label} ({resume.done} done)
          </button>
        </div>
      )}
      {msg && <div style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</div>}
    </div>
  );
}

/**
 * Danger zone — permanently delete the event. Requires typing the event slug to
 * arm the final button (guards against an accidental click); deletes the photos
 * from R2, the Rekognition collection, and all DB rows server-side, then calls
 * onDeleted (the settings page redirects, since the event no longer resolves).
 */
export function DeleteEvent({ ev, onDeleted }: { ev: AdminEvent; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/admin/events/${ev.id}`, { method: "DELETE" });
      onDeleted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        borderTop: "1px solid var(--accent)",
        paddingTop: 16,
        marginTop: 4,
      }}
    >
      <div style={{ ...LABEL, color: "var(--accent)" }}>Danger zone</div>
      {!open ? (
        <div>
          <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
            Delete event…
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
            This permanently deletes <strong>{ev.name}</strong> and its{" "}
            <strong>{ev.photoCount}</strong> photo{ev.photoCount === 1 ? "" : "s"} — the image
            files and detected faces are removed for good. Paid orders are kept for your
            records. This cannot be undone.
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Type <code style={{ color: "var(--ink)" }}>{ev.id}</code> to confirm:
          </div>
          <input
            style={{ ...FIELD, maxWidth: 320 }}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={ev.id}
            autoComplete="off"
          />
          {err && <div style={{ fontSize: 13, color: "var(--accent)" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn--sm"
              style={{ background: "var(--accent)", color: "var(--paper)", border: 0 }}
              disabled={busy || confirmText !== ev.id}
              onClick={() => void remove()}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setErr(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Member = { id: string; name: string; email: string; addedAt: string; photoCount: number };
type Pending = { id: string; name: string; email: string; requestedAt: string };
type Candidate = { id: string; name: string; email: string };

export function EventPhotographers({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ members: Member[]; pending: Pending[]; candidates: Candidate[] }>(
        `/api/admin/events/${eventId}/photographers`
      );
      setMembers(d.members);
      setPending(d.pending ?? []);
      setCandidates(d.candidates);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  // POST grants OR approves access (creates an approved row, or flips a pending
  // self-request to approved + grants the photographer role).
  async function grant(body: { photographerId: string } | { email: string }, clearSearch = true) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/admin/events/${eventId}/photographers`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (clearSearch) setSearch("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // DELETE removes a membership — used for both "Remove" (approved) and "Deny"
  // (pending request).
  async function remove(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/admin/events/${eventId}/photographers/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const matches = q
    ? candidates
        .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
        .slice(0, 8)
    : [];
  const looksLikeEmail = /\S+@\S+\.\S+/.test(search.trim());
  const exactEmailExists =
    candidates.some((c) => c.email.toLowerCase() === q) ||
    members.some((m) => m.email.toLowerCase() === q);

  return (
    <div style={{ display: "grid", gap: 14, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div style={LABEL}>Photographer access</div>

      {/* Self-service upload requests — approve grants access; deny removes it. */}
      {pending.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ ...LABEL, color: "var(--accent)" }}>Pending requests</div>
          {pending.map((p) => (
            <div
              key={p.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14 }}
            >
              <span style={{ minWidth: 0 }}>
                {p.name} <span style={{ color: "var(--muted)" }}>&lt;{p.email}&gt;</span>
              </span>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={busy}
                  onClick={() => void grant({ photographerId: p.id }, false)}
                >
                  Approve
                </button>
                <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void remove(p.id)}>
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>No photographers added yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14 }}
            >
              <span style={{ minWidth: 0 }}>
                {m.name} <span style={{ color: "var(--muted)" }}>&lt;{m.email}&gt;</span>
                <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>
                  · {m.photoCount} photo{m.photoCount === 1 ? "" : "s"}
                </span>
              </span>
              <button className="btn btn--ghost" disabled={busy} onClick={() => void remove(m.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add by searching existing photographers (name/email), or by typing a
          full email to invite someone who hasn't signed in yet. */}
      <div style={{ display: "grid", gap: 6 }}>
        <input
          style={FIELD}
          placeholder="Add a photographer — search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {q && (matches.length > 0 || (looksLikeEmail && !exactEmailExists)) && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
            {matches.map((c) => (
              <button
                key={c.id}
                onClick={() => void grant({ photographerId: c.id })}
                disabled={busy}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "transparent",
                  border: 0,
                  borderBottom: "1px solid var(--line)",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                {c.name} <span style={{ color: "var(--muted)" }}>&lt;{c.email}&gt;</span>
              </button>
            ))}
            {looksLikeEmail && !exactEmailExists && (
              <button
                onClick={() => void grant({ email: search.trim() })}
                disabled={busy}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "var(--cream)",
                  border: 0,
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                Add <strong>{search.trim()}</strong> by email
              </button>
            )}
          </div>
        )}
      </div>
      {msg && <div style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={LABEL}>{label}</div>
      {children}
    </div>
  );
}
